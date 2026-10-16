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
    vi_heads = (
        "kinhnghiem",
        "duan",
        "hocvan",
        "kynang",
        "kinang",
        "chungchi",
        "hoatdong",
        "muctieu",
        "ngoaingu",
        "ngonngu",
    )
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
            elif (
                no == 2
                and out.get(1, {}).get("kind") == "name"
                and len(clean.split()) <= 3
                and not _is_contactish(clean)
                and not any(c.isdigit() for c in clean)
            ):
                # Dòng tên thứ hai bị ngắt xuống dòng (ví dụ: PHẠM \n MỸ LINH)
                info["kind"] = "name"
            elif fold(clean) in _CONTACT_HEADINGS:
                # Nhãn "CONTACT", "Thông tin liên hệ" ở cột bên: bỏ khi trình bày (dòng liên hệ đã đủ rõ)
                info["kind"] = "heading"
            elif len(clean.split()) >= 6 and not _is_contactish(clean):
                info["kind"] = "text"
            else:
                info["kind"] = "contact"
        else:
            info.update(_classify(clean, block, marker, prev_kind, blank=blank))
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


def _classify(text: str, block: str, marker: bool, prev_kind: str | None, blank: bool = False) -> dict[str, Any]:
    label = _LABEL.match(text)
    label_ok = bool(label and not label.group("rest").startswith("//") and len(label.group("label").split()) <= 4)
    if label_ok and block in BULLET_SECTIONS and fold(label.group("label")) in {fold(t) for t in _TECH_LABELS}:
        return {"kind": "tech"}
    if not marker and block in ENTRY_SECTIONS:
        if (parts := split_date(text)) and len(parts[0]) <= MAX_ENTRY_TITLE:
            return {"kind": "entry", "date": parts[1]}
        # Dòng tên dự án / công việc không kèm ngày tháng (ví dụ có "|", đứng sau tiêu đề mục, hoặc cách đoạn với mục trước)
        if (
            len(text) <= MAX_ENTRY_TITLE
            and not text.endswith(_TERMINAL)
            and not label_ok
            and ("|" in text or prev_kind in ("heading", None) or (blank and prev_kind in ("bullet", "tech", "role")))
        ):
            return {"kind": "entry", "date": None}
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


_MISREAD_BULLET_RE = re.compile(r"^(?:[·•●∙◦‧«»▪■]\s*|\.\s*(?=[A-ZĐ][a-zà-ỹ])|\.\s+|[eo]\s+(?=[A-ZĐ]))")


def _boxes_to_lines(boxes: list[dict[str, Any]]) -> str:
    """Gom các hộp chữ/từ thành từng dòng theo toạ độ dọc và sắp xếp từ trái qua phải."""
    if not boxes:
        return ""

    boxes_sorted = sorted(boxes, key=lambda b: (b["top"], b["x0"]))
    lines: list[list[dict[str, Any]]] = []
    current_line = [boxes_sorted[0]]

    for b in boxes_sorted[1:]:
        ref = current_line[-1]
        line_h = max(ref["bottom"] - ref["top"], b["bottom"] - b["top"])
        ref_mid = (ref["top"] + ref["bottom"]) / 2.0
        b_mid = (b["top"] + b["bottom"]) / 2.0
        if abs(ref_mid - b_mid) <= line_h * 0.45:
            current_line.append(b)
        else:
            lines.append(current_line)
            current_line = [b]
    lines.append(current_line)

    result: list[str] = []
    prev_bottom = None
    for line in lines:
        line_sorted = sorted(line, key=lambda b: b["x0"])
        line_text = _MISREAD_BULLET_RE.sub("• ", " ".join(b["text"] for b in line_sorted).strip())
        if not line_text:
            continue
        line_top = min(b["top"] for b in line_sorted)
        line_bottom = max(b["bottom"] for b in line_sorted)
        line_h = max(1.0, line_bottom - line_top)
        if prev_bottom is not None and (line_top - prev_bottom) > line_h * 1.5:
            result.append("")
        result.append(line_text)
        prev_bottom = line_bottom
    return "\n".join(result)


