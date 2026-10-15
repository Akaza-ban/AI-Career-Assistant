"""Slim run reservation and in-process cancellation (single worker only).

No equivalent run registry exists in the legacy agent. Conversation and turn
storage remain the existing ORM models; no graph/checkpoint state is stored.
"""

import asyncio
from collections.abc import Awaitable, Callable

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.database import SessionLocal
from src.db.models import AssistantConversation, AssistantRun, AssistantTurn, User, utcnow
from src.models.assistant import AssistantRunResponse, ChatRequest, ChatResponse

_tasks: dict[str, asyncio.Task[ChatResponse]] = {}


def owned_run(db: Session, run_id: str, user: User) -> AssistantRun:
    run = db.scalar(
        select(AssistantRun)
        .join(AssistantConversation)
        .where(
            AssistantRun.id == run_id,
            AssistantRun.user_id == user.id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if run is None:
        raise AppError(404, "Không tìm thấy lượt chạy.", "NOT_FOUND")
    return run


def run_response(run: AssistantRun) -> AssistantRunResponse:
    return AssistantRunResponse.model_validate(run, from_attributes=True)


def existing_run(db: Session, body: ChatRequest, user: User) -> AssistantRun | None:
    query = (
        select(AssistantRun)
        .join(AssistantConversation)
        .where(
            AssistantRun.user_id == user.id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
            AssistantRun.client_request_id == body.client_request_id,
        )
    )
    if body.conversation_id:
        query = query.where(AssistantRun.conversation_id == body.conversation_id)
    return db.scalar(query.order_by(AssistantRun.created_at.desc()))


def reserve(
    db: Session, body: ChatRequest, user: User, conversation: AssistantConversation
) -> tuple[AssistantRun, bool]:
    previous = existing_run(db, body, user)
    if previous is not None:
        return previous, False
    run = AssistantRun(
        conversation_id=conversation.id,
        user_id=user.id,
        client_request_id=body.client_request_id,
        route=body.context.route,
        status="running",
    )
    db.add(conversation)
    db.add(run)
    try:
        db.flush()
        db.add(
            AssistantTurn(
                conversation_id=conversation.id,
                run_id=run.id,
                user_message=body.message,
                assistant_message="",
                intent="qa",
                context_json=body.context.model_dump(mode="json"),
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        previous = existing_run(db, body, user)
        if previous is not None:
            return previous, False
        raise AppError(409, "Hội thoại đang có lượt chạy. Hãy dừng trước khi gửi tiếp.", "run_in_progress") from None
    return run, True


def finish_interrupted(run_id: str, body: ChatRequest, status: str) -> None:
    with SessionLocal() as db:
        changed = db.execute(
            update(AssistantRun)
            .where(
                AssistantRun.id == run_id,
                AssistantRun.status == "running",
            )
            .values(status=status, updated_at=utcnow())
        ).rowcount
        if changed:
            run = db.get(AssistantRun, run_id)
            turn = db.scalar(select(AssistantTurn).where(AssistantTurn.run_id == run_id))
            if turn is None:
                db.add(
                    AssistantTurn(
                        conversation_id=run.conversation_id,
                        run_id=run_id,
                        user_message=body.message,
                        assistant_message="",
                        intent="qa",
                        context_json=body.context.model_dump(mode="json"),
                        interrupted=True,
                    )
                )
            else:
                turn.interrupted = True
            db.commit()


def sweep_running(db: Session) -> int:
    ids = list(db.scalars(select(AssistantRun.id).where(AssistantRun.status == "running")))
    if ids:
        db.execute(update(AssistantTurn).where(AssistantTurn.run_id.in_(ids)).values(interrupted=True))
        db.execute(
            update(AssistantRun)
            .where(AssistantRun.id.in_(ids), AssistantRun.status == "running")
            .values(status="interrupted", updated_at=utcnow())
        )
        db.commit()
    return len(ids)


async def cancel(run_id: str) -> None:
    task = _tasks.get(run_id)
    if task is not None and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


async def execute(
    run_id: str, body: ChatRequest, request: Request, respond: Callable[[], Awaitable[ChatResponse]]
) -> ChatResponse | AssistantRunResponse:
    async def worker() -> ChatResponse:
        try:
            return await respond()
        except asyncio.CancelledError:
            finish_interrupted(run_id, body, "cancelled")
            raise
        except Exception:
            finish_interrupted(run_id, body, "failed")
            raise AppError(
                503, "Trợ lý tạm thời chưa thể trả lời. Vui lòng thử lại.", "assistant_unavailable"
            ) from None

    task = asyncio.create_task(worker())
    _tasks[run_id] = task
    try:
        while not task.done():
            done, _ = await asyncio.wait({task}, timeout=0.1)
            if not done and await request.is_disconnected():
                await cancel(run_id)
        if task.cancelled():
            finish_interrupted(run_id, body, "cancelled")
            with SessionLocal() as db:
                return run_response(db.get(AssistantRun, run_id))
        return task.result()
    except asyncio.CancelledError:
        await cancel(run_id)
        raise
    finally:
        _tasks.pop(run_id, None)
