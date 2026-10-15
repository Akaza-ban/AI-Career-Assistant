"""Authenticated Assistant conversations, action audit, feedback and reindexing."""

import logging
from typing import Annotated
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_, select, update

from src.api.deps import CurrentAdvisor, CurrentUser, DbSession
from src.api.errors import AppError
from src.config import get_settings
from src.db.models import (
    AdvisorAssignment,
    AgentActionLog,
    AssistantConversation,
    AssistantFeedback,
    AssistantRun,
    AssistantTurn,
    CvVersion,
    GapAnalysis,
    InterviewSession,
    JobComparisonHistory,
    JobDescription,
    User,
    utcnow,
)
from src.models.assistant import (
    ActionConfirmationRequest,
    ActionConfirmationResponse,
    AgentAction,
    AssistantFeedbackRequest,
    AssistantFeedbackResponse,
    AssistantHistoryMessage,
    AssistantRunResponse,
    AssistantStatusResponse,
    ChatRequest,
    ChatResponse,
    ReindexResponse,
    route_allowed,
)
from src.services.assistant import runs
from src.services.assistant.agent import ASSISTANT_INDEX_LOCK, AssistantAgent, get_assistant_agent, normalized
from src.services.assistant.indexer import build_assistant_index
from src.services.llm import check_llm_health

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["Assistant"])
AgentDependency = Annotated[AssistantAgent, Depends(get_assistant_agent)]


@router.get("/runs/{run_id}", response_model=AssistantRunResponse)
def get_run(run_id: str, user: CurrentUser, db: DbSession) -> AssistantRunResponse:
    return runs.run_response(runs.owned_run(db, run_id, user))


@router.post("/runs/{run_id}/cancel", response_model=AssistantRunResponse)
async def cancel_run(run_id: str, user: CurrentUser, db: DbSession) -> AssistantRunResponse:
    run = runs.owned_run(db, run_id, user)
    if run.status == "running":
        # Release the read transaction before the worker persists cancellation.
        db.commit()
        await runs.cancel(run_id)
        changed = db.execute(
            update(AssistantRun)
            .where(
                AssistantRun.id == run_id,
                AssistantRun.user_id == user.id,
                AssistantRun.status == "running",
            )
            .values(status="cancelled", updated_at=utcnow())
        ).rowcount
        if changed:
            db.execute(update(AssistantTurn).where(AssistantTurn.run_id == run_id).values(interrupted=True))
        db.commit()
        db.expire_all()
    return runs.run_response(runs.owned_run(db, run_id, user))


