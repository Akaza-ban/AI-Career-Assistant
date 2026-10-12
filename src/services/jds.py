"""
JD theo cấu trúc chung (thư viện và JD sinh viên tự dán) và JD đã lưu trong Thư viện JD.

- JD tự dán: chỉ người dán thấy. Bắt buộc tên vị trí, cấp bậc, mô tả, yêu cầu; các trường khác không bắt buộc.
- JD thư viện: quản trị viên thêm / sửa (src/services/jd_library.py), bắt buộc nhiều trường hơn và ít nhất 1 kỹ năng
  bắt buộc. Ẩn thay vì xoá để các lượt phân tích, phỏng vấn cũ vẫn mở được.
"""

import re
import uuid
from datetime import date
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.db.models import JobDescription, SavedJd, User, utcnow
from src.services import jd_parser
from src.services.gap_analysis import JD_MIN_WORDS
from src.services.skill_matching import contains_term

# Trường của cấu trúc chung (ngoài kỹ năng)
TEXT_FIELDS = ("title", "company", "industry", "location", "salary")
SECTION_FIELDS = ("description", "requirements", "benefits", "how_to_apply")
ENUM_FIELDS = {
    "level": jd_parser.LEVELS,
    "employment_type": jd_parser.EMPLOYMENT_TYPES,
    "work_mode": jd_parser.WORK_MODES,
    "experience": jd_parser.EXPERIENCES,
}
STUDENT_REQUIRED = ("title", "level", "description", "requirements")
LIBRARY_REQUIRED = (
    *STUDENT_REQUIRED,
    "company",
    "industry",
    "employment_type",
    "work_mode",
    "location",
    "experience",
)
FIELD_LABELS = {
    "title": "tên vị trí",
    "company": "công ty",
    "level": "cấp bậc",
    "industry": "ngành",
    "employment_type": "hình thức",
    "work_mode": "nơi làm việc",
    "location": "địa điểm",
    "experience": "kinh nghiệm",
    "description": "mô tả công việc",
    "requirements": "yêu cầu ứng viên",
}
IMPORTANCES = ("required", "preferred", "additional")
MAX_SKILLS = 30
DELETED = "deleted"


def _clean(value: Any, limit: int) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split()) if limit <= 255 else str(value).strip()
    return text[:limit] or None


def check_fields(data: dict[str, Any], *, required: tuple[str, ...]) -> dict[str, Any]:
    """Chuẩn hoá các trường có trong data (bỏ qua trường không gửi) và báo trường bắt buộc còn trống."""
    out: dict[str, Any] = {}
    for field in TEXT_FIELDS:
        if field in data:
            out[field] = _clean(data[field], 120 if field == "salary" else 255)
    for field in SECTION_FIELDS:
        if field in data:
            out[field] = _clean(data[field], 8000)
    for field, allowed in ENUM_FIELDS.items():
        if field in data:
            if data[field] not in (None, *allowed):
                raise AppError(422, f"Giá trị {FIELD_LABELS.get(field, field)} không hợp lệ.", "validation_error")
            out[field] = data[field]
    if "industry" in required and out.get("industry") and out["industry"] not in jd_parser.INDUSTRIES:
        raise AppError(422, "Hãy chọn ngành trong danh sách.", "validation_error")
    if "deadline" in data:
        out["deadline"] = data["deadline"] if isinstance(data["deadline"], date) or data["deadline"] is None else None
    if "majors" in data:
        majors = [m for m in (_clean(m, 60) for m in data["majors"] or []) if m]
        out["majors"] = list(dict.fromkeys(majors))[:10] or None
    missing = [f for f in required if not out.get(f)]
    if missing:
        names = ", ".join(FIELD_LABELS[f] for f in missing)
        raise AppError(422, f"Hãy điền {names}.", "jd_fields_required")
    return out


def check_skills(skills: list[dict[str, Any]] | None, text: str | None = None) -> list[dict[str, Any]]:
    """Kỹ năng hợp lệ, không trùng tên. Có text: chỉ giữ kỹ năng có nhắc trong JD (chặn kỹ năng tự thêm từ client)."""
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for s in skills or []:
        name = _clean(s.get("name"), 80)
        if not name or name.lower() in seen or s.get("importance") not in IMPORTANCES:
            continue
        aliases = [a for a in (_clean(a, 80) for a in s.get("aliases") or []) if a][:10]
        if text is not None and not any(contains_term(t, text) for t in [name, *aliases]):
            continue
        seen.add(name.lower())
        result.append({"name": name, "importance": s["importance"], "aliases": aliases})
    return result[:MAX_SKILLS]


def compose_content(fields: dict[str, Any]) -> str:
    """Toàn văn dựng lại từ các mục (JD quản trị viên nhập theo từng trường, không dán toàn văn)."""
    parts = [fields.get("title") or ""]
    for label, key in (
        ("Mô tả công việc", "description"),
        ("Yêu cầu ứng viên", "requirements"),
        ("Quyền lợi", "benefits"),
        ("Cách ứng tuyển", "how_to_apply"),
    ):
        if fields.get(key):
            parts.append(f"{label}:\n{fields[key]}")
    return "\n\n".join(p for p in parts if p).strip()


def word_count(text: str) -> int:
    return len(re.findall(r"\w+", text))