def extract_layout_aware_text(boxes: list[dict[str, Any]], width: float, height: float) -> str:
    """
    Chữ của một trang theo thứ tự đọc, từ các hộp chữ (từ của PDF có chữ hoặc dòng OCR): {x0, x1, top, bottom, text}.

    Chia trang theo khoảng trắng (XY-cut): đi từ trên xuống, mỗi lần kiểm tra phần còn lại có cột trắng chạy suốt chiều
    cao không (CV hai cột, bố cục lai nửa dưới chia đôi, ô lồng trong một cột); có thì đọc hết cột trái rồi cột phải,
    mỗi cột lại chia tiếp như vậy; không có thì bóc dải trên cùng ra đọc trước. Cột trắng phải là cột thật
    (is_real_column_split: không phải cột ngày căn phải, không phải câu dài chạy qua). Họ tên (chữ to nhất ở phần
    trên trang) được đưa lên dòng đầu, vì mẫu CV lấy dòng đầu làm họ tên.
    """
    items = [
        {
            "text": str(b.get("text", "")).strip(),
            "x0": float(b.get("x0", b.get("xmin", 0.0))),
            "x1": float(b.get("x1", b.get("xmax", 0.0))),
            "top": float(b.get("top", b.get("ymin", 0.0))),
            "bottom": float(b.get("bottom", b.get("ymax", 0.0))),
        }
        for b in boxes
    ]
    items = [b for b in items if b["text"]]
    if not items:
        return ""
    heights = sorted(b["bottom"] - b["top"] for b in items)
    line_h = max(1.0, heights[len(heights) // 2])
    min_gutter = max(0.8 * line_h, 0.012 * width)
    regions = _reading_order(items, width, line_h, min_gutter, depth=0)
    text = "\n\n".join(t for r in regions if (t := _boxes_to_lines(r).strip()))
    return _name_first(text, items, height)


def _rows(boxes: list[dict[str, Any]], line_h: float) -> int:
    """Số dòng (theo toạ độ dọc) của một nhóm hộp chữ."""
    mids = sorted((b["top"] + b["bottom"]) / 2 for b in boxes)
    return 1 + sum(1 for a, b in zip(mids, mids[1:], strict=False) if b - a > line_h * 0.5)


def _vertical_cut(boxes: list[dict[str, Any]], width: float, line_h: float, min_gutter: float) -> float | None:
    """Cột trắng chạy suốt chiều cao nhóm hộp chữ, chia được thành hai cột thật; ưu tiên cột trắng rộng nhất."""
    spans = sorted((b["x0"], b["x1"]) for b in boxes)
    gaps: list[tuple[float, float]] = []
    reach = spans[0][1]
    for x0, x1 in spans[1:]:
        if x0 - reach >= min_gutter:
            gaps.append((x0 - reach, (x0 + reach) / 2))
        reach = max(reach, x1)
    for _, x in sorted(gaps, reverse=True):
        if not 0.15 * width <= x <= 0.85 * width:
            continue
        left = [b for b in boxes if (b["x0"] + b["x1"]) / 2 < x]
        right = [b for b in boxes if (b["x0"] + b["x1"]) / 2 >= x]
        if (
            len(left) >= 3
            and len(right) >= 3
            and _rows(left, line_h) >= 2
            and _rows(right, line_h) >= 2
            and is_real_column_split(boxes, x)
        ):
            return x
    return None


def _top_band(boxes: list[dict[str, Any]], line_h: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Tách dải trên cùng: các hộp chữ phía trên khoảng trắng ngang đầu tiên (giữa hai dòng)."""
    ordered = sorted(boxes, key=lambda b: b["top"])
    bottom = ordered[0]["bottom"]
    for k in range(1, len(ordered)):
        if ordered[k]["top"] > bottom + line_h * 0.15:
            return ordered[:k], ordered[k:]
        bottom = max(bottom, ordered[k]["bottom"])
    return ordered, []


def _reading_order(
    boxes: list[dict[str, Any]], width: float, line_h: float, min_gutter: float, depth: int
) -> list[list[dict[str, Any]]]:
    regions: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    rest = boxes
    while rest:
        cut = _vertical_cut(rest, width, line_h, min_gutter) if depth < 6 else None
        if cut is not None:
            if current:
                regions.append(current)
                current = []
            left = [b for b in rest if (b["x0"] + b["x1"]) / 2 < cut]
            right = [b for b in rest if (b["x0"] + b["x1"]) / 2 >= cut]
            regions += _reading_order(left, width, line_h, min_gutter, depth + 1)
            regions += _reading_order(right, width, line_h, min_gutter, depth + 1)
            break
        band, rest = _top_band(rest, line_h)
        current += band
    if current:
        regions.append(current)
    return regions


def _name_like(text: str) -> bool:
    """Họ tên: 2–6 từ, gần như toàn chữ cái (không phải "XXX", số điện thoại hay dòng liên hệ)."""
    words = text.split()
    chars = [c for c in text if not c.isspace()]
    return 2 <= len(words) <= 6 and sum(c.isalpha() for c in chars) >= 0.85 * len(chars)


_NOT_A_NAME = {"curriculumvitae", "resume", "cv", "hoso", "sơyeulylich", "soyeulylich"}


def _name_first(text: str, boxes: list[dict[str, Any]], height: float) -> str:
    """Đưa dòng chứa chữ to nhất ở 35% trên của trang (thường là họ tên) lên đầu nếu nó chưa ở đầu."""
    from src.services.skill_matching import _match_section

    # Không chọn tiêu đề mục ("HỌC VẤN" có khung chữ cao vì phần dấu) hay dòng liên hệ làm họ tên
    top = [
        b
        for b in boxes
        if b["top"] <= height * 0.35
        and _name_like(b["text"])
        and not _match_section(b["text"])[1]
        and not _is_contactish(b["text"])
    ]
    if not top:
        return text
    tallest = max(top, key=lambda b: b["bottom"] - b["top"])
    heights = sorted(b["bottom"] - b["top"] for b in boxes)
    if tallest["bottom"] - tallest["top"] < heights[len(heights) // 2] * 1.3:
        return text  # không có chữ nào to hẳn: không đoán
    if fold(tallest["text"]) in _NOT_A_NAME:
        return text
    lines = text.splitlines()
    idx = next((i for i, line in enumerate(lines) if tallest["text"] in line), None)
    first = next((i for i, line in enumerate(lines) if line.strip()), None)
    if idx is None or idx == first:
        return text
    name = lines.pop(idx)
    return "\n".join([name, *lines])