@router.get("/conversations/{conversation_id}/history", response_model=list[AssistantHistoryMessage])
def get_conversation_history(conversation_id: str, user: CurrentUser, db: DbSession) -> list[AssistantHistoryMessage]:
    _owned_conversation(db, conversation_id, user)
    turns = db.scalars(
        select(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AssistantTurn.conversation_id == conversation_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
        .order_by(AssistantTurn.created_at, AssistantTurn.id)
    ).all()
    messages: list[AssistantHistoryMessage] = []
    for turn in turns:
        for sender, content in (("user", turn.user_message), ("assistant", turn.assistant_message)):
            messages.append(
                AssistantHistoryMessage(
                    id=f"{turn.id}:{sender}",
                    sender=sender,
                    content=content,
                    created_at=turn.created_at,
                    turn_id=turn.id,
                    run_id=turn.run_id,
                    intent=turn.intent,
                    interrupted=turn.interrupted if sender == "assistant" else False,
                    sources=turn.sources_json if sender == "assistant" else [],
                )
            )
    return messages


@router.get("/status", response_model=AssistantStatusResponse)
async def get_assistant_status(user: CurrentUser) -> AssistantStatusResponse:
    """Report live LLM connectivity independently of retrieval fallback readiness."""
    from src.services.providers.gateway import provider_scope

    with provider_scope(user_id=user.id, mask_only=True):
        return AssistantStatusResponse.model_validate(await check_llm_health(assistant=True))


def _owned_conversation(db: DbSession, conversation_id: str, user: User) -> AssistantConversation:
    conversation = db.scalar(
        select(AssistantConversation).where(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if conversation is None:
        raise AppError(404, "Không tìm thấy hội thoại.", "conversation_not_found")
    return conversation


def _owned_turn(db: DbSession, turn_id: str, user: User) -> AssistantTurn:
    turn = db.scalar(
        select(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AssistantTurn.id == turn_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if turn is None:
        raise AppError(404, "Không tìm thấy lượt trả lời.", "turn_not_found")
    return turn


def _resource_actions(db: DbSession, user: User, actions: list[AgentAction], students: list[str]) -> list[AgentAction]:
    """Model/context IDs do not establish ownership or an advisor assignment."""
    safe: list[AgentAction] = []
    for action in actions:
        if action.action_type == "START_ANALYSIS":
            cv = db.scalar(select(CvVersion).where(CvVersion.id == action.params.cv_id, CvVersion.owner_id == user.id))
            jd = db.scalar(
                select(JobDescription).where(
                    JobDescription.id == action.params.jd_id,
                    or_(JobDescription.source == "library", JobDescription.owner_id == user.id),
                )
            )
            if (
                user.role != "student"
                or cv is None
                or cv.owner_id != user.id
                or not cv.content_text.strip()
                or jd is None
                or (jd.source != "library" and jd.owner_id != user.id)
            ):
                continue
        if action.action_type == "SELECT_STUDENT" and (
            user.role != "advisor" or action.params.student_id not in students
        ):
            continue
        if action.action_type == "NAVIGATE_PAGE":
            route = action.params.route
            if not route_allowed(route, user.role):
                continue
            parts = route.split("/")
            if user.role == "student" and len(parts) == 5 and parts[2:4] == ["analysis", "compare"]:
                comparison = db.scalar(
                    select(JobComparisonHistory.id).where(
                        JobComparisonHistory.id == parts[4], JobComparisonHistory.owner_id == user.id
                    )
                )
                if comparison is None:
                    continue
            if user.role == "advisor" and len(parts) == 4 and parts[2] == "students" and parts[3] not in students:
                continue
            if user.role == "student" and len(parts) >= 4 and parts[2] == "library":
                # Chi tiết JD: JD thư viện đang hiển thị hoặc JD sinh viên tự thêm
                jd = db.scalar(
                    select(JobDescription).where(
                        JobDescription.id == parts[3],
                        or_(JobDescription.source == "library", JobDescription.owner_id == user.id),
                    )
                )
                visible = jd is not None and (
                    (jd.source == "library" and jd.status in (None, "published"))
                    or (jd.owner_id == user.id and jd.status != "deleted")
                )
                if not visible:
                    continue
            elif user.role == "student" and len(parts) >= 4 and parts[3] not in ("new", "start", "compare"):
                model = {"cv": CvVersion, "analysis": GapAnalysis, "interview": InterviewSession}.get(parts[2])
                resource = (
                    db.scalar(select(model).where(model.id == parts[3], model.owner_id == user.id)) if model else None
                )
                if resource is None or resource.owner_id != user.id:
                    continue
        safe.append(action)
    return safe


@router.post("/chat", response_model=ChatResponse | AssistantRunResponse)
async def chat(
    body: ChatRequest, request: Request, user: CurrentUser, db: DbSession, agent: AgentDependency
) -> ChatResponse | AssistantRunResponse:
    context = body.context
    if (
        context.user_role != user.role
        or context.user_id not in (None, user.id)
        or not route_allowed(context.route, user.role)
        or not route_allowed(urlsplit(context.current_url).path, user.role)
    ):
        raise AppError(403, "Ngữ cảnh không khớp với tài khoản đang đăng nhập.", "forbidden")
    # The authenticated identity is authoritative, not context sent by the browser.
    context = context.model_copy(update={"user_id": user.id, "user_role": user.role})
    selected_cv_unavailable = (
        context.selected_cv_id is not None
        and db.scalar(
            select(CvVersion.id).where(
                CvVersion.id == context.selected_cv_id,
                CvVersion.owner_id == user.id,
            )
        )
        is None
    )
    if selected_cv_unavailable:
        context = context.model_copy(update={"selected_cv_id": None})
    body = body.model_copy(update={"context": context})
    if body.conversation_id:
        _owned_conversation(db, body.conversation_id, user)
    previous = runs.existing_run(db, body, user)
    if previous is not None:
        return runs.run_response(previous)
    history: list[dict[str, str]] = []
    if body.conversation_id:
        conversation = _owned_conversation(db, body.conversation_id, user)
        recent = db.scalars(
            select(AssistantTurn)
            .join(AssistantConversation)
            .where(AssistantTurn.conversation_id == conversation.id)
            .where(AssistantConversation.user_id == user.id, AssistantConversation.role == user.role)
            .where(AssistantTurn.assistant_message != "")
            .order_by(AssistantTurn.created_at.desc(), AssistantTurn.id.desc())
            .limit(get_settings().assistant_history_turns)
        ).all()
        for turn in reversed(recent):
            history.extend(
                [
                    {"role": "user", "content": turn.user_message},
                    {"role": "assistant", "content": turn.assistant_message},
                ]
            )
    else:
        conversation = AssistantConversation(
            id=str(uuid4()), user_id=user.id, role=user.role, title=body.message[:120], created_at=utcnow()
        )
    run, created = runs.reserve(db, body, user, conversation)
    if not created:
        return runs.run_response(run)
    # Do not keep a read transaction open while waiting for upstream IO.
    db.commit()

    async def respond() -> ChatResponse:
        from src.db.database import SessionLocal

        with SessionLocal() as work_db:
            return await _respond(body, user, work_db, agent, run.id, conversation.id, history, selected_cv_unavailable)

    return await runs.execute(run.id, body, request, respond)


async def _respond(
    body: ChatRequest,
    user: User,
    db: DbSession,
    agent: AssistantAgent,
    run_id: str,
    conversation_id: str,
    history: list[dict[str, str]],
    selected_cv_unavailable: bool,
) -> ChatResponse:
    context = body.context
    conversation = _owned_conversation(db, conversation_id, user)
    students = (
        list(db.scalars(select(AdvisorAssignment.student_id).where(AdvisorAssignment.advisor_id == user.id)))
        if user.role == "advisor"
        else []
    )
    from src.services.privacy.types import Identity
    from src.services.providers.gateway import provider_scope

    with provider_scope(
        user_id=user.id,
        identities=(Identity(name=user.full_name, email=user.email, phone=user.phone or ""),),
        mask_only=True,
    ):
        result = await agent.respond(body.message, context, history=history, allowed_student_ids=students)
    from src.models.assistant import NavigateAction
    from src.services.assistant.guardrails import validate_ui_actions
    from src.services.assistant.ui_registry import resolve_route

    try:
        ui_actions = validate_ui_actions(result.ui_actions, user.role)
    except ValueError as exc:
        raise AppError(422, "Hành động giao diện không hợp lệ.", "invalid_ui_action") from exc
    for action in ui_actions:
        if action.type == "navigate":
            legacy = NavigateAction(
                description_vi="Mở trang", params={"route": resolve_route(action.route_id, action.params, user.role)}
            )
            if not _resource_actions(db, user, [legacy], students):
                raise AppError(403, "Trang chưa khả dụng cho tài khoản này.", "forbidden")
    actions = _resource_actions(db, user, result.actions, students)
    message = result.message
    if (
        any(action.action_type == "START_ANALYSIS" for action in result.actions)
        and not any(action.action_type == "START_ANALYSIS" for action in actions)
    ) or (selected_cv_unavailable and result.intent != "qa" and "bat dau phan tich" in normalized(body.message)):
        message = "CV hoặc JD đã chọn chưa khả dụng cho tài khoản này. Hãy chọn lại trước khi bắt đầu phân tích."
    run = runs.owned_run(db, run_id, user)
    if run.status != "running":
        raise AppError(409, "Lượt chạy đã kết thúc.", "run_finished")
    turn = db.scalar(
        select(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AssistantTurn.run_id == run_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    turn.assistant_message = message
    turn.intent = result.intent
    turn.sources_json = [source.model_dump(mode="json") for source in result.sources]
    run.status = "done"
    run.updated_at = utcnow()
    conversation.updated_at = utcnow()
    db.add(conversation)
    db.add(turn)
    for action in actions:
        db.add(
            AgentActionLog(
                id=action.id,
                turn_id=turn.id,
                action_type=action.action_type,
                params_json=action.params.model_dump(mode="json"),
                status="pending",
            )
        )
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return ChatResponse(
        conversation_id=conversation.id,
        turn_id=turn.id,
        run_id=run_id,
        message=message,
        intent=result.intent,
        actions=actions,
        ui_actions=ui_actions,
        sources=result.sources,
    )


@router.post("/action/confirm", response_model=ActionConfirmationResponse)
def confirm_action(body: ActionConfirmationRequest, user: CurrentUser, db: DbSession) -> ActionConfirmationResponse:
    action = db.scalar(
        select(AgentActionLog)
        .join(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AgentActionLog.id == body.action_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if action is None:
        raise AppError(404, "Không tìm thấy hành động.", "action_not_found")
    _owned_turn(db, action.turn_id, user)
    if action.status not in ("pending", "confirmed", body.status):
        raise AppError(409, "Hành động đã có kết quả khác; không thể ghi đè.", "action_already_finished")
    if action.status != body.status:
        action.status = body.status
        action.error_message = body.error_message if body.status == "failed" else None
        action.client_executed_at = utcnow() if body.status == "executed" else None
        db.commit()
    return ActionConfirmationResponse(action_id=action.id, status=body.status)


@router.post("/feedback", response_model=AssistantFeedbackResponse)
def submit_feedback(body: AssistantFeedbackRequest, user: CurrentUser, db: DbSession) -> AssistantFeedbackResponse:
    _owned_turn(db, body.turn_id, user)
    feedback = db.scalar(
        select(AssistantFeedback)
        .join(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AssistantFeedback.turn_id == body.turn_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if feedback is None:
        feedback = AssistantFeedback(id=str(uuid4()), turn_id=body.turn_id, rating=body.rating)
        db.add(feedback)
    feedback.rating = body.rating
    feedback.comment = body.comment or None
    db.commit()
    return AssistantFeedbackResponse(id=feedback.id, turn_id=feedback.turn_id, rating=feedback.rating)


@router.delete("/feedback/{turn_id}", status_code=204)
def delete_feedback(turn_id: str, user: CurrentUser, db: DbSession) -> None:
    """Bấm lại nút thích / không thích đã chọn để huỷ đánh giá (khi bấm nhầm)."""
    _owned_turn(db, turn_id, user)
    feedback = db.scalar(
        select(AssistantFeedback)
        .join(AssistantTurn)
        .join(AssistantConversation)
        .where(
            AssistantFeedback.turn_id == turn_id,
            AssistantConversation.user_id == user.id,
            AssistantConversation.role == user.role,
        )
    )
    if feedback is not None:
        db.delete(feedback)
        db.commit()


@router.post("/reindex", response_model=ReindexResponse)
def reindex(user: CurrentAdvisor) -> ReindexResponse:
    """Rebuild only the configured corpus; no arbitrary filesystem path from clients."""
    try:
        from src.services.providers.gateway import provider_scope

        with ASSISTANT_INDEX_LOCK, provider_scope(user_id=user.id, mask_only=True):
            count = build_assistant_index()
    except Exception:
        logger.warning("Assistant reindex failed")
        raise AppError(
            503, "Không thể lập lại chỉ mục tài liệu. Vui lòng thử lại.", "assistant_index_unavailable"
        ) from None
    return ReindexResponse(chunks_indexed=count)
