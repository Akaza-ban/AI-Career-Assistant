"""
Tách toàn văn một JD thành cấu trúc chung (dùng cho JD sinh viên tự dán và JD quản trị viên thêm vào thư viện).

1. Quy tắc (không gọi AI): chia mục theo tiêu đề thường gặp (tiếng Việt / tiếng Anh), đọc các dòng dạng nhãn
   ("Địa điểm:", "Mức lương:"…), nhận cấp bậc / hình thức / nơi làm việc / kinh nghiệm bằng từ khoá, dò kỹ năng theo
   từ điển của thư viện và gán mức quan trọng theo mục chứa kỹ năng.
2. AI (tối đa 1 lần): chỉ khi còn thiếu tên vị trí, mô tả hoặc yêu cầu. Giá trị AI đưa ra mà không có trong JD gốc
   thì bỏ; AI chỉ điền vào trường quy tắc để trống.
"""

import logging
import re
import unicodedata
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from src.services.skill_matching import contains_term

logger = logging.getLogger(__name__)

LEVELS = ("intern", "fresher", "junior")
EMPLOYMENT_TYPES = ("full_time", "part_time", "internship")
WORK_MODES = ("onsite", "remote", "hybrid")
EXPERIENCES = ("none", "under_1", "1_2", "2_plus")
INDUSTRIES = (
    "Công nghệ & phần mềm",
    "Thương mại điện tử",
    "Fintech & ngân hàng",
    "Tài chính – đầu tư",
    "Kế toán – kiểm toán",
    "Truyền thông số",
    "Marketing & bán hàng",
    "Logistics & chuỗi cung ứng",
    "Nhân sự",
    "Giáo dục",
    "Sản xuất",
    "Khác",
)
MAX_TEXT_FIELD = 255


def fold(text: str) -> str:
    """Bỏ dấu, chữ thường: "Mô tả công việc" → "mo ta cong viec"."""
    value = unicodedata.normalize("NFD", text)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return value.replace("đ", "d").replace("Đ", "D").lower()


# ---------- Mục ----------

# Từ khoá tiêu đề (đã bỏ dấu) theo mục; khớp khi tiêu đề bắt đầu bằng một từ khoá
_HEADINGS: list[tuple[str, tuple[str, ...]]] = [
    ("preferred", ("uu tien", "nice to have", "preferred")),
    ("additional", ("diem cong", "cong them", "bonus point", "plus")),
    ("benefits", ("quyen loi", "phuc loi", "che do", "dai ngo", "benefit", "what we offer", "why join")),
    (
        "how_to_apply",
        ("cach ung tuyen", "nop ho so", "ho so ung tuyen", "lien he", "how to apply", "thong tin lien he"),
    ),
    ("requirements", ("yeu cau", "tieu chuan", "bat buoc", "requirement", "qualification", "what we need")),
    ("description", ("mo ta", "trach nhiem", "nhiem vu", "cong viec", "job description", "responsibilit", "what you")),
    ("intro", ("gioi thieu", "ve chung toi", "about us", "about the")),
]
_HEADING_LINE = re.compile(r"^[\s\-–•*#>\d.)]*([^:]{2,60}?)\s*:\s*(.*)$")
_BULLET = re.compile(r"^\s*[-–•*+]\s+")


def _section_of(heading: str) -> str | None:
    key = fold(heading).strip(" *#")
    for kind, words in _HEADINGS:
        if any(key.startswith(w) for w in words):
            return kind
    return None


def split_sections(text: str) -> dict[str, list[str]]:
    """Các dòng của từng mục; dòng trước tiêu đề đầu tiên vào "intro"."""
    sections: dict[str, list[str]] = {}
    current = "intro"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = _HEADING_LINE.match(line)
        kind = _section_of(match.group(1)) if match else None
        if kind is None and len(line) <= 60 and not _BULLET.match(line):
            kind = _section_of(line.rstrip(":"))
            match = None
        if kind is not None:
            current = kind
            rest = match.group(2).strip() if match else ""
            if rest:
                sections.setdefault(current, []).append(rest)
            else:
                sections.setdefault(current, [])
            continue
        sections.setdefault(current, []).append(line)
    return sections


# ---------- Thông tin chung ----------

