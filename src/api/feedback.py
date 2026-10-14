"""
Phản hồi của người dùng cho kết quả AI (US-SV-06): like / dislike từng phần (đổi hoặc huỷ được, phòng bấm nhầm)
và CSAT sau mỗi lượt dùng (chỉ gửi một lần).
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from src.api.deps import CurrentUser, DbSession
from src.api.errors import AppError
from src.db.models import Feedback
from src.models.schemas import FeedbackRequest, FeedbackResponse, FeedbackStatus
from src.services import feedback as feedback_service

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _find(db: DbSession, user_id: str, response_id: str, kind: str) -> Feedback | None:
    return db.scalar(
        select(Feedback).where(Feedback.user_id == user_id, Feedback.response_id == response_id, Feedback.kind == kind)
    )


@router.post("", response_model=FeedbackResponse)
def send_feedback(body: FeedbackRequest, user: CurrentUser, db: DbSession) -> FeedbackResponse:
    """
    Lưu phản hồi. CSAT: mỗi người chỉ gửi một lần cho mỗi lượt, gửi lại trả về giá trị đã lưu (US-SV-06 AC3).
    Like / dislike: gửi lại thì đổi sang giá trị mới (huỷ bằng DELETE).
    """
    if body.kind == "thumb" and body.value not in (1, -1):
        raise AppError(422, "Giá trị like/dislike phải là 1 hoặc -1.", "validation_error")
    tags = None
    if body.kind == "csat":
        if not 1 <= body.value <= 5:
            raise AppError(422, "Đánh giá CSAT phải từ 1 đến 5 sao.", "validation_error")
        if body.activity not in feedback_service.CSAT_ACTIVITIES:
            raise AppError(422, "Thiếu loại hoạt động được đánh giá.", "validation_error")
        tags = feedback_service.check_tags(body.activity, body.value, body.tags)
    elif body.activity is not None and body.activity not in feedback_service.THUMB_ACTIVITIES:
        raise AppError(422, "Loại phản hồi like / dislike không hợp lệ.", "validation_error")
    comment = (body.comment or "").strip() or None
    if comment and len(comment) > feedback_service.MAX_COMMENT_CHARS:
        raise AppError(422, f"Nhận xét tối đa {feedback_service.MAX_COMMENT_CHARS} ký tự.", "comment_too_long")

    existing = _find(db, user.id, body.response_id, body.kind)
    if existing is not None and body.kind == "thumb":
        existing.value = body.value
        existing.activity = body.activity or existing.activity
        db.commit()
        return FeedbackResponse(id=existing.id, already_submitted=False, value=existing.value)
    if existing is not None:
        return FeedbackResponse(id=existing.id, already_submitted=True, value=existing.value)

    feedback = Feedback(
        id=f"fb_{uuid.uuid4().hex[:12]}",
        user_id=user.id,
        response_id=body.response_id,
        kind=body.kind,
        value=body.value,
        activity=body.activity,
        comment=comment,
        tags=tags,
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


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_thumb(
    user: CurrentUser,
    db: DbSession,
    response_id: str = Query(..., description="Id phản hồi AI"),
    kind: Literal["thumb"] = Query("thumb", description="Chỉ like / dislike huỷ được; CSAT giữ nguyên"),
) -> None:
    """Huỷ like / dislike (bấm lại nút đang chọn). Không có gì để huỷ cũng trả 204."""
    existing = _find(db, user.id, response_id, kind)
    if existing is not None:
        db.delete(existing)
        db.commit()
