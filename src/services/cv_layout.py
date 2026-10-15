"""
Bố cục CV sau tối ưu (gọn kiểu Harvard), dựng bằng quy tắc từ các dòng chữ đã trích — không dùng AI, không đổi chữ.

Mỗi dòng được gắn một loại để file DOCX, bản xem trước và bản in trình bày giống nhau:
- name / contact / text: phần đầu (họ tên, liên hệ, đoạn giới thiệu không có tiêu đề)
- entry: dòng tiêu đề một mục có thời gian ("Acme Software | Backend Intern  Jun 2024 – Present") → tên trái, ngày phải
- role: dòng ngắn ngay sau entry (vai trò, ngành học) → in nghiêng
- tech: "Technologies: …", "Công cụ: …" trong Kinh nghiệm / Dự án → in nghiêng đậm
- label: "Nhãn: nội dung" → nhãn in đậm
- bullet: câu mô tả trong Kinh nghiệm / Dự án / Hoạt động, hoặc dòng có ký hiệu đầu dòng
- text: đoạn văn (Giới thiệu, Ngoại ngữ...)
cont = True: nửa sau của một câu bị xuống dòng khi trích PDF / OCR, ghép vào dòng trước khi trình bày.
"""

import re
from typing import Any

from src.services.skill_matching import BULLET_PREFIX, fold, split_cv_lines

_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?"
    r"|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?"
)
_POINT = rf"(?:(?:{_MONTH}|tháng|thg)\s*(?:\d{{1,2}},?\s*)?(?:19|20)\d{{2}}|\d{{1,2}}\s*[/.]\s*(?:19|20)\d{{2}}|(?:19|20)\d{{2}})"
_NOW = r"(?:present|now|current|today|hiện\s*tại|hien\s*tai|đến\s*nay|den\s*nay|nay)"
_SEP = r"\s*(?:[-–—~]|to|until|đến|den)\s*"
_RANGE = rf"(?:{_POINT}(?:{_SEP}(?:{_POINT}|{_NOW}))?)"
# Thời gian ở cuối dòng ("… Sep 2021 – Jun 2025", "… (2022 - 2024)") hoặc đầu dòng có dấu ngăn ("09/2021 - 06/2025: …")
_TRAILING = re.compile(rf"(?<![\w/.])\(?\s*(?P<date>{_RANGE})\s*\)?\s*$", re.IGNORECASE)
_LEADING = re.compile(rf"^\(?\s*(?P<date>{_RANGE})\s*\)?\s*[|:,–—-]\s*(?P<rest>\S.*)$", re.IGNORECASE)
DATE_ONLY = re.compile(rf"^\(?\s*{_RANGE}\s*\)?$", re.IGNORECASE)

MAX_ENTRY_TITLE = 90
MAX_ROLE_CHARS = 80
# Mục có các mục con (tên + thời gian, mô tả bên dưới)
ENTRY_SECTIONS = {"experience", "projects", "activities", "education", "certifications"}
# Mục mà câu mô tả không có ký hiệu đầu dòng vẫn trình bày thành gạch đầu dòng
BULLET_SECTIONS = {"experience", "projects", "activities"}
_TECH_LABELS = (
    "technologies", "technology", "tech stack", "techstack", "tech", "stack", "tools", "tool", "environment",
    "frameworks", "framework", "công nghệ", "công cụ", "kỹ thuật", "môi trường", "ngôn ngữ",
)  # fmt: skip
_LABEL = re.compile(r"^(?P<label>[^:：]{1,32})[:：]\s*(?P<rest>\S.*)$")
_TERMINAL = (".", "!", "?", ";", ":", "…")
# Dòng trước kết thúc bằng các từ này thì dòng sau chắc chắn là phần tiếp của cùng câu
_JOINERS = {
    "and", "or", "the", "a", "an", "of", "for", "to", "in", "on", "with", "by", "from", "at", "as", "using", "via",
    "và", "hoặc", "cho", "của", "với", "các", "những", "bằng", "để", "trong", "từ", "theo", "qua", "tại", "về", "là",
    "va", "cua", "voi", "cac", "nhung", "bang", "de", "trong", "tu", "qua", "tai", "ve", "la",
}  # fmt: skip

