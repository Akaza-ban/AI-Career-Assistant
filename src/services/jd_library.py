"""
Thư viện JD do quản trị viên quản lý: danh sách (kèm lượt dùng), thêm / sửa / ẩn JD, và các JD sinh viên tự dán
gộp theo vị trí – công ty (không kèm tên sinh viên) để "Đưa vào thư viện".
Sau mỗi lần lưu, JD được nạp lại vào kho vector để gợi ý vị trí theo CV dùng đúng dữ liệu mới.
"""

import logging
import threading
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import GapAnalysis, InterviewSession, JobDescription
from src.services import jd_parser, jds

logger = logging.getLogger(__name__)

USAGE_DAYS = 30
# Test tắt việc cập nhật kho vector (tránh ghi JD thử vào data/chroma)
REINDEX = True
STATUSES = ("published", "hidden")


def jd_item(jd: JobDescription) -> dict[str, Any]:
    """Dữ liệu một JD cho kho vector (giống một phần tử của fixtures/jd_library.json)."""
    return {
        "id": jd.id,
        "title": jd.title,
        "company": jd.company or "",
        "industry": jd.industry or "",
        "level": jd.level or "",
        "content": jd.content,
        "skills": jd.skills or [],
    }


def _reindex(jd: JobDescription) -> None:
    """Cập nhật kho vector ở luồng nền (nạp mô hình embedding có thể chậm); lỗi chỉ ghi log."""
    if not REINDEX:
        return
    item, visible = jd_item(jd), jd.status != "hidden"

    def run() -> None:
        try:
            from src.services.jd_store import get_jd_store

            store = get_jd_store()
            if visible:
                store.index_items([item])
            else:
                store.remove([item["id"]])
        except Exception as e:  # kho vector chưa sẵn sàng: lần khởi động sau sẽ nạp lại
            logger.warning("Không cập nhật được kho vector cho %s: %s", item["id"], e)

    threading.Thread(target=run, daemon=True).start()


def _key(title: str, company: str | None) -> str:
    return f"{jd_parser.fold(' '.join(title.split()))}|{jd_parser.fold(' '.join((company or '').split()))}"


# ---------- Danh sách ----------


def _usage(db: Session, since: datetime) -> Counter:
    """Lượt phân tích CV và buổi phỏng vấn (đã hoàn thành) với từng JD trong khoảng thời gian."""
    counts: Counter = Counter()
    for model in (GapAnalysis, InterviewSession):
        rows = db.execute(
            select(model.jd_id, func.count())
            .where(model.status == "completed", model.completed_at >= since)
            .group_by(model.jd_id)
        ).all()
        for jd_id, n in rows:
            counts[jd_id] += n
    return counts


def _library_out(jd: JobDescription, usage: int) -> dict[str, Any]:
    return {
        "id": jd.id,
        "title": jd.title,
        "company": jd.company,
        "industry": jd.industry,
        "level": jd.level,
        "skills": jd.skills or [],
        "status": jd.status or "published",
        "usage_30d": usage,
        "updated_at": jd.updated_at or jd.created_at,
    }


def list_library(db: Session, now: datetime) -> list[dict[str, Any]]:
    usage = _usage(db, now - timedelta(days=USAGE_DAYS))
    rows = db.scalars(select(JobDescription).where(JobDescription.source == "library").order_by(JobDescription.title))
    return [_library_out(jd, usage.get(jd.id, 0)) for jd in rows]


def list_uploaded(db: Session) -> list[dict[str, Any]]:
    """JD sinh viên tự dán gộp theo vị trí – công ty, nhiều sinh viên dán nhất trước. Không kèm tên sinh viên."""
    library = {
        _key(jd.title, jd.company): jd.id
        for jd in db.scalars(select(JobDescription).where(JobDescription.source == "library"))
    }
    promoted = {
        jd.source_jd_id: jd.id
        for jd in db.scalars(select(JobDescription).where(JobDescription.source_jd_id.is_not(None)))
    }
    groups: dict[str, list[JobDescription]] = defaultdict(list)
    pasted = db.scalars(
        select(JobDescription)
        .where(
            JobDescription.source == "pasted",
            (JobDescription.status.is_(None)) | (JobDescription.status != jds.DELETED),
        )
        .order_by(JobDescription.created_at.desc())
    )
    for jd in pasted:
        groups[_key(jd.title, jd.company)].append(jd)
    rows = []
    for key, items in groups.items():
        latest = items[0]
        in_library = library.get(key) or next((promoted[j.id] for j in items if j.id in promoted), None)
        rows.append(
            {
                "sample_jd_id": latest.id,
                "title": latest.title,
                "company": latest.company,
                "level": latest.level,
                "skills": latest.skills or [],
                "student_count": len({j.owner_id for j in items}),
                "last_added_at": latest.created_at,
                "library_jd_id": in_library,
            }
        )
    rows.sort(key=lambda r: (-r["student_count"], -r["last_added_at"].timestamp()))
    return rows


