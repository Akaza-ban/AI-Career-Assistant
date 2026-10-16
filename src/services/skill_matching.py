"""So khớp yêu cầu JD với bằng chứng trong CV và tính CV–JD Matching Score (PRD mục 5.2).

- Trọng số theo mức độ: Required = 3, Preferred = 2, Additional = 1.
- Match: 0 = không xuất hiện trong CV; 0.5 = chỉ liệt kê (mục Kỹ năng, Mục tiêu...), không có mô tả sử dụng;
  0.75 = có câu mô tả đã dùng làm gì (Kinh nghiệm / Dự án / Học vấn / Hoạt động) nhưng chưa có số liệu kết quả;
  1 = có câu mô tả kèm số liệu kết quả, hoặc nằm trong mục Kinh nghiệm làm việc thực tế.
- Score = Σ(w × Match) / Σw × 100.

Phần chấm theo quy tắc ở đây dùng khi không có LLM và để kiểm tra chéo kết quả LLM.
"""

import re
import unicodedata
from functools import lru_cache
from typing import Any, Literal

from src.services.roadmap import get_roadmap_info
from src.services.taxonomy import get_child_skills, get_parent_skill

Importance = Literal["required", "preferred", "additional"]

IMPORTANCE_WEIGHTS: dict[str, int] = {"required": 3, "preferred": 2, "additional": 1}
IMPORTANCE_LABELS: dict[str, str] = {"required": "Bắt buộc", "preferred": "Ưu tiên", "additional": "Bổ trợ"}
MAX_REQUIREMENTS = 20

# Mục có mô tả việc đã làm → đủ làm bằng chứng Match = 1
EVIDENCE_SECTIONS = {"experience", "projects", "education", "activities"}