_CONTACT_HEADINGS = {
    "contact", "contacts", "contactinfo", "contactinformation", "personalinformation", "personaldetails", "info",
    "lienhe", "thongtinlienhe", "thongtincanhan", "thongtin",
}  # fmt: skip

DEVELOPING_TITLES = {"vi": "Kỹ năng đang phát triển", "en": "Developing Skills"}
SECTION_LABELS_EN = {
    "header": "Profile",
    "experience": "Experience",
    "projects": "Projects",
    "education": "Education",
    "activities": "Activities",
    "skills": "Skills",
    "certifications": "Certifications & Awards",
    "summary": "Summary",
    "other": "Additional Information",
}
_VIET = re.compile("[ĂăÂâĐđÊêÔôƠơƯư" + "".join(chr(c) for c in range(0x1EA0, 0x1EFA)) + "]")


def split_date(text: str) -> tuple[str, str] | None:
    """("Acme Software | Backend Intern", "Jun 2024 – Present") nếu dòng có thời gian ở cuối hoặc đầu dòng."""
    if m := _TRAILING.search(text):
        title = text[: m.start()].rstrip(" \t|,–—-:(")
        if title and re.search(r"[^\W\d_]", title):
            return title, m.group("date").strip()
    if m := _LEADING.match(text):
        return m.group("rest").strip(), m.group("date").strip()
    return None


def _has_marker(raw: str) -> bool:
    prefix = BULLET_PREFIX.match(raw)
    return bool(prefix and prefix.group(0).strip(" \t#"))


def _is_contactish(text: str) -> bool:
    return bool(re.search(r"@|https?://|www\.|\.com|\.vn|linkedin|github|\+?\d[\d .]{7,}\d", text, re.IGNORECASE))


def cv_language(text: str, lines: list[dict[str, Any]]) -> str:
    """ "vi" hoặc "en": theo chữ có dấu; CV quét mất dấu thì theo tiêu đề mục (vd "KINHNGHIEM" vẫn là tiếng Việt)."""
    if len(_VIET.findall(text)) >= 15:
        return "vi"
    vi_heads = ("kinhnghiem", "duan", "hocvan", "kynang", "kinang", "chungchi", "hoatdong", "muctieu", "ngoaingu")
    headings = [fold(line["text"]) for line in lines if line["is_heading"]]
    if any(h.startswith(vi_heads) for h in headings):
        return "vi"
    return "en" if headings else "vi"


def layout_lines(text: str) -> dict[int, dict[str, Any]]:
    """{line_no: {"kind", "date"?, "cont"?}} cho mọi dòng của split_cv_lines(text)."""
    lines = split_cv_lines(text)
    # Thông tin chỉ có ở dòng gốc: ký hiệu đầu dòng, có dòng trống phía trước (ngắt đoạn)
    raw_info: list[tuple[bool, bool]] = []
    blank_before = False
    for raw in text.splitlines():
        if not BULLET_PREFIX.sub("", raw).strip():
            blank_before = True
            continue
        raw_info.append((_has_marker(raw), blank_before))
        blank_before = False

    body_lengths = sorted(len(line["text"]) for line in lines if not line["is_heading"])
    long_len = max(60, body_lengths[int(len(body_lengths) * 0.85)] * 0.8) if body_lengths else 60

    out: dict[int, dict[str, Any]] = {}
    prev: dict[str, Any] | None = None
    prev_kind: str | None = None
    for index, line in enumerate(lines):
        no, clean, block = line["line_no"], line["text"], line["block"]
        marker, blank = raw_info[index] if index < len(raw_info) else (False, False)
        info: dict[str, Any] = {}
        if line["is_heading"]:
            info["kind"] = "heading"
        elif _is_cont(line, prev, prev_kind, marker, blank, long_len):
            info["kind"], info["cont"] = out[prev["line_no"]]["kind"], True
        elif block == "header":
            if no == 1:
                info["kind"] = "name"
            elif fold(clean) in _CONTACT_HEADINGS:
                # Nhãn "CONTACT", "Thông tin liên hệ" ở cột bên: bỏ khi trình bày (dòng liên hệ đã đủ rõ)
                info["kind"] = "heading"
            elif len(clean.split()) >= 12 and not _is_contactish(clean):
                info["kind"] = "text"
            else:
                info["kind"] = "contact"
        else:
            info.update(_classify(clean, block, marker, prev_kind))
        out[no] = info
        if not info.get("cont"):
            prev_kind = info["kind"]
        prev = line
    return out