def get_for_admin(db: Session, jd_id: str) -> JobDescription:
    """JD thư viện, hoặc JD sinh viên tự dán để điền sẵn form "Đưa vào thư viện" (API không trả người dán)."""
    jd = db.get(JobDescription, jd_id)
    if jd is None or jd.status == jds.DELETED:
        raise AppError(404, "Không tìm thấy JD.", "jd_not_found")
    return jd


# ---------- Thêm / sửa ----------


def _check_library_skills(skills: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clean = jds.check_skills(skills)
    if not any(s["importance"] == "required" for s in clean):
        raise AppError(422, "Hãy thêm ít nhất một kỹ năng bắt buộc.", "jd_skills_required")
    return clean


def _check_duplicate(db: Session, title: str, company: str | None, jd_id: str | None = None) -> None:
    key = _key(title, company)
    for jd in db.scalars(select(JobDescription).where(JobDescription.source == "library")):
        if jd.id != jd_id and _key(jd.title, jd.company) == key:
            raise AppError(409, "Thư viện đã có vị trí cùng tên và công ty.", "jd_duplicate")


def create_library(
    db: Session,
    fields: dict[str, Any],
    skills: list[dict[str, Any]],
    *,
    text: str | None,
    source_jd_id: str | None,
    now: datetime,
) -> JobDescription:
    clean = jds.check_fields(fields, required=jds.LIBRARY_REQUIRED)
    clean_skills = _check_library_skills(skills)
    _check_duplicate(db, clean["title"], clean.get("company"))
    if source_jd_id is not None:
        source = db.get(JobDescription, source_jd_id)
        if source is None or source.source != "pasted":
            raise AppError(404, "Không tìm thấy JD sinh viên tải lên.", "jd_not_found")
    content = (text or "").strip() or jds.compose_content(clean)
    jds._check_length(content)
    jd = JobDescription(
        id=f"jd-{uuid.uuid4().hex[:10]}",
        source="library",
        content=content,
        skills=clean_skills,
        skills_source="admin",
        status="published",
        source_jd_id=source_jd_id,
        created_at=now,
        updated_at=now,
        **clean,
    )
    db.add(jd)
    db.commit()
    _reindex(jd)
    return jd


def update_library(
    db: Session,
    jd_id: str,
    fields: dict[str, Any],
    skills: list[dict[str, Any]] | None,
    status: str | None,
    now: datetime,
) -> JobDescription:
    jd = db.get(JobDescription, jd_id)
    if jd is None or jd.source != "library":
        raise AppError(404, "Không tìm thấy JD trong thư viện.", "jd_not_found")
    if fields:
        current = {
            f: getattr(jd, f) for f in (*jds.TEXT_FIELDS, *jds.SECTION_FIELDS, *jds.ENUM_FIELDS, "deadline", "majors")
        }
        clean = jds.check_fields({**current, **fields}, required=jds.LIBRARY_REQUIRED)
        _check_duplicate(db, clean["title"], clean.get("company"), jd.id)
        for key, value in clean.items():
            setattr(jd, key, value)
        if any(k in fields for k in jds.SECTION_FIELDS) or "title" in fields:
            jd.content = jds.compose_content({**current, **clean})
    if skills is not None:
        jd.skills = _check_library_skills(skills)
        jd.skills_source = "admin"
    if status is not None:
        if status not in STATUSES:
            raise AppError(422, "Trạng thái không hợp lệ.", "validation_error")
        jd.status = status
    jd.updated_at = now
    db.commit()
    _reindex(jd)
    return jd
