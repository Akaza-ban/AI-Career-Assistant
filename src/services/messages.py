"""
Tin nhắn giữa SV và cố vấn phụ trách (chỉ văn bản, chưa đính kèm file).

- Hội thoại là cặp (cố vấn, SV) trong bảng phân công: SV chỉ nhắn với cố vấn đang phụ trách mình, cố vấn chỉ nhắn
  với SV thuộc danh sách phụ trách (403 nếu không). Đổi cố vấn thì hội thoại cũ không còn mở được.
- Frontend hỏi tin mới định kỳ (polling) khi khung chat đang mở; chưa dùng WebSocket.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import Message, User
from src.services import advisor as advisor_service
from src.services import sharing

MAX_MESSAGE_CHARS = 2000
# Số tin gần nhất trả về cho một hội thoại
HISTORY_LIMIT = 200


def _pair(db: Session, user: User, student_id: str) -> tuple[User, User]:
    """(cố vấn, SV) của hội thoại mà người dùng được phép mở."""
    if user.role == "advisor":
        return user, advisor_service.require_student(db, user, student_id)
    if student_id != user.id:
        raise AppError(403, "Bạn không có quyền xem hội thoại này.", "forbidden")
    counselor = sharing.advisor_of(db, user)
    if counselor is None:
        raise AppError(404, "Bạn chưa được phân công cố vấn.", "no_advisor")
    return counselor, user


def _participant(user: User) -> dict[str, Any]:
    is_advisor = user.role == "advisor"
    return {
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "subtitle": (user.title or user.subtitle) if is_advisor else user.subtitle,
        "avatar_url": user.avatar_url,
        "office_hours": user.office_hours if is_advisor else None,
    }


def _message_out(message: Message, user: User) -> dict[str, Any]:
    return {
        "id": message.id,
        "body": message.body,
        "created_at": message.created_at,
        "mine": message.sender_id == user.id,
        "read_at": message.read_at,
    }


def _in_thread(advisor_id: str, student_id: str) -> tuple:
    return Message.advisor_id == advisor_id, Message.student_id == student_id


def _unread_for(user: User) -> tuple:
    """Tin gửi tới người dùng mà họ chưa đọc."""
    return Message.sender_id != user.id, Message.read_at.is_(None)


def _count(db: Session, *conditions) -> int:
    return db.scalar(select(func.count()).select_from(Message).where(*conditions))


def conversations(db: Session, user: User) -> list[dict[str, Any]]:
    """
    Cố vấn: mọi SV phụ trách (kể cả chưa nhắn gì), hội thoại có tin mới nhất trước.
    SV: hội thoại với cố vấn phụ trách (rỗng nếu chưa được phân công).
    """
    if user.role == "advisor":
        pairs = [(user, student) for student in advisor_service.assigned_students(db, user)]
    else:
        counselor = sharing.advisor_of(db, user)
        pairs = [(counselor, user)] if counselor else []

    result = []
    for counselor, student in pairs:
        thread = _in_thread(counselor.id, student.id)
        last = db.scalar(select(Message).where(*thread).order_by(Message.created_at.desc()).limit(1))
        result.append(
            {
                "student_id": student.id,
                "counterpart": _participant(student if user.role == "advisor" else counselor),
                "last_message": _message_out(last, user) if last else None,
                "unread_count": _count(db, *thread, *_unread_for(user)),
            }
        )
    # Sắp xếp ổn định: hội thoại chưa có tin giữ thứ tự theo tên ở cuối danh sách
    result.sort(key=lambda c: c["last_message"]["created_at"] if c["last_message"] else datetime.min, reverse=True)
    return result


def conversation(db: Session, user: User, student_id: str) -> dict[str, Any]:
    """Tối đa 200 tin gần nhất, cũ → mới."""
    counselor, student = _pair(db, user, student_id)
    rows = list(
        db.scalars(
            select(Message)
            .where(*_in_thread(counselor.id, student.id))
            .order_by(Message.created_at.desc())
            .limit(HISTORY_LIMIT)
        )
    )
    rows.reverse()
    return {
        "student_id": student.id,
        "counterpart": _participant(student if user.role == "advisor" else counselor),
        "messages": [_message_out(m, user) for m in rows],
    }


def send(db: Session, user: User, student_id: str, body: str, now: datetime) -> dict[str, Any]:
    counselor, student = _pair(db, user, student_id)
    text = body.strip()
    if not text:
        raise AppError(422, "Hãy nhập nội dung tin nhắn.", "message_required")
    if len(text) > MAX_MESSAGE_CHARS:
        raise AppError(422, f"Tin nhắn tối đa {MAX_MESSAGE_CHARS} ký tự.", "message_too_long")
    message = Message(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        advisor_id=counselor.id,
        student_id=student.id,
        sender_id=user.id,
        body=text,
        created_at=now,
    )
    db.add(message)
    db.commit()
    return _message_out(message, user)


def mark_read(db: Session, user: User, student_id: str, now: datetime) -> None:
    """Đánh dấu đã đọc mọi tin người kia gửi trong hội thoại (người kia thấy "Đã xem")."""
    counselor, student = _pair(db, user, student_id)
    db.execute(update(Message).where(*_in_thread(counselor.id, student.id), *_unread_for(user)).values(read_at=now))
    db.commit()


def unread_count(db: Session, user: User) -> int:
    """Tổng số tin chưa đọc (biểu tượng tin nhắn trên thanh trên cùng)."""
    if user.role == "advisor":
        student_ids = [s.id for s in advisor_service.assigned_students(db, user)]
        return _count(db, Message.advisor_id == user.id, Message.student_id.in_(student_ids), *_unread_for(user))
    counselor = sharing.advisor_of(db, user)
    if counselor is None:
        return 0
    return _count(db, *_in_thread(counselor.id, user.id), *_unread_for(user))