def _is_cont(
    line: dict[str, Any],
    prev: dict[str, Any] | None,
    prev_kind: str | None,
    marker: bool,
    blank: bool,
    long_len: float,
) -> bool:
    """Nửa sau của câu bị xuống dòng: không có ký hiệu đầu dòng, dòng trước chưa hết câu, cùng mục."""
    if prev is None or marker or blank or prev["is_heading"] or prev["block"] != line["block"]:
        return False
    if prev_kind in ("name", "contact", "entry", "role", "tech", "heading"):
        return False
    before, text = prev["text"].rstrip(), line["text"]
    if before.endswith(_TERMINAL) or _is_contactish(text):
        return False
    first = text[0]
    if first.islower():
        return True
    last_word = before.split()[-1].lower() if before.split() else ""
    # Viết hoa đầu dòng (tên riêng, viết tắt) chỉ ghép khi dòng trước dài sát lề và dừng giữa cụm từ
    return len(before) >= long_len and (before.endswith((",", "-", "&", "/", "(")) or last_word in _JOINERS)


def _classify(text: str, block: str, marker: bool, prev_kind: str | None) -> dict[str, Any]:
    label = _LABEL.match(text)
    label_ok = bool(label and not label.group("rest").startswith("//") and len(label.group("label").split()) <= 4)
    if label_ok and block in BULLET_SECTIONS and fold(label.group("label")) in {fold(t) for t in _TECH_LABELS}:
        return {"kind": "tech"}
    if not marker and block in ENTRY_SECTIONS and (parts := split_date(text)) and len(parts[0]) <= MAX_ENTRY_TITLE:
        return {"kind": "entry", "date": parts[1]}
    if (
        not marker
        and prev_kind == "entry"
        and block in ENTRY_SECTIONS
        and len(text) <= MAX_ROLE_CHARS
        and len(text.split()) <= 12
        and not text.endswith(_TERMINAL)
        and not label_ok
    ):
        return {"kind": "role"}
    if label_ok:
        return {"kind": "label"}
    if marker or block in BULLET_SECTIONS:
        return {"kind": "bullet"}
    return {"kind": "text"}


def is_real_column_split(boxes: list[dict[str, Any]], split_x: float) -> bool:
    """
    Có thật là CV hai cột? Loại hai trường hợp bị nhận nhầm ở CV một cột:
    - cột "bên phải" chỉ là thời gian căn phải ("Sep 2021 – Jun 2025") cùng hàng với tên trường / công ty;
    - câu dài chạy qua vạch chia (khoảng cách hai bên chỉ bằng một dấu cách).
    boxes: {"x0", "x1", "top", "bottom", "text"}.
    """
    # Bên trái gồm cả chữ nằm đè lên vạch chia (câu dài chạy qua vạch)
    left = [b for b in boxes if b["x0"] < split_x]
    right = sorted((b for b in boxes if b["x0"] >= split_x), key=lambda b: (b["top"], b["x0"]))
    rows: list[list[dict[str, Any]]] = []
    for box in right:
        if rows and abs(box["top"] - rows[-1][0]["top"]) <= (box["bottom"] - box["top"]) * 0.5:
            rows[-1].append(box)
        else:
            rows.append([box])
    if not rows:
        return True
    tight = dates = 0
    for row in rows:
        top, bottom = min(b["top"] for b in row), max(b["bottom"] for b in row)
        height = max(1.0, bottom - top)
        beside = [b for b in left if min(bottom, b["bottom"]) - max(top, b["top"]) >= height * 0.5]
        if beside and min(b["x0"] for b in row) - max(b["x1"] for b in beside) < height * 0.8:
            tight += 1
        if DATE_ONLY.match(" ".join(b["text"] for b in sorted(row, key=lambda b: b["x0"])).strip()):
            dates += 1
    return tight < 2 and not (dates >= 2 and dates >= len(rows) * 0.5)
