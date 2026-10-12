"""So khớp yêu cầu JD với bằng chứng trong CV và tính CV–JD Matching Score (PRD mục 5.2).

- Trọng số theo mức độ: Required = 3, Preferred = 2, Additional = 1.
- Match: 0 = không xuất hiện trong CV; 0.5 = chỉ liệt kê (mục Kỹ năng, Mục tiêu...), không có mô tả sử dụng;
  1 = có bằng chứng cụ thể trong Kinh nghiệm / Dự án / Học vấn / Hoạt động.
- Score = Σ(w × Match) / Σw × 100.

Phần chấm theo quy tắc ở đây dùng khi không có LLM và để kiểm tra chéo kết quả LLM.
"""

import re
from functools import lru_cache
from typing import Any, Literal

from src.services.taxonomy import get_child_skills, get_parent_skill

Importance = Literal["required", "preferred", "additional"]

IMPORTANCE_WEIGHTS: dict[str, int] = {"required": 3, "preferred": 2, "additional": 1}
IMPORTANCE_LABELS: dict[str, str] = {"required": "Bắt buộc", "preferred": "Ưu tiên", "additional": "Bổ trợ"}
MAX_REQUIREMENTS = 20

# Mục có mô tả việc đã làm → đủ làm bằng chứng Match = 1
EVIDENCE_SECTIONS = {"experience", "projects", "education", "activities"}

# Thứ tự quan trọng: từ khoá dài/cụ thể đặt trước để không bị từ khoá ngắn bắt nhầm.
_SECTION_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("experience", ("kinh nghiệm", "quá trình làm việc", "experience", "work history", "employment")),
    ("projects", ("dự án", "academic projects", "project")),
    ("education", ("học vấn", "trình độ học vấn", "education", "đào tạo")),
    ("activities", ("hoạt động", "ngoại khóa", "ngoại khoá", "tình nguyện", "volunteer", "activities", "câu lạc bộ")),
    ("skills", ("kỹ năng", "kĩ năng", "skills", "công cụ", "tools", "technical", "technologies")),
    ("certifications", ("chứng chỉ", "giải thưởng", "thành tích", "certificat", "certification", "award")),
    (
        "summary",
        (
            "mục tiêu",
            "giới thiệu",
            "tóm tắt",
            "career objective",
            "career",
            "objective",
            "summary",
            "profile",
            "about",
        ),
    ),
]

SECTION_LABELS: dict[str, str] = {
    "header": "Thông tin chung",
    "experience": "Kinh nghiệm",
    "projects": "Dự án",
    "education": "Học vấn",
    "activities": "Hoạt động",
    "skills": "Kỹ năng",
    "certifications": "Chứng chỉ & giải thưởng",
    "summary": "Giới thiệu",
}


# ---------- Tách CV thành dòng có gắn mục ----------

# Ký tự đầu dòng bị bỏ khi tách dòng (số dòng chỉ đếm dòng có nội dung)
BULLET_PREFIX = re.compile(r"^[#*\-•●▪+\s]+")


def _match_section(clean: str) -> tuple[str | None, bool]:
    """(mục, là tiêu đề riêng một dòng?) nếu dòng mở đầu một mục CV; ngược lại (None, False)."""
    lower = clean.lower()
    for section, keywords in _SECTION_KEYWORDS:
        for kw in keywords:
            if not lower.startswith(kw):
                continue
            colon = clean.find(":")
            # "Kỹ năng: Python, SQL" — mục viết cùng dòng với nội dung
            if 0 < colon <= 40 and clean[colon + 1 :].strip():
                return section, False
            # "KINH NGHIỆM LÀM VIỆC", "Dự án cá nhân:" — tiêu đề ngắn đứng riêng
            if len(clean) <= 40 and not clean.rstrip().endswith("."):
                return section, True
    return None, False


def strip_bullet(raw: str) -> str:
    """Nội dung dòng CV sau khi bỏ ký tự đầu dòng (gạch đầu dòng, dấu #, khoảng trắng)."""
    return BULLET_PREFIX.sub("", raw).strip()


def split_cv_lines(text: str) -> list[dict[str, Any]]:
    """Tách CV thành các dòng không rỗng, đánh số từ 1 và gắn mục (section) chứa dòng đó."""
    lines: list[dict[str, Any]] = []
    current = "header"
    for raw in text.splitlines():
        clean = strip_bullet(raw)
        if not clean:
            continue
        section, is_heading = _match_section(clean)
        # "Technologies: React.js, Git" trong một mục Kinh nghiệm / Dự án là dòng liệt kê của mục đó,
        # không mở mục mới: các dòng mô tả phía sau vẫn là bằng chứng của mục đang có.
        if section and (is_heading or current not in EVIDENCE_SECTIONS):
            current = section
        lines.append(
            {
                "line_no": len(lines) + 1,
                "text": clean,
                # section: loại nội dung của chính dòng này (dùng để chấm Match); block: mục CV chứa dòng
                "section": section or current,
                "block": current,
                "is_heading": is_heading,
            }
        )
    return lines


