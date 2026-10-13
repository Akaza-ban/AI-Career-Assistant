"""Cài đặt, hồ sơ cá nhân và quyền với dữ liệu của sinh viên (Cài đặt & Quyền riêng tư)."""

from datetime import date
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.config import get_settings
from src.db.models import (
    AdvisorNote,
    AdvisorReview,
    CvEditAudit,
    CvExport,
    CvOptimization,
    CvVersion,
    Feedback,
    GapAnalysis,
    InterviewSession,
    InterviewTurn,
    JobDescription,
    Message,
    Notification,
    SavedJd,
    ShareGrant,
    User,
    utcnow,
)
from src.services import auth, cv_files

DEFAULT_PRIVACY = {"anonymous_contribution": False}
DEFAULT_NOTIFICATIONS = {"advisor_comment": True, "report_ready": True, "weekly_reminder": False, "email": False}


def _prefs(user: User) -> dict[str, dict[str, bool]]:
    stored = user.preferences or {}
    return {
        "privacy": {**DEFAULT_PRIVACY, **(stored.get("privacy") or {})},
        "notifications": {**DEFAULT_NOTIFICATIONS, **(stored.get("notifications") or {})},
    }


def settings_of(db: Session, user: User) -> dict[str, Any]:
    used = db.scalar(select(func.coalesce(func.sum(CvVersion.size_bytes), 0)).where(CvVersion.owner_id == user.id))
    prefs = _prefs(user)
    return {
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "date_of_birth": user.date_of_birth,
        "password_updated_at": user.password_updated_at,
        "consent_accepted_at": user.consent_accepted_at,
        "storage": {
            "used_bytes": int(used or 0),
            "limit_bytes": get_settings().storage_limit_mb * 1024 * 1024,
            "allocated_by": "CareerV",
        },
        "privacy": prefs["privacy"],
        "notifications": prefs["notifications"],
    }


def update_settings(
    db: Session, user: User, privacy: dict[str, bool] | None, notifications: dict[str, bool] | None
) -> dict[str, Any]:
    prefs = _prefs(user)
    for key, value in (privacy or {}).items():
        if key not in DEFAULT_PRIVACY:
            raise AppError(422, f"Không có cài đặt quyền riêng tư '{key}'.", "unknown_setting")
        prefs["privacy"][key] = bool(value)
    for key, value in (notifications or {}).items():
        if key not in DEFAULT_NOTIFICATIONS:
            raise AppError(422, f"Không có cài đặt thông báo '{key}'.", "unknown_setting")
        prefs["notifications"][key] = bool(value)
    user.preferences = prefs
    db.commit()
    return settings_of(db, user)


def update_profile(
    db: Session, user: User, full_name: str | None, phone: str | None, date_of_birth: date | None
) -> dict[str, Any]:
    if full_name is not None:
        user.full_name = auth.check_full_name(full_name)
    if phone is not None:
        user.phone = auth.normalize_phone(phone)
    if date_of_birth is not None:
        user.date_of_birth = auth.check_date_of_birth(date_of_birth)
    db.commit()
    return settings_of(db, user)


def withdraw_consent(db: Session, user: User) -> dict[str, Any]:
    user.consent_accepted_at = None
    db.commit()
    return settings_of(db, user)


def _row(obj: Any, *, skip: tuple[str, ...] = ()) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for column in obj.__table__.columns:
        if column.name in skip:
            continue
        value = getattr(obj, column.name)
        out[column.name] = value.isoformat() if hasattr(value, "isoformat") else value
    return out


def export_data(db: Session, user: User) -> dict[str, Any]:
    """Toàn bộ dữ liệu của SV dạng JSON (không gồm mật khẩu và file CV gốc)."""
    sessions = list(db.scalars(select(InterviewSession).where(InterviewSession.owner_id == user.id)))
    session_ids = [s.id for s in sessions]
    return {
        "exported_at": utcnow().isoformat(),
        "account": _row(user, skip=("password_hash", "failed_logins", "locked_until")),
        "cv_versions": [_row(c) for c in db.scalars(select(CvVersion).where(CvVersion.owner_id == user.id))],
        "pasted_jds": [_row(j) for j in db.scalars(select(JobDescription).where(JobDescription.owner_id == user.id))],
        "saved_jds": [_row(s) for s in db.scalars(select(SavedJd).where(SavedJd.user_id == user.id))],
        "gap_analyses": [_row(a) for a in db.scalars(select(GapAnalysis).where(GapAnalysis.owner_id == user.id))],
        "cv_optimizations": [
            _row(o) for o in db.scalars(select(CvOptimization).where(CvOptimization.owner_id == user.id))
        ],
        "interview_sessions": [_row(s) for s in sessions],
        "interview_turns": [
            _row(t) for t in db.scalars(select(InterviewTurn).where(InterviewTurn.session_id.in_(session_ids)))
        ],
        "advisor_reviews": [
            _row(r) for r in db.scalars(select(AdvisorReview).where(AdvisorReview.student_id == user.id))
        ],
        "messages": [_row(m) for m in db.scalars(select(Message).where(Message.student_id == user.id))],
        "shared_items": [_row(g) for g in db.scalars(select(ShareGrant).where(ShareGrant.owner_id == user.id))],
        "feedback": [_row(f) for f in db.scalars(select(Feedback).where(Feedback.user_id == user.id))],
    }


def delete_all_data(db: Session, user: User) -> None:
    """
    Xoá toàn bộ dữ liệu của SV (CV và file gốc, phân tích, phỏng vấn, chia sẻ, tin nhắn, nhận xét, ghi chú của
    cố vấn về SV, JD tự dán, thông báo). Tài khoản vẫn giữ để SV dùng tiếp; không hoàn tác được.
    """
    for cv in db.scalars(select(CvVersion).where(CvVersion.owner_id == user.id)):
        cv_files.delete_file(user.id, cv.id, cv.file_type)
    session_ids = list(db.scalars(select(InterviewSession.id).where(InterviewSession.owner_id == user.id)))
    db.execute(delete(InterviewTurn).where(InterviewTurn.session_id.in_(session_ids)))
    for model, column in (
        (InterviewSession, InterviewSession.owner_id),
        (CvEditAudit, CvEditAudit.owner_id),
        (CvExport, CvExport.owner_id),
        (CvOptimization, CvOptimization.owner_id),
        (GapAnalysis, GapAnalysis.owner_id),
        (SavedJd, SavedJd.user_id),
        (ShareGrant, ShareGrant.owner_id),
        (Feedback, Feedback.user_id),
        (Notification, Notification.user_id),
        (AdvisorReview, AdvisorReview.student_id),
        (AdvisorNote, AdvisorNote.student_id),
        (Message, Message.student_id),
        (CvVersion, CvVersion.owner_id),
    ):
        db.execute(delete(model).where(column == user.id))
    db.execute(delete(JobDescription).where(JobDescription.owner_id == user.id, JobDescription.source == "pasted"))
    db.commit()
