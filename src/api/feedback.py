"""Phản hồi của người dùng cho kết quả AI: like/dislike từng gợi ý và CSAT sau mỗi lượt dùng (US-SV-06)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import select

from src.api.deps import CurrentUser, DbSession
from src.api.errors import AppError
from src.db.models import Feedback
from src.models.schemas import FeedbackRequest, FeedbackResponse, FeedbackStatus

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _find(db: DbSession, user_id: str, response_id: str, kind: str) -> Feedback | None:
    return db.scalar(
        select(Feedback).where(Feedback.user_id == user_id, Feedback.response_id == response_id, Feedback.kind == kind)
    )


@router.post("", response_model=FeedbackResponse)
def send_feedback(body: FeedbackRequest, user: CurrentUser, db: DbSession) -> FeedbackResponse:
    """Lưu phản hồi. Mỗi người chỉ gửi một lần cho mỗi phản hồi AI; gửi lại trả về giá trị đã lưu (US-SV-06 AC3)."""
    if body.kind == "thumb" and body.value not in (1, -1):
        raise AppError(422, "Giá trị like/dislike phải là 1 hoặc -1.", "validation_error")
    if body.kind == "csat":
        if not 1 <= body.value <= 5:
            raise AppError(422, "Đánh giá CSAT phải từ 1 đến 5 sao.", "validation_error")
        if body.activity is None:
            raise AppError(422, "Thiếu loại hoạt động được đánh giá.", "validation_error")

    existing = _find(db, user.id, body.response_id, body.kind)
    if existing is not None:
        return FeedbackResponse(id=existing.id, already_submitted=True, value=existing.value)

    feedback = Feedback(
        id=f"fb_{uuid.uuid4().hex[:12]}",
        user_id=user.id,
        response_id=body.response_id,
        kind=body.kind,
        value=body.value,
        activity=body.activity,
        comment=(body.comment or "").strip() or None,
        would_reuse=body.would_reuse if body.kind == "csat" else None,
    )
    db.add(feedback)
    db.commit()
    return FeedbackResponse(id=feedback.id, already_submitted=False, value=feedback.value)


@router.get("", response_model=FeedbackStatus)
def get_feedback(
    user: CurrentUser,
    db: DbSession,
    response_id: str = Query(..., description="Id phản hồi AI"),
    kind: Literal["thumb", "csat"] = Query(...),
) -> FeedbackStatus:
    """Phản hồi đã gửi cho một response_id; value = null nếu chưa gửi."""
    existing = _find(db, user.id, response_id, kind)
    return FeedbackStatus(kind=kind, value=existing.value if existing else None)