# Thứ tự quan trọng: từ khoá dài/cụ thể đặt trước để không bị từ khoá ngắn bắt nhầm.
# So khớp sau khi bỏ dấu và khoảng trắng (fold): CV quét OCR hay mất dấu, dính chữ ("KINHNGHIEMLAMVIEC").
_SECTION_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    (
        "experience",
        (
            "kinh nghiệm",
            "quá trình làm việc",
            "experience",
            "work experience",
            "professional experience",
            "relevant experience",
            "working experience",
            "internship experience",
            "work history",
            "employment",
        ),
    ),
    ("projects", ("dự án", "academic projects", "personal projects", "selected projects", "side projects", "project")),
    ("education", ("học vấn", "trình độ học vấn", "education", "academic background", "đào tạo")),
    (
        "activities",
        (
            "hoạt động",
            "ngoại khóa",
            "ngoại khoá",
            "tình nguyện",
            "volunteer",
            "activities",
            "leadership",
            "extracurricular",
            "câu lạc bộ",
        ),
    ),
    (
        "skills",
        (
            "kỹ năng",
            "kĩ năng",
            "skills",
            "công cụ",
            "tools",
            "technical",
            "technologies",
            "ngoại ngữ",
            "ngôn ngữ",
            "languages",
            "language",
            "lĩnh vực chuyên môn",
            "chuyên môn",
        ),
    ),
    (
        "certifications",
        (
            "chứng chỉ",
            "chứng nhận",
            "giải thưởng",
            "thành tích",
            "certifications",
            "certification",
            "certificates",
            "certificate",
            "certificat",
            "awards",
            "award",
            "honors",
            "achievements",
        ),
    ),
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
    (
        "other",
        (
            "sở thích",
            "người tham chiếu",
            "thông tin khác",
            "interests",
            "hobbies",
            "references",
            "additional information",
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
    "other": "Thông tin khác",
}


# ---------- Tách CV thành dòng có gắn mục ----------

# Ký tự đầu dòng bị bỏ khi tách dòng (số dòng chỉ đếm dòng có nội dung)
BULLET_PREFIX = re.compile(r"^[#*\-•●▪+·◦■➢►✓–\s]+")


def fold(text: str) -> str:
    """Bỏ dấu, chữ thường, bỏ khoảng trắng và dấu câu: "KINH NGHIỆM" ≈ "KINHNGHIEM" (OCR mất dấu, dính chữ)."""
    plain = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return "".join(c for c in plain if c.isalnum() and not unicodedata.combining(c)).lower()


_FOLDED_KEYWORDS = [(section, tuple(fold(kw) for kw in keywords)) for section, keywords in _SECTION_KEYWORDS]
_YEAR = re.compile(r"(?:19|20)\d{2}")


def _match_section(clean: str) -> tuple[str | None, bool]:
    """(mục, là tiêu đề riêng một dòng?) nếu dòng mở đầu một mục CV; ngược lại (None, False)."""
    folded = fold(clean)
    for section, keywords in _FOLDED_KEYWORDS:
        for kw in keywords:
            if not folded.startswith(kw):
                continue
            colon = clean.find(":")
            # "Kỹ năng: Python, SQL" — mục viết cùng dòng với nội dung
            if 0 < colon <= 40 and clean[colon + 1 :].strip():
                return section, False
            # "KINH NGHIỆM LÀM VIỆC", "Dự án cá nhân:" — tiêu đề ngắn đứng riêng; dòng có năm là tên một mục con
            # ("Project Manager Intern 06/2024 - 08/2024"), không phải tiêu đề
            if len(clean) <= 40 and not clean.rstrip().endswith(".") and not _YEAR.search(clean):
                return section, True
    # Tiêu đề bị OCR đọc sai một ký tự ("HQC VAN", "SKlLLS"): chỉ xét dòng trông như tiêu đề đứng riêng
    if _looks_like_heading(clean):
        for section, keywords in _FOLDED_KEYWORDS:
            # Viết hoa toàn bộ ("HQC VAN") hoặc gần như chỉ có từ khoá ("Educatlon"); "Skillful leader" thì không
            upper = all(c.isupper() for c in clean if c.isalpha())
            if any(len(kw) >= 5 and (upper or len(folded) <= len(kw) + 1) and _near(folded, kw) for kw in keywords):
                return section, True
    return None, False


def _looks_like_heading(clean: str) -> bool:
    """Dòng ngắn đứng riêng, không năm / số, không kết thúc câu, viết hoa toàn bộ hoặc chỉ 1–4 từ."""
    letters = [c for c in clean if c.isalpha()]
    return (
        bool(letters)
        and len(clean) <= 32
        and not any(c.isdigit() for c in clean)
        and not clean.rstrip().endswith((".", ","))
        and ":" not in clean
        and (all(c.isupper() for c in letters) or len(clean.split()) <= 4)
    )


def _near(folded: str, keyword: str) -> bool:
    """Đầu dòng khớp từ khoá, sai tối đa 1 ký tự (thay, thiếu hoặc thừa); phần còn lại của dòng ngắn."""
    if len(folded) > len(keyword) + 14:
        return False
    for size in (len(keyword) - 1, len(keyword), len(keyword) + 1):
        head = folded[:size]
        if len(head) == size and _edits_at_most_one(head, keyword):
            return True
    return False


def _edits_at_most_one(a: str, b: str) -> bool:
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b, strict=True)) <= 1
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    return any(long_[:i] + long_[i + 1 :] == short for i in range(len(long_)))


def strip_bullet(raw: str) -> str:
    """Nội dung dòng CV sau khi bỏ ký tự đầu dòng (gạch đầu dòng, dấu #, khoảng trắng)."""
    return BULLET_PREFIX.sub("", raw).strip()


def split_cv_lines(text: str) -> list[dict[str, Any]]:
    """Tách CV thành các dòng không rỗng, đánh số từ 1 và gắn mục (section) chứa dòng đó."""
    from src.services.cv_files import clean_stutter_text

    text = clean_stutter_text(text)
    lines: list[dict[str, Any]] = []
    current = "header"
    for raw in text.splitlines():
        clean = strip_bullet(raw)
        if not clean:
            continue
        section, is_heading = _match_section(clean)
        # Dòng đầu tiên chỉ khớp khi bỏ dấu thường là họ tên ("Duan Nguyen" ≠ mục "Dự án")
        lower = clean.lower()
        if not lines and is_heading and not any(lower.startswith(kw) for _, kws in _SECTION_KEYWORDS for kw in kws):
            section, is_heading = None, False
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


