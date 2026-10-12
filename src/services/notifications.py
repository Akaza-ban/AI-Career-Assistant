"""
Thông báo trong chuông. Tạo khi có sự kiện (nhận xét mới, báo cáo phỏng vấn / phân tích xong, SV chia sẻ buổi
phỏng vấn); SV tắt loại nào trong Cài đặt thì không tạo loại đó. Điểm hiển thị đúng quy tắc DESIGN.md 8.1.
"""

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import Notification, User, utcnow

LIST_LIMIT = 50

# Loại thông báo → khoá công tắc trong Cài đặt của SV (None = luôn gửi)
_PREFERENCE_OF_KIND = {
    "advisor_comment": "advisor_comment",
    "interview_report": "report_ready",
    "gap_analysis": "report_ready",
}


def _enabled(user: User, kind: str) -> bool:
    key = _PREFERENCE_OF_KIND.get(kind)
    if key is None or user.role != "student":
        return True
    prefs = (user.preferences or {}).get("notifications") or {}
    return prefs.get(key, True)


def notify(
    db: Session,
    user: User,
    kind: str,
    title: str,
    body: str = "",
    *,
    action_label: str | None = None,
    action_href: str | None = None,
) -> None:
    """Thêm một thông báo (chưa commit; người gọi commit cùng thay đổi chính)."""
    if not _enabled(user, kind):
        return
    db.add(
        Notification(
            id=f"nt_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            kind=kind,
            title=title[:255],
            body=body,
            action_label=action_label,
            action_href=action_href,
        )
    )


def list_for(db: Session, user: User) -> list[dict[str, Any]]:
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
    )
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "title": n.title,
            "body": n.body,
            "created_at": n.created_at,
            "read": n.read_at is not None,
            "action_label": n.action_label,
            "action_href": n.action_href,
        }
        for n in rows
    ]


def mark_read(db: Session, user: User, notification_id: str) -> None:
    n = db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise AppError(404, "Không tìm thấy thông báo.", "notification_not_found")
    if n.read_at is None:
        n.read_at = utcnow()
        db.commit()


def mark_all_read(db: Session, user: User) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()


def score_text(score: float | None) -> str:
    """Điểm phỏng vấn dạng "3,6 / 5"."""
    return "" if score is None else f"{score:.1f}".replace(".", ",") + " / 5"