def is_descriptive(line: dict[str, Any]) -> bool:
    """Dòng mô tả việc đã làm (đủ làm bằng chứng Match = 1)."""
    if line.get("is_heading"):
        return False
    if line["section"] in EVIDENCE_SECTIONS:
        return True
    # CV không có tiêu đề mục: coi câu mô tả dài là bằng chứng
    return line["section"] == "header" and len(line["text"].split()) >= 12


# ---------- Chuẩn hoá yêu cầu ----------


def normalize_requirements(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Loại trùng, chuẩn hoá mức độ và gán id r1, r2...; tối đa MAX_REQUIREMENTS."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        name = str(item.get("name", "")).strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        importance = item.get("importance") if item.get("importance") in IMPORTANCE_WEIGHTS else "required"
        aliases = [str(a).strip() for a in item.get("aliases") or [] if str(a).strip()]
        result.append({"id": f"r{len(result) + 1}", "name": name, "importance": importance, "aliases": aliases})
        if len(result) >= MAX_REQUIREMENTS:
            break
    return result


# ---------- Chấm theo quy tắc ----------


@lru_cache(maxsize=512)
def _pattern(term: str) -> re.Pattern[str]:
    return re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.IGNORECASE)


def contains_term(term: str, text: str) -> bool:
    """Có nhắc tới term như một từ riêng (không tính "SQL" trong "PostgreSQL")."""
    return bool(_pattern(term).search(text))


def _mentions(term: str, lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [line for line in lines if not line.get("is_heading") and _pattern(term).search(line["text"])]


def evidence_of(line: dict[str, Any]) -> dict[str, Any]:
    return {
        "line_no": line["line_no"],
        "text": line["text"],
        "section": line["section"],
        "section_label": SECTION_LABELS.get(line["section"], line["section"]),
    }


def assessment(
    requirement: dict[str, Any], match: float, evidence_line: dict[str, Any] | None, note: str | None, source: str
):
    return {
        "id": requirement["id"],
        "skill": requirement["name"],
        "importance": requirement["importance"],
        "weight": IMPORTANCE_WEIGHTS[requirement["importance"]],
        "match": match,
        "status": "matched" if match == 1 else "partial" if match == 0.5 else "missing",
        "evidence": evidence_of(evidence_line) if evidence_line and match > 0 else None,
        "note": note,
        "source": source,
    }


def assess_by_rules(requirement: dict[str, Any], lines: list[dict[str, Any]]) -> dict[str, Any]:
    """Chấm Match cho một yêu cầu bằng cách tìm tên, tên tương đương và kỹ năng con (taxonomy) trong CV."""
    name = requirement["name"]
    direct_terms = [name, *requirement.get("aliases", [])]
    # Taxonomy: CV có FastAPI/Flask/Django thì đáp ứng yêu cầu Python
    child_terms = [c for c in get_child_skills(name) if c.lower() not in {t.lower() for t in direct_terms}]

    hits: list[tuple[dict[str, Any], str]] = []
    for term in direct_terms + child_terms:
        hits.extend((line, term) for line in _mentions(term, lines))

    if not hits:
        parent = get_parent_skill(name)
        siblings = [s for s in get_child_skills(parent) if s.lower() != name.lower()] if parent else []
        found = [s for s in siblings if _mentions(s, lines)]
        note = f"CV có {', '.join(found)} (cùng nhóm {parent}) nhưng chưa có {name}." if found else None
        return assessment(requirement, 0, None, note, "rule")

    descriptive = [(line, term) for line, term in hits if is_descriptive(line)]
    line, term = (descriptive or hits)[0]
    match = 1 if descriptive else 0.5
    notes = []
    if term in child_terms:
        notes.append(f"{term} → tính là {name} (taxonomy)")
    if match == 0.5:
        notes.append("Chỉ được liệt kê, chưa có dự án hoặc kinh nghiệm mô tả việc sử dụng")
    return assessment(requirement, match, line, "; ".join(notes) or None, "rule")


# ---------- Điểm tổng ----------


def compute_score(assessments: list[dict[str, Any]]) -> tuple[float | None, list[dict[str, Any]]]:
    """CV–JD Matching Score (0–100, làm tròn 1 chữ số) và bảng phân rã theo mức độ yêu cầu."""
    breakdown = []
    for importance, weight in IMPORTANCE_WEIGHTS.items():
        items = [a for a in assessments if a["importance"] == importance]
        if not items:
            continue
        breakdown.append(
            {
                "importance": importance,
                "label": IMPORTANCE_LABELS[importance],
                "weight": weight,
                "total": len(items),
                "matched": sum(1 for a in items if a["status"] == "matched"),
                "partial": sum(1 for a in items if a["status"] == "partial"),
                "missing": sum(1 for a in items if a["status"] == "missing"),
                "earned": sum(weight * a["match"] for a in items),
                "possible": weight * len(items),
            }
        )
    possible = sum(b["possible"] for b in breakdown)
    if not possible:
        return None, breakdown
    return round(sum(b["earned"] for b in breakdown) / possible * 100, 1), breakdown


def match_label(score: float | None) -> str | None:
    """Nhãn hiển thị: Thấp (< 50), Trung bình (50–74), Cao (≥ 75)."""
    if score is None:
        return None
    return "high" if score >= 75 else "medium" if score >= 50 else "low"