MATCH_LEVELS = (0, 0.5, 0.75, 1)
# Ngày tháng, năm: không phải số liệu kết quả
_DATES = re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b|\b\d{1,2}/\d{4}\b|\b(?:19|20)\d{2}\b")


def has_date(text: str) -> bool:
    """Dòng có ngày tháng / năm (thường là dòng tiêu đề một mục: tên dự án, nơi làm việc, thời gian)."""
    return bool(_DATES.search(text))


def has_result_metric(text: str) -> bool:
    """Câu có số liệu (12 endpoint, 30%, 500 người dùng, 3 tháng...), không tính ngày tháng / năm."""
    return bool(re.search(r"\d", _DATES.sub(" ", text)))


def evidence_level(line: dict[str, Any]) -> float:
    """
    Mức tối đa một dòng bằng chứng cho phép: 0,5 nếu chỉ là dòng liệt kê; 1 nếu câu mô tả có số liệu kết quả hoặc nằm
    trong mục Kinh nghiệm làm việc; còn lại 0,75 (đã mô tả việc làm, ví dụ đồ án, nhưng chưa có số liệu).
    """
    if not is_descriptive(line):
        return 0.5
    if has_result_metric(line["text"]) or line.get("block") == "experience":
        return 1
    return 0.75


def is_descriptive(line: dict[str, Any]) -> bool:
    """Dòng mô tả việc đã làm (bằng chứng Match ≥ 0,75)."""
    if line.get("is_heading"):
        return False
    if line["section"] in EVIDENCE_SECTIONS:
        return True
    # CV không có tiêu đề mục: coi câu mô tả dài là bằng chứng
    return line["section"] == "header" and len(line["text"].split()) >= 12


_VIETNAMESE_MARKS = re.compile(r"[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]", re.IGNORECASE)


def has_vietnamese_marks(text: str) -> bool:
    """Có chữ tiếng Việt có dấu; không có thì là tiếng Anh hoặc tiếng Việt OCR mất dấu."""
    return bool(_VIETNAMESE_MARKS.search(text))


def entry_text(line: dict[str, Any], lines_by_no: dict[int, dict[str, Any]]) -> str:
    """
    Toàn bộ mục CV chứa dòng (một dự án / một nơi làm việc): từ dòng tiêu đề có ngày tháng phía trên tới trước tiêu đề
    mục kế tiếp, cùng phần CV. Gợi ý chỉ được nhắc công cụ có trong mục này, không lấy từ danh sách Kỹ năng hay dự
    án khác (tránh gán kỹ năng cho việc không dùng kỹ năng đó).
    """
    texts, no = [line["text"]], line["line_no"]
    up = no - 1
    while (above := lines_by_no.get(up)) and not above.get("is_heading") and above.get("block") == line.get("block"):
        texts.append(above["text"])
        if has_date(above["text"]):
            break
        up -= 1
    down = no + 1
    while (below := lines_by_no.get(down)) and not below.get("is_heading") and below.get("block") == line.get("block"):
        if has_date(below["text"]):
            break
        texts.append(below["text"])
        down += 1
    return " ".join(texts)


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


def _in_entry(line: dict[str, Any]) -> bool:
    """Dòng liệt kê ("Technologies: ...") nằm trong một mục Kinh nghiệm / Dự án..."""
    return line["section"] not in EVIDENCE_SECTIONS and line.get("block") in EVIDENCE_SECTIONS


def evidence_of(line: dict[str, Any]) -> dict[str, Any]:
    # Dòng công nghệ của một dự án hiện "Mục Dự án" (nơi sinh viên tìm thấy nó), không phải "Mục Kỹ năng"
    shown = line["block"] if _in_entry(line) else line["section"]
    return {
        "line_no": line["line_no"],
        "text": line["text"],
        "section": line["section"],
        "section_label": SECTION_LABELS.get(shown, shown),
    }


