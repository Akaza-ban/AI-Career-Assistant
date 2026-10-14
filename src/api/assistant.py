"""Authenticated Assistant conversations, action audit, feedback and reindexing."""

import logging
from typing import Annotated
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi import APIRouter, Depends
from sqlalchemy import select

from src.api.deps import CurrentAdvisor, CurrentUser, DbSession
from src.api.errors import AppError
from src.config import get_settings
from src.db.models import (
    AdvisorAssignment,
    AgentActionLog,
    AssistantConversation,
    AssistantFeedback,
    AssistantTurn,
    CvVersion,
    GapAnalysis,
    InterviewSession,
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
    AssistantStatusResponse,
    ChatRequest,
    ChatResponse,
    ReindexResponse,
    route_allowed,
)
from src.services.assistant.agent import ASSISTANT_INDEX_LOCK, AssistantAgent, get_assistant_agent
from src.services.assistant.indexer import build_assistant_index
from src.services.llm import check_llm_health

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["Assistant"])
AgentDependency = Annotated[AssistantAgent, Depends(get_assistant_agent)]


@router.get("/status", response_model=AssistantStatusResponse)
async def get_assistant_status(user: CurrentUser) -> AssistantStatusResponse:
    """Report live LLM connectivity independently of retrieval fallback readiness."""
    from src.services.providers.gateway import provider_scope

    with provider_scope(user_id=user.id):
        return AssistantStatusResponse.model_validate(await check_llm_health())


def _owned_conversation(db: DbSession, conversation_id: str, user: User) -> AssistantConversation:
    conversation = db.get(AssistantConversation, conversation_id)
    if conversation is None or conversation.user_id != user.id or conversation.role != user.role:
        raise AppError(404, "Không tìm thấy hội thoại.", "conversation_not_found")
    return conversation


def _owned_turn(db: DbSession, turn_id: str, user: User) -> AssistantTurn:
    turn = db.get(AssistantTurn, turn_id)
    if turn is None:
        raise AppError(404, "Không tìm thấy lượt trả lời.", "turn_not_found")
    _owned_conversation(db, turn.conversation_id, user)
    return turn


def _resource_actions(db: DbSession, user: User, actions: list[AgentAction], students: list[str]) -> list[AgentAction]:
    """Model/context IDs do not establish ownership or an advisor assignment."""
    safe: list[AgentAction] = []
    for action in actions:
        if action.action_type == "START_ANALYSIS":
            cv = db.get(CvVersion, action.params.cv_id)
            jd = db.get(JobDescription, action.params.jd_id)
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
            if user.role == "advisor" and len(parts) == 4 and parts[2] == "students" and parts[3] not in students:
                continue
            if user.role == "student" and len(parts) >= 4 and parts[2] == "library":
                # Chi tiết JD: JD thư viện đang hiển thị hoặc JD sinh viên tự thêm
                jd = db.get(JobDescription, parts[3])
                visible = jd is not None and (
                    (jd.source == "library" and jd.status in (None, "published"))
                    or (jd.owner_id == user.id and jd.status != "deleted")
                )
                if not visible:
                    continue
            elif user.role == "student" and len(parts) >= 4 and parts[3] not in ("new", "start", "compare"):
                model = {"cv": CvVersion, "analysis": GapAnalysis, "interview": InterviewSession}.get(parts[2])
                resource = db.get(model, parts[3]) if model else None
                if resource is None or resource.owner_id != user.id:
                    continue
        safe.append(action)
    return safe


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: CurrentUser, db: DbSession, agent: AgentDependency) -> ChatResponse:
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
    history: list[dict[str, str]] = []
    if body.conversation_id:
        conversation = _owned_conversation(db, body.conversation_id, user)
        recent = db.scalars(
            select(AssistantTurn)
            .where(AssistantTurn.conversation_id == conversation.id)
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
    students = (
        list(db.scalars(select(AdvisorAssignment.student_id).where(AdvisorAssignment.advisor_id == user.id)))
        if user.role == "advisor"
        else []
    )
    from src.services.privacy.types import Identity
    from src.services.providers.gateway import provider_scope

    with provider_scope(user_id=user.id, identities=(Identity(name=user.full_name, email=user.email),)):
        result = await agent.respond(body.message, context, history=history, allowed_student_ids=students)
    actions = _resource_actions(db, user, result.actions, students)
    message = result.message
    if any(action.action_type == "START_ANALYSIS" for action in result.actions) and not any(
        action.action_type == "START_ANALYSIS" for action in actions
    ):
        message = "CV hoặc JD đã chọn chưa khả dụng cho tài khoản này. Hãy chọn lại trước khi bắt đầu phân tích."
    turn = AssistantTurn(
        id=str(uuid4()),
        conversation_id=conversation.id,
        user_message=body.message,
        assistant_message=message,
        intent=result.intent,
        context_json=context.model_dump(mode="json"),
        sources_json=[source.model_dump(mode="json") for source in result.sources],
        created_at=utcnow(),
    )
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
        message=message,
        intent=result.intent,
        actions=actions,
        sources=result.sources,
    )


@router.post("/action/confirm", response_model=ActionConfirmationResponse)
def confirm_action(body: ActionConfirmationRequest, user: CurrentUser, db: DbSession) -> ActionConfirmationResponse:
    action = db.get(AgentActionLog, body.action_id)
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
    feedback = db.scalar(select(AssistantFeedback).where(AssistantFeedback.turn_id == body.turn_id))
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
    feedback = db.scalar(select(AssistantFeedback).where(AssistantFeedback.turn_id == turn_id))
    if feedback is not None:
        db.delete(feedback)
        db.commit()


@router.post("/reindex", response_model=ReindexResponse)
def reindex(user: CurrentAdvisor) -> ReindexResponse:
    """Rebuild only the configured corpus; no arbitrary filesystem path from clients."""
    try:
        from src.services.providers.gateway import provider_scope

        with ASSISTANT_INDEX_LOCK, provider_scope(user_id=user.id):
            count = build_assistant_index()
    except Exception:
        logger.warning("Assistant reindex failed")
        raise AppError(
            503, "Không thể lập lại chỉ mục tài liệu. Vui lòng thử lại.", "assistant_index_unavailable"
        ) from None
    return ReindexResponse(chunks_indexed=count)