_LABELS: list[tuple[str, tuple[str, ...]]] = [
    ("title", ("vi tri", "chuc danh", "position", "job title")),
    ("company", ("cong ty", "doanh nghiep", "company")),
    ("location", ("dia diem", "noi lam viec", "dia chi lam viec", "location", "khu vuc")),
    ("salary", ("muc luong", "luong", "thu nhap", "salary")),
    ("deadline", ("han nop", "han chot", "han ung tuyen", "deadline")),
    ("employment_type", ("hinh thuc", "loai hinh", "job type")),
    ("experience", ("kinh nghiem", "experience")),
    ("level", ("cap bac", "level")),
]
_SALARY = re.compile(
    r"(\d+(?:[.,]\d+)?\s*(?:-|–|~|đến|to)\s*\d+(?:[.,]\d+)?\s*(?:triệu|tr\b|million|usd|\$)"
    r"|(?:upto|up to|tới|lên đến)\s*\d+(?:[.,]\d+)?\s*(?:triệu|usd|\$)"
    r"|\$\s?\d[\d,.]*(?:\s*-\s*\$?\s?\d[\d,.]*)?"
    r"|th[oỏ]a thu[aậ]n|negotiable|cạnh tranh)",
    re.IGNORECASE,
)
_DATE = re.compile(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b")


def _labeled(text: str) -> dict[str, str]:
    """Giá trị của các dòng "Nhãn: giá trị" (lấy dòng đầu tiên cho mỗi nhãn)."""
    found: dict[str, str] = {}
    for raw in text.splitlines():
        match = _HEADING_LINE.match(raw.strip())
        if not match or not match.group(2).strip():
            continue
        key = fold(match.group(1)).strip()
        for field, words in _LABELS:
            if field not in found and any(key == w or key.startswith(w + " ") for w in words):
                found[field] = match.group(2).strip()
    return found


def _first(text: str, rules: list[tuple[str, tuple[str, ...]]]) -> str | None:
    folded = fold(text)
    for value, words in rules:
        if any(w in folded for w in words):
            return value
    return None


_LEVEL_RULES = [
    ("intern", ("thuc tap", "intern")),
    ("fresher", ("fresher", "moi tot nghiep", "moi ra truong", "entry level")),
    ("junior", ("junior",)),
]
_EMPLOYMENT_RULES = [
    ("part_time", ("ban thoi gian", "part-time", "part time")),
    ("internship", ("thuc tap", "internship")),
    ("full_time", ("toan thoi gian", "full-time", "full time")),
]
_WORK_MODE_RULES = [
    ("hybrid", ("hybrid", "ket hop", "linh hoat")),
    ("remote", ("remote", "tu xa", "lam viec tai nha", "work from home")),
    ("onsite", ("tai van phong", "onsite", "on-site", "toan thoi gian tai")),
]
_EXPERIENCE_RULES = [
    ("none", ("khong yeu cau kinh nghiem", "chua co kinh nghiem", "khong can kinh nghiem", "no experience")),
    ("under_1", ("duoi 1 nam", "< 1 nam", "6 thang", "duoi mot nam", "less than 1 year")),
    ("1_2", ("1 - 2 nam", "1-2 nam", "1 den 2 nam", "tu 1 nam", "1+ nam", "1 year")),
    ("2_plus", ("2 nam", "3 nam", "2+ nam", "tren 2 nam", "2 years")),
]


def _title_and_company(text: str) -> tuple[str | None, str | None]:
    """Từ dòng đầu: "Công ty A tuyển Business Analyst Intern…" hoặc chỉ tên vị trí."""
    first = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if not first or _section_of(first.rstrip(":")) or _HEADING_LINE.match(first):
        return None, None
    match = re.search(r"^(.{2,80}?)\s+tuyển(?:\s+dụng)?\s+(.+)$", first, re.IGNORECASE)
    if match:
        company, rest = match.group(1).strip(), match.group(2)
        title = re.split(r"\s+(?:làm việc|cho|tại)\s+|[.;]", rest)[0].strip(" -–,")
        return (title[:MAX_TEXT_FIELD] or None), company[:MAX_TEXT_FIELD]
    return (first[:MAX_TEXT_FIELD] if len(first) <= 120 else None), None


def _date_of(value: str) -> date | None:
    match = _DATE.search(value)
    if not match:
        return None
    try:
        return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
    except ValueError:
        return None


def _majors(requirements: str) -> list[str]:
    match = re.search(r"(?:chuyên\s+)?ngành\s+([^.;\n]+)", requirements, re.IGNORECASE)
    if not match:
        return []
    parts = re.split(r",|\bhoặc\b|\bvà\b|/", match.group(1))
    majors = []
    for part in parts:
        name = part.strip(" -–")
        if 2 <= len(name) <= 40 and "liên quan" not in name.lower() and name not in majors:
            majors.append(name[0].upper() + name[1:])
    return majors[:6]


# ---------- Kỹ năng ----------


def _skills(sections: dict[str, list[str]], vocabulary: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    """Kỹ năng trong từ điển; mức quan trọng theo mục chứa kỹ năng (yêu cầu > ưu tiên > điểm cộng > mô tả)."""
    text_of = {k: "\n".join(v) for k, v in sections.items()}
    has_requirements = bool(text_of.get("requirements"))
    order = [
        ("requirements", "required"),
        ("preferred", "preferred"),
        ("additional", "additional"),
        ("description", "preferred"),
        ("intro", "additional"),
    ]
    found = []
    for skill in vocabulary:
        terms = [skill["name"], *skill.get("aliases", [])]
        for section, importance in order:
            body = text_of.get(section, "")
            if body and any(contains_term(t, body) for t in terms):
                found.append(
                    {
                        "name": skill["name"],
                        "importance": importance if has_requirements else "required",
                        "aliases": skill.get("aliases", []),
                    }
                )
                break
    return found, "sections" if has_requirements else "dictionary"


# ---------- Ghép ----------


def _join(lines: list[str]) -> str:
    return "\n".join(line if _BULLET.match(line) else f"- {line}" for line in lines).strip()


def parse_rules(text: str, vocabulary: list[dict[str, Any]]) -> dict[str, Any]:
    """Tách bằng quy tắc; trường không tìm thấy để None / rỗng."""
    content = unicodedata.normalize("NFC", text).replace("\r\n", "\n").strip()
    sections = split_sections(content)
    labeled = _labeled(content)
    title, company = _title_and_company(content)
    title = labeled.get("title") or title
    company = labeled.get("company") or company

    requirement_lines = list(sections.get("requirements", []))
    if sections.get("preferred"):
        requirement_lines += ["Ưu tiên:", *sections["preferred"]]
    if sections.get("additional"):
        requirement_lines += ["Điểm cộng:", *sections["additional"]]
    requirements = "\n".join(
        line if line.endswith(":") or _BULLET.match(line) else f"- {line}" for line in requirement_lines
    ).strip()

    description_lines = list(sections.get("description") or [])
    # Đoạn giới thiệu trước tiêu đề đầu tiên (bỏ dòng tên vị trí và các dòng dạng nhãn) làm đoạn mở đầu của mô tả
    first_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
    intro = [
        line
        for line in sections.get("intro", [])
        if not (title and line == first_line) and not _HEADING_LINE.match(line) and len(line) > 30
    ]
    if not description_lines and not requirements:
        # Không có tiêu đề nào: cả khối vào mô tả để sinh viên tự chia
        description_lines = [line.strip() for line in content.splitlines() if line.strip()]

    location = re.split(r"\s*[·•|]\s*", labeled.get("location", ""))[0].strip() or None
    salary_source = labeled.get("salary") or content
    salary_match = _SALARY.search(salary_source)
    skills, skills_source = _skills(sections, vocabulary)
    head = f"{title or ''}\n{labeled.get('level', '')}"
    return {
        "title": title,
        "company": company,
        "level": _first(head, _LEVEL_RULES) or _first(content, _LEVEL_RULES),
        "industry": None,
        "employment_type": _first(labeled.get("employment_type", ""), _EMPLOYMENT_RULES)
        or _first(content, _EMPLOYMENT_RULES),
        "work_mode": _first(content, _WORK_MODE_RULES),
        "location": location[:MAX_TEXT_FIELD] if location else None,
        "salary": salary_match.group(0).strip()[:120] if salary_match and labeled.get("salary") else None,
        "deadline": _date_of(labeled.get("deadline", "")),
        "experience": _first(labeled.get("experience", "") or requirements, _EXPERIENCE_RULES),
        "majors": _majors(requirements),
        "description": "\n".join([*intro, _join(description_lines)]).strip() or None,
        "requirements": requirements or None,
        "benefits": _join(sections.get("benefits", [])) or None,
        "how_to_apply": _join(sections.get("how_to_apply", [])) or None,
        "skills": skills,
        "skills_source": skills_source,
        "used_ai": False,
    }


# ---------- AI ----------

_AI_FIELDS = ("title", "company", "location", "salary", "description", "requirements", "benefits", "how_to_apply")


def _grounded(value: str, source: str, ratio: float = 0.6) -> bool:
    """Phần lớn từ của value có trong JD gốc (không nhận giá trị AI tự nghĩ ra)."""
    words = [w for w in re.findall(r"\w+", fold(value)) if len(w) > 1]
    if not words:
        return False
    text = fold(source)
    return sum(1 for w in words if w in text) / len(words) >= ratio


async def _with_ai(draft: dict[str, Any], text: str) -> dict[str, Any]:
    from src.services.llm import invoke_json

    prompt = (
        "Bạn tách một tin tuyển dụng (JD) thành các trường. Chỉ chép lại hoặc rút gọn chữ có trong JD, "
        "không tự thêm thông tin; không tìm thấy thì để null. Trả về JSON: "
        '{"title": str|null, "company": str|null, "level": "intern"|"fresher"|"junior"|null, '
        '"location": str|null, "salary": str|null, "description": str|null (gạch đầu dòng), '
        '"requirements": str|null (gạch đầu dòng), "benefits": str|null, "how_to_apply": str|null, '
        '"skills": [{"name": str, "importance": "required"|"preferred"|"additional"}]}\n\nJD:\n' + text[:6000]
    )
    data = await invoke_json(prompt, temperature=0.0, timeout=15.0)
    merged = dict(draft)
    for field in _AI_FIELDS:
        value = data.get(field)
        if not merged.get(field) and isinstance(value, str) and value.strip() and _grounded(value, text):
            merged[field] = value.strip()[: MAX_TEXT_FIELD if field in ("title", "company", "location") else 4000]
    if not merged.get("level") and data.get("level") in LEVELS:
        merged["level"] = data["level"]
    ai_skills = [
        {"name": s["name"].strip(), "importance": s["importance"], "aliases": []}
        for s in data.get("skills") or []
        if isinstance(s, dict)
        and isinstance(s.get("name"), str)
        and s.get("importance") in ("required", "preferred", "additional")
        and contains_term(s["name"].strip(), text)
    ]
    if ai_skills:
        known = {s["name"].lower() for s in merged["skills"]}
        merged["skills"] = merged["skills"] + [s for s in ai_skills if s["name"].lower() not in known]
        merged["skills_source"] = "ai"
    merged["used_ai"] = True
    return merged


def needs_ai(draft: dict[str, Any]) -> bool:
    return not (draft.get("title") and draft.get("description") and draft.get("requirements"))


def library_vocabulary(db: Session) -> list[dict[str, Any]]:
    """Từ điển kỹ năng lấy từ thư viện JD (tên chuẩn + tên gọi khác), không trùng tên."""
    from sqlalchemy import select

    from src.db.models import JobDescription

    seen: dict[str, dict[str, Any]] = {}
    for skills in db.scalars(select(JobDescription.skills).where(JobDescription.source == "library")):
        for s in skills or []:
            entry = seen.setdefault(s["name"].lower(), {"name": s["name"], "aliases": set()})
            entry["aliases"].update(s.get("aliases") or [])
    return [{"name": v["name"], "aliases": sorted(v["aliases"])} for v in seen.values()]


async def parse(db: Session, text: str, *, allow_ai: bool = True) -> dict[str, Any]:
    """Bản nháp đầy đủ các trường (chưa lưu). Gọi AI tối đa một lần khi quy tắc còn thiếu trường chính."""
    draft = parse_rules(text, library_vocabulary(db))
    if allow_ai and needs_ai(draft):
        from src.services.llm import llm_configured

        if llm_configured():
            try:
                draft = await _with_ai(draft, text)
            except Exception as e:  # AI lỗi: giữ kết quả quy tắc
                logger.warning("Tách JD bằng AI thất bại: %s", e)
    return draft