def listing_note(skill: str, line: dict[str, Any] | None) -> str:
    """Ghi chú cho mức 0,5: kỹ năng mới được liệt kê, nói rõ cần thêm gì để thành bằng chứng."""
    if line is not None and _in_entry(line):
        return f"Có trong dòng công nghệ nhưng chưa có câu mô tả bạn đã dùng {skill} làm gì"
    return (
        f"Chỉ có trong danh sách kỹ năng, chưa có câu nào trong Kinh nghiệm hoặc Dự án mô tả bạn đã dùng {skill} làm gì"
    )


def metric_note(skill: str) -> str:
    """Ghi chú cho mức 0,75: đã có câu mô tả nhưng chưa có số liệu kết quả."""
    return (
        f"Đã có câu mô tả bạn dùng {skill} làm gì nhưng chưa có số liệu kết quả; "
        "thêm con số thật nếu có (thời gian, %, số người dùng)"
    )


def assessment(
    requirement: dict[str, Any], match: float, evidence_line: dict[str, Any] | None, note: str | None, source: str
):
    roadmap_info = get_roadmap_info(requirement.get("name"))
    return {
        "id": requirement["id"],
        "skill": requirement["name"],
        "importance": requirement["importance"],
        "weight": IMPORTANCE_WEIGHTS[requirement["importance"]],
        "match": match,
        # 0,75 vẫn là "đáp ứng" (đã có câu mô tả); ghi chú nhắc thêm số liệu
        "status": "matched" if match >= 0.75 else "partial" if match > 0 else "missing",
        "evidence": evidence_of(evidence_line) if evidence_line and match > 0 else None,
        "note": note,
        "roadmap_url": roadmap_info["roadmap_url"],
        "is_it_supported": roadmap_info["is_it_supported"],
        "roadmap_message": roadmap_info["message"],
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

    # Dòng bằng chứng tốt nhất: có số liệu / kinh nghiệm làm việc > có câu mô tả > chỉ liệt kê
    line, term = max(hits, key=lambda hit: evidence_level(hit[0]))
    match = evidence_level(line)
    notes = []
    if term in child_terms:
        notes.append(f"{term} → tính là {name} (taxonomy)")
    if match == 0.5:
        notes.append(listing_note(name, line))
    elif match == 0.75:
        notes.append(metric_note(name))
    return assessment(requirement, match, line, "; ".join(notes) or None, "rule")


def lift_parents(
    requirements: list[dict[str, Any]],
    assessments: list[dict[str, Any]],
    lines_by_no: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Sau khi kết hợp AI và quy tắc: kỹ năng con (FastAPI) được chấm cao hơn kỹ năng cha (Python) thì nâng kỹ năng cha
    lên cùng mức, dùng chung dòng bằng chứng — tránh bảng ghi "FastAPI ● nhưng Python ◐".
    """
    by_skill = {a["skill"].lower(): a for a in assessments}
    by_id = {r["id"]: r for r in requirements}
    lifted = []
    for item in assessments:
        children = [by_skill.get(c.lower()) for c in get_child_skills(item["skill"])]
        best = max((c for c in children if c and c["match"] > item["match"]), key=lambda c: c["match"], default=None)
        if best is None or item["id"] not in by_id:
            lifted.append(item)
            continue
        line = lines_by_no.get(best["evidence"]["line_no"]) if best.get("evidence") else None
        note = f"{best['skill']} → tính là {item['skill']} (taxonomy)"
        if best["match"] == 0.5:
            note = listing_note(item["skill"], line)
        elif best["match"] == 0.75:
            note = metric_note(item["skill"])
        lifted.append(assessment(by_id[item["id"]], best["match"], line, note, best["source"]))
    return lifted


# ---------- Điểm tổng ----------


def compute_score(assessments: list[dict[str, Any]]) -> tuple[float | None, list[dict[str, Any]]]:
    """CV–JD Matching Score (0.0–100.0%, làm tròn 1 chữ số) và bảng phân rã theo mức độ yêu cầu."""
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

    raw_score = sum(b["earned"] for b in breakdown) / possible * 100
    return round(raw_score, 1), breakdown


def match_label(score: float | None) -> str | None:
    """Nhãn hiển thị: Thấp (< 50), Trung bình (50–74), Cao (≥ 75)."""
    if score is None:
        return None
    return "high" if score >= 75 else "medium" if score >= 50 else "low"
