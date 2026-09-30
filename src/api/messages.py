"""
Tin nhắn giữa SV và cố vấn phụ trách. Một hội thoại xác định bằng mã SV; SV chỉ mở được hội thoại của mình,
cố vấn chỉ mở được hội thoại với SV thuộc danh sách phụ trách (403 nếu không).
"""

from typing import Any

from fastapi import APIRouter, Response, status

from src.api.deps import CurrentUser, DbSession
from src.db.models import utcnow
from src.models.schemas import (
    ChatMessage,
    ConversationResponse,
    ConversationSummary,
    SendMessageRequest,
    UnreadCountResponse,
)
from src.services import messages

router = APIRouter(prefix="/conversations", tags=["Messages"])


@router.get("", response_model=list[ConversationSummary])
def list_conversations(user: CurrentUser, db: DbSession) -> list[dict[str, Any]]:
    """Cố vấn: mọi SV phụ trách, hội thoại có tin mới nhất trước. SV: hội thoại với cố vấn phụ trách."""
    return messages.conversations(db, user)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(user: CurrentUser, db: DbSession) -> dict[str, int]:
    """Tổng số tin chưa đọc, cho biểu tượng tin nhắn trên thanh trên cùng."""
    return {"count": messages.unread_count(db, user)}


@router.get("/{student_id}", response_model=ConversationResponse)
def get_conversation(student_id: str, user: CurrentUser, db: DbSession) -> dict[str, Any]:
    """Tối đa 200 tin gần nhất (cũ → mới). SV chưa được phân công cố vấn: 404 "no_advisor"."""
    return messages.conversation(db, user, student_id)


@router.post("/{student_id}/messages", response_model=ChatMessage, status_code=status.HTTP_201_CREATED)
def send_message(student_id: str, body: SendMessageRequest, user: CurrentUser, db: DbSession) -> dict[str, Any]:
    """Gửi tin nhắn văn bản (tối đa 2000 ký tự)."""
    return messages.send(db, user, student_id, body.body, utcnow())


@router.post("/{student_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(student_id: str, user: CurrentUser, db: DbSession) -> Response:
    """Đánh dấu đã đọc các tin người kia gửi; người kia thấy "Đã xem"."""
    messages.mark_read(db, user, student_id, utcnow())
    return Response(status_code=status.HTTP_204_NO_CONTENT)
