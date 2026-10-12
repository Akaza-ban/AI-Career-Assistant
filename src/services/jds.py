"""JD tự dán (tạo riêng, dùng lại khi so sánh nhiều vị trí) và JD đã lưu trong Thư viện JD."""

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import JobDescription, SavedJd, User, utcnow
from src.services.gap_analysis import JD_MIN_WORDS
from src.services.skill_matching import contains_term


def _library_skills(db: Session) -> list[dict[str, Any]]:
    """Từ điển kỹ năng lấy từ thư viện JD (tên chuẩn + tên gọi khác), không trùng tên."""
    seen: dict[str, dict[str, Any]] = {}
    for skills in db.scalars(select(JobDescription.skills).where(JobDescription.source == "library")):
        for s in skills or []:
            key = s["name"].lower()
            entry = seen.setdefault(key, {"name": s["name"], "aliases": set()})
            entry["aliases"].update(s.get("aliases") or [])
    return [{"name": v["name"], "aliases": sorted(v["aliases"])} for v in seen.values()]


def _skills_in(text: str, vocabulary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Kỹ năng trong từ điển xuất hiện trong JD; mức yêu cầu chưa rõ nên ghi "required" (phân tích sẽ trích lại bằng LLM)."""
    found = []
    for skill in vocabulary:
        if any(contains_term(term, text) for term in [skill["name"], *skill["aliases"]]):
            found.append({"name": skill["name"], "importance": "required", "aliases": skill["aliases"]})
    return found


def create_pasted(
    db: Session,
    user: User,
    *,
    title: str,
    text: str,
    company: str | None,
    level: str | None,
    industry: str | None,
) -> JobDescription:
    if not title.strip():
        raise AppError(422, "Hãy nhập tiêu đề vị trí tuyển dụng.", "jd_title_required")
    words = len(text.split())
    if words < JD_MIN_WORDS:
        raise AppError(
            422, f"Nội dung JD quá ngắn ({words} từ). Hãy bổ sung tối thiểu {JD_MIN_WORDS} từ.", "jd_too_short"
        )
    jd = JobDescription(
        id=f"jd_{uuid.uuid4().hex[:12]}",
        source="pasted",
        owner_id=user.id,
        title=title.strip(),
        company=(company or "").strip() or None,
        industry=(industry or "").strip() or None,
        level=level,
        content=text.strip(),
        skills=_skills_in(text, _library_skills(db)),
    )
    db.add(jd)
    db.commit()
    return jd


def _visible_jd(db: Session, user: User, jd_id: str) -> JobDescription:
    jd = db.get(JobDescription, jd_id)
    if jd is None or (jd.source == "pasted" and jd.owner_id != user.id):
        raise AppError(404, "Không tìm thấy vị trí.", "jd_not_found")
    return jd


def list_saved(db: Session, user: User) -> list[SavedJd]:
    return list(db.scalars(select(SavedJd).where(SavedJd.user_id == user.id).order_by(SavedJd.created_at.desc())))


def save(db: Session, user: User, jd_id: str) -> SavedJd:
    _visible_jd(db, user, jd_id)
    existing = db.scalar(select(SavedJd).where(SavedJd.user_id == user.id, SavedJd.jd_id == jd_id))
    if existing is not None:
        return existing
    saved = SavedJd(id=f"sj_{uuid.uuid4().hex[:12]}", user_id=user.id, jd_id=jd_id, created_at=utcnow())
    db.add(saved)
    db.commit()
    return saved


def unsave(db: Session, user: User, jd_id: str) -> None:
    db.execute(delete(SavedJd).where(SavedJd.user_id == user.id, SavedJd.jd_id == jd_id))
    db.commit()


def saved_out(saved: SavedJd) -> dict[str, Any]:
    return {"jd_id": saved.jd_id, "saved_at": saved.created_at}
