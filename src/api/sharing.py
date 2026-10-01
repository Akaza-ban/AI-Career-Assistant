"""Chia sẻ tài liệu với cố vấn phụ trách và nhận xét của cố vấn (phía SV)."""

from typing import Any

from fastapi import APIRouter, Response, status

from src.api.deps import CurrentStudent, DbSession
from src.db.models import utcnow
from src.models.schemas import SharedItem, SharingResponse, UpdateSharingRequest
from src.services import sharing

router = APIRouter(prefix="/students/me", tags=["Sharing"])


@router.get("/sharing", response_model=SharingResponse)
def get_sharing(user: CurrentStudent, db: DbSession) -> dict[str, Any]:
    """
    Cố vấn phụ trách, mọi tài liệu (phiên bản CV, báo cáo phỏng vấn) kèm trạng thái chia sẻ và nhận xét của cố vấn.
    Không chia sẻ thì cố vấn chỉ thấy số liệu tổng hợp, không xem được nội dung.
    """
    return sharing.overview(db, user)


@router.patch("/sharing", response_model=list[SharedItem])
def update_sharing(body: UpdateSharingRequest, user: CurrentStudent, db: DbSession) -> list[dict[str, Any]]:
    """Bật / tắt chia sẻ một hoặc nhiều tài liệu; có hiệu lực ngay."""
    sharing.update(db, user, body.item_ids, body.shared, utcnow())
    return sharing.items(db, user)


@router.post("/advisor-feedback/{review_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_feedback_read(review_id: str, user: CurrentStudent, db: DbSession) -> Response:
    """Đánh dấu SV đã xem nhận xét của cố vấn (cố vấn thấy "SV đã xem")."""
    sharing.mark_read(db, user, review_id, utcnow())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