def _check_length(text: str) -> None:
    words = len(text.split())
    if words < JD_MIN_WORDS:
        raise AppError(
            422, f"Nội dung JD quá ngắn ({words} từ). Hãy bổ sung tối thiểu {JD_MIN_WORDS} từ.", "jd_too_short"
        )


# ---------- JD sinh viên tự dán ----------


def create_pasted(
    db: Session, user: User, text: str, fields: dict[str, Any] | None = None, *, reviewed: bool = False
) -> JobDescription:
    """
    Lưu JD tự dán theo cấu trúc chung. reviewed = sinh viên đã xem lại các trường ở bước 2 (bắt buộc đủ tên vị trí,
    cấp bậc, mô tả, yêu cầu); dán ở màn So sánh / Phân tích thì chỉ cần tên vị trí, phần còn lại tự tách bằng quy tắc.
    Trường client không gửi lấy từ kết quả tách.
    """
    content = text.strip()
    _check_length(content)
    draft = jd_parser.parse_rules(content, jd_parser.library_vocabulary(db))
    data = {**draft, **{k: v for k, v in (fields or {}).items() if k not in ("skills", "skills_source")}}
    if not data.get("description") and not data.get("requirements"):
        data["description"] = content
    clean = check_fields(data, required=STUDENT_REQUIRED if reviewed else ("title",))
    given = check_skills((fields or {}).get("skills"), content) if fields and fields.get("skills") else None
    skills = given if given else draft["skills"]
    source = (fields or {}).get("skills_source") if given else draft["skills_source"]
    jd = JobDescription(
        id=f"jd_{uuid.uuid4().hex[:12]}",
        source="pasted",
        owner_id=user.id,
        content=content,
        skills=skills,
        skills_source=source if source in ("dictionary", "sections", "ai") else "dictionary",
        **clean,
    )
    db.add(jd)
    db.commit()
    return jd


def own_pasted(db: Session, user: User, jd_id: str) -> JobDescription:
    jd = db.get(JobDescription, jd_id)
    if jd is None or jd.source != "pasted" or jd.owner_id != user.id or jd.status == DELETED:
        raise AppError(404, "Không tìm thấy JD.", "jd_not_found")
    return jd


def update_pasted(db: Session, user: User, jd_id: str, fields: dict[str, Any]) -> JobDescription:
    """Sửa các trường (không tách lại). Kỹ năng giữ nguyên."""
    jd = own_pasted(db, user, jd_id)
    current = {f: getattr(jd, f) for f in (*TEXT_FIELDS, *SECTION_FIELDS, *ENUM_FIELDS, "deadline", "majors")}
    clean = check_fields({**current, **fields}, required=STUDENT_REQUIRED)
    for key, value in clean.items():
        setattr(jd, key, value)
    db.commit()
    return jd


def delete_pasted(db: Session, user: User, jd_id: str) -> None:
    """Ẩn khỏi danh sách (các lượt phân tích, phỏng vấn đã làm với JD này vẫn mở được) và bỏ khỏi Đã lưu."""
    jd = own_pasted(db, user, jd_id)
    jd.status = DELETED
    db.execute(delete(SavedJd).where(SavedJd.user_id == user.id, SavedJd.jd_id == jd_id))
    db.commit()


def list_pasted(db: Session, user: User) -> list[JobDescription]:
    return list(
        db.scalars(
            select(JobDescription)
            .where(
                JobDescription.source == "pasted",
                JobDescription.owner_id == user.id,
                (JobDescription.status.is_(None)) | (JobDescription.status != DELETED),
            )
            .order_by(JobDescription.created_at.desc())
        )
    )


def published_library(db: Session) -> list[JobDescription]:
    return list(
        db.scalars(
            select(JobDescription)
            .where(
                JobDescription.source == "library",
                (JobDescription.status.is_(None)) | (JobDescription.status == "published"),
            )
            .order_by(JobDescription.title)
        )
    )


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


# ---------- Điền cấu trúc cho dữ liệu cũ ----------


def backfill_structure(db: Session) -> int:
    """JD tạo trước khi có cấu trúc chung (chưa có mô tả): tách toàn văn bằng quy tắc (không gọi AI)."""
    rows = list(db.scalars(select(JobDescription).where(JobDescription.description.is_(None))))
    if not rows:
        return 0
    vocabulary = jd_parser.library_vocabulary(db)
    for jd in rows:
        draft = jd_parser.parse_rules(jd.content, vocabulary)
        for field in (*SECTION_FIELDS, "employment_type", "work_mode", "location", "salary", "deadline", "experience"):
            if getattr(jd, field) is None and draft.get(field) is not None:
                setattr(jd, field, draft[field])
        if not jd.majors and draft["majors"]:
            jd.majors = draft["majors"]
        if not jd.level and draft["level"]:
            jd.level = draft["level"]
        if not jd.description and not jd.requirements:
            jd.description = jd.content
        if jd.skills_source is None:
            if jd.source == "library":
                jd.skills_source = "admin"
            elif not jd.skills:
                jd.skills, jd.skills_source = draft["skills"], draft["skills_source"]
            else:
                # Kỹ năng đã có từ lượt phân tích (có mức ưu tiên / cộng thêm) hay chỉ từ từ điển (toàn bắt buộc)
                graded = any(s.get("importance") != "required" for s in jd.skills)
                jd.skills_source = "analysis" if graded else "dictionary"
    db.commit()
    return len(rows)
