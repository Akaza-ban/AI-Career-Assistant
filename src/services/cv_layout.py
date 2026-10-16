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


def extract_layout_aware_text(
    boxes: list[dict[str, Any]],
    width: float,
    height: float,
) -> str:
    """
    Trích xuất văn bản từ danh sách bounding boxes theo đúng thứ tự đọc tự nhiên (Reading Order).
    Hỗ trợ xử lý:
    1. Bố cục 1 cột toàn trang.
    2. Bố cục 2 cột toàn trang (Sidebar trái + Cột chính phải).
    3. Bố cục lai (Hybrid Layout): nửa trên 1 cột (Header, Kinh nghiệm làm việc toàn chiều rộng),
       nửa dưới chia thành 2 box song song (Học vấn bên trái, Kỹ năng bên phải).
    """
    if not boxes:
        return ""

    # Chuẩn hoá toạ độ boxes
    norm_boxes: list[dict[str, Any]] = []
    for b in boxes:
        t = str(b.get("text", "")).strip()
        if not t:
            continue
        x0 = float(b.get("x0", b.get("xmin", 0.0)))
        x1 = float(b.get("x1", b.get("xmax", 0.0)))
        top = float(b.get("top", b.get("ymin", 0.0)))
        bottom = float(b.get("bottom", b.get("ymax", 0.0)))
        norm_boxes.append(
            {
                "text": t,
                "x0": x0,
                "x1": x1,
                "top": top,
                "bottom": bottom,
            }
        )

    if not norm_boxes:
        return ""

    # 1. Gom boxes thành các dòng vật lý
    boxes_sorted = sorted(norm_boxes, key=lambda b: (b["top"], b["x0"]))
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
            lines.append(sorted(current_line, key=lambda it: it["x0"]))
            current_line = [b]
    if current_line:
        lines.append(sorted(current_line, key=lambda it: it["x0"]))

    # 2. Phân tích từng dòng vật lý
    line_infos: list[dict[str, Any]] = []
    min_gutter = max(24.0, width * 0.04)

    for line in lines:
        l_x0 = min(b["x0"] for b in line)
        l_x1 = max(b["x1"] for b in line)
        l_top = min(b["top"] for b in line)
        l_bottom = max(b["bottom"] for b in line)
        line_text = " ".join(b["text"] for b in line)

        # Tìm các khoảng trống ngăn đôi (gaps) trong dòng
        gaps: list[tuple[float, float, float, float]] = []
        for idx in range(len(line) - 1):
            gap_w = line[idx + 1]["x0"] - line[idx]["x1"]
            gap_mid = (line[idx]["x1"] + line[idx + 1]["x0"]) / 2.0
            if gap_w >= min_gutter and (0.22 * width <= gap_mid <= 0.70 * width):
                gaps.append((gap_mid, gap_w, line[idx]["x1"], line[idx + 1]["x0"]))

        line_infos.append(
            {
                "words": line,
                "text": line_text,
                "x0": l_x0,
                "x1": l_x1,
                "top": l_top,
                "bottom": l_bottom,
                "gaps": gaps,
            }
        )

    # 3. Phân đoạn trang thành các dải (bands)
    bands: list[tuple[str, int, int, float | None]] = []
    i = 0
    n = len(line_infos)

    while i < n:
        best_zone: tuple[int, int, float] | None = None

        # Thu thập các ứng viên vạch chia split_x trong khoảng [0.22 * width, 0.68 * width]
        candidates: set[float] = set()
        for lookahead in range(i, min(i + 4, n)):
            for g_mid, _, g_x0, g_x1 in line_infos[lookahead]["gaps"]:
                if 0.22 * width <= g_mid <= 0.68 * width:
                    candidates.add(round(g_mid / 5.0) * 5.0)
                    # Thêm cả các điểm gần mép rãnh chia
                    candidates.add(round((g_x0 + 10.0) / 5.0) * 5.0)
                    candidates.add(round((g_x1 - 10.0) / 5.0) * 5.0)

        for sx in sorted(candidates):
            if not (0.22 * width <= sx <= 0.68 * width):
                continue
            j = i
            has_split_line = False
            left_words: list[dict[str, Any]] = []
            right_words: list[dict[str, Any]] = []
            zone_words: list[dict[str, Any]] = []

            while j < n:
                lj = line_infos[j]
                # Nếu có từ đè ngang qua vạch chia sx
                line_crossing = any(w["x0"] < sx - 4 and w["x1"] > sx + 4 for w in lj["words"])
                if line_crossing:
                    break

                w_left = [w for w in lj["words"] if w["x1"] <= sx + 5]
                w_right = [w for w in lj["words"] if w["x0"] >= sx - 5]

                if w_left and w_right:
                    gap = min(w["x0"] for w in w_right) - max(w["x1"] for w in w_left)
                    if gap < min_gutter:
                        # Dòng chữ liên tục chạy qua vạch chia -> kết thúc vùng 2 cột
                        break
                    has_split_line = True

                left_words.extend(w_left)
                right_words.extend(w_right)
                zone_words.extend(lj["words"])
                j += 1

            num_lines = j - i
            if left_words and right_words:
                left_w = max(w["x1"] for w in left_words) - min(w["x0"] for w in left_words)
                right_w = max(w["x1"] for w in right_words) - min(w["x0"] for w in right_words)
            else:
                left_w = right_w = 0.0

            if (
                num_lines >= 2
                and has_split_line
                and len(left_words) >= 3
                and len(right_words) >= 3
                and left_w >= 0.18 * width
                and right_w >= 0.18 * width
            ):
                zone_boxes = [
                    {"x0": w["x0"], "x1": w["x1"], "top": w["top"], "bottom": w["bottom"], "text": w["text"]}
                    for w in zone_words
                ]
                if is_real_column_split(zone_boxes, sx):
                    if best_zone is None or num_lines > (best_zone[1] - best_zone[0]):
                        best_zone = (i, j, sx)

        if best_zone is not None and (best_zone[1] - best_zone[0]) >= 2:
            start_z, end_z, split_x = best_zone
            bands.append(("two_column", start_z, end_z, split_x))
            i = end_z
        else:
            start_s = i
            while i < n:
                has_next_two_col = False
                if i > start_s:
                    for lookahead in range(i, min(i + 2, n)):
                        if line_infos[lookahead]["gaps"]:
                            has_next_two_col = True
                            break
                if has_next_two_col and i > start_s:
                    break
                i += 1
            bands.append(("single", start_s, i, None))

    # 4. Trích xuất text từng band
    from src.services.skill_matching import _match_section

    extracted_parts: list[str] = []
    for b_type, b_start, b_end, split_x in bands:
        b_lines = line_infos[b_start:b_end]
        b_words = [w for lj in b_lines for w in lj["words"]]
        if not b_words:
            continue

        if b_type == "two_column" and split_x is not None:
            left_words = [w for w in b_words if w["x1"] <= split_x + 5]
            right_words = [w for w in b_words if w["x0"] >= split_x - 5]

            left_text = _boxes_to_lines(left_words)
            right_text = _boxes_to_lines(right_words)

            band_top = min(w["top"] for w in b_words)
            # Nếu là 2-column sidebar ở nửa trên trang (y <= 0.25 * height),
            # kiểm tra header lines ở đỉnh cột phải (tên ứng viên, chức danh ngắn) để đưa lên đầu
            if band_top <= 0.25 * height:
                right_lines = [line_str.strip() for line_str in right_text.splitlines() if line_str.strip()]
                header_lines: list[str] = []
                body_right_lines: list[str] = []
                found_section = False

                for line in right_lines:
                    sec, is_heading = _match_section(line)
                    # Nếu là heading, hoặc câu dài (>= 6 từ), hoặc kết thúc bằng dấu chấm -> bắt đầu thân bài cột phải!
                    if is_heading or len(line.split()) >= 6 or line.endswith("."):
                        found_section = True

                    if not found_section and len(header_lines) < 3:
                        header_lines.append(line)
                    else:
                        body_right_lines.append(line)

                parts: list[str] = []
                if header_lines:
                    parts.append("\n".join(header_lines))
                if left_text.strip():
                    parts.append(left_text.strip())
                if body_right_lines:
                    parts.append("\n".join(body_right_lines))
                combined = "\n\n".join(p for p in parts if p.strip()).strip()
                if combined:
                    extracted_parts.append(combined)
            else:
                # Vùng 2 cột cục bộ (ví dụ: Box Học vấn bên trái & Box Kỹ năng bên phải)
                if left_text.strip():
                    extracted_parts.append(left_text.strip())
                if right_text.strip():
                    extracted_parts.append(right_text.strip())
        else:
            text_s = _boxes_to_lines(b_words)
            if text_s.strip():
                extracted_parts.append(text_s.strip())

    return "\n\n".join(extracted_parts).strip()
