"""Xử lý file CV tải lên: kiểm tra định dạng/dung lượng, trích văn bản, lưu file gốc (US-SV-01)."""

import io
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.api.errors import AppError
from src.config import get_settings
from src.services import ocr

logger = logging.getLogger(__name__)

# Khớp CV_MAX_BYTES ở frontend/components/student/cv/use-cv-upload.ts
CV_MAX_BYTES = 5 * 1024 * 1024
CV_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}
# Ít hơn ngưỡng này coi như không có lớp văn bản (ví dụ PDF scan ảnh) — US-SV-01 AC2
MIN_TEXT_CHARS = 50


@dataclass
class ExtractedCv:
    file_type: str
    text: str
    page_count: int | None


def file_type_of(file_name: str) -> str:
    """Trả về "pdf" | "docx" | "png" | "jpg" | "jpeg" hoặc báo lỗi 415 nếu sai định dạng (US-SV-01 AC3)."""
    ext = Path(file_name).suffix.lower().lstrip(".")
    if ext not in CV_MEDIA_TYPES:
        raise AppError(415, "Chỉ hỗ trợ file PDF, DOCX hoặc ảnh (PNG, JPG, JPEG).", "unsupported_file_type")
    return ext


def check_size(size: int) -> None:
    if size > CV_MAX_BYTES:
        raise AppError(413, "File vượt quá dung lượng cho phép (tối đa 5MB).", "file_too_large")
    if size == 0:
        raise AppError(422, "File rỗng. Hãy chọn lại file CV.", "cv_not_extractable")


# Chữ tiếng Việt có dấu thường nằm ở font dự phòng riêng (PDF xuất từ Chrome, Canva...). Khi đó cách trích thông
# thường chèn khoảng trắng quanh từng chữ ("PH Ạ M MINH NH Ậ T"); chế độ "layout" đặt chữ theo toạ độ nên đúng hơn.
_VIET_LETTERS = "ĂăÂâĐđÊêÔôƠơƯư" + "".join(chr(c) for c in range(0x1EA0, 0x1EFA))
_ISOLATED_VIET = re.compile(rf"(?<=\S) [{_VIET_LETTERS}] ?(?=\S)")
_VIET = re.compile(rf"[{_VIET_LETTERS}]")


def _split_diacritics(text: str) -> bool:
    """True khi phần lớn chữ có dấu bị tách rời khỏi chữ bên cạnh bởi khoảng trắng."""
    total = len(_VIET.findall(text))
    return total >= 10 and len(_ISOLATED_VIET.findall(text)) / total > 0.3


def _words_to_lines(words: list[dict[str, Any]]) -> str:
    if not words:
        return ""
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines: list[list[dict[str, Any]]] = []
    current_line = [sorted_words[0]]
    for w in sorted_words[1:]:
        ref = current_line[-1]
        line_h = max(ref["bottom"] - ref["top"], w["bottom"] - w["top"])
        if abs(w["top"] - ref["top"]) <= line_h * 0.4:
            current_line.append(w)
        else:
            lines.append(current_line)
            current_line = [w]
    lines.append(current_line)

    result: list[str] = []
    prev_bottom = None
    for line in lines:
        line_sorted = sorted(line, key=lambda w: w["x0"])
        line_text = " ".join(w["text"] for w in line_sorted).strip()
        if not line_text:
            continue
        line_top = min(w["top"] for w in line_sorted)
        line_bottom = max(w["bottom"] for w in line_sorted)
        line_h = max(1.0, line_bottom - line_top)
        if prev_bottom is not None and (line_top - prev_bottom) > line_h * 1.5:
            result.append("")
        result.append(line_text)
        prev_bottom = line_bottom
    return "\n".join(result)


def _find_column_gutter(words: list[dict[str, Any]], width: float) -> float | None:
    best_split = None
    min_crossings = float("inf")
    best_clearance = -1

    for xi in range(int(0.20 * width), int(0.65 * width)):
        sx = float(xi)
        crossings = 0
        min_dist = float("inf")
        left_count = 0
        right_count = 0

        for w in words:
            if w["x0"] < sx < w["x1"]:
                crossings += 1
            elif w["x1"] <= sx:
                left_count += 1
                dist = sx - w["x1"]
                if dist < min_dist:
                    min_dist = dist
            elif w["x0"] >= sx:
                right_count += 1
                dist = w["x0"] - sx
                if dist < min_dist:
                    min_dist = dist

        if left_count >= 10 and right_count >= 10:
            if crossings < min_crossings or (crossings == min_crossings and min_dist > best_clearance):
                min_crossings = crossings
                best_clearance = min_dist
                best_split = sx

    if best_split is not None and min_crossings <= 3:
        return best_split
    return None


def _extract_pdfplumber_page(page: Any) -> str:
    from src.services.skill_matching import _match_section

    words = page.extract_words()
    if not words:
        return (page.extract_text() or "").strip()

    split_x = _find_column_gutter(words, page.width)
    if split_x is None:
        return _words_to_lines(words)

    left_words = [w for w in words if w["x1"] <= split_x]
    right_words = [w for w in words if w["x0"] >= split_x]
    crossing_words = [w for w in words if w["x0"] < split_x < w["x1"]]

    left_text = _words_to_lines(left_words)
    right_text = _words_to_lines(right_words + crossing_words)

    right_lines = [line_str.strip() for line_str in right_text.splitlines() if line_str.strip()]
    header_lines: list[str] = []
    body_right_lines: list[str] = []
    found_section = False

    for line in right_lines:
        sec, is_heading = _match_section(line)
        if (sec or is_heading) and len(header_lines) > 0:
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

    return "\n\n".join(p for p in parts if p.strip()).strip()


def _extract_pdf(data: bytes) -> tuple[str, int]:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise AppError(422, "File PDF đang được đặt mật khẩu. Hãy gỡ mật khẩu rồi tải lại.", "cv_not_extractable")
    except AppError:
        raise
    except Exception:
        pass

    # 1. Trích xuất bằng pdfplumber kết hợp phân tích bố cục đa cột (layout-aware)
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = pdf.pages
            extracted = [_extract_pdfplumber_page(p) for p in pages]
            plumber_text = "\n\n".join(t for t in extracted if t).strip()
            if len("".join(plumber_text.split())) >= MIN_TEXT_CHARS:
                return plumber_text, len(pages)
    except Exception as e:
        logger.debug("pdfplumber trích xuất không thành công, dùng fallback pypdf: %s", e)

    # 2. Dự phòng pypdf khi pdfplumber không khả dụng hoặc văn bản quá ngắn
    reader = PdfReader(io.BytesIO(data))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if _split_diacritics(text):
        layout = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in reader.pages)
        text = "\n".join(" ".join(line.split()) for line in layout.splitlines())
    return text, len(reader.pages)


def _extract_docx(data: bytes) -> str:
    from docx import Document

    document = Document(io.BytesIO(data))
    lines = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            lines.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(lines)


def extract_cv(file_type: str, data: bytes) -> ExtractedCv:
    """Trích văn bản từ CV; tự động kích hoạt OCR khi là file ảnh hoặc PDF scan không có lớp text."""
    try:
        if file_type == "pdf":
            text, page_count = _extract_pdf(data)
            # Nếu PDF không có lớp văn bản hoặc ít hơn MIN_TEXT_CHARS, tự động kích hoạt OCR
            if len("".join(text.split())) < MIN_TEXT_CHARS:
                logger.info(
                    "PDF có ít hơn %d ký tự văn bản. Tiến hành quét OCR qua các trang...", MIN_TEXT_CHARS
                )
                ocr_text, ocr_pages = ocr.ocr_pdf_bytes(data)
                if len("".join(ocr_text.split())) >= MIN_TEXT_CHARS:
                    text = ocr_text
                    page_count = ocr_pages or page_count
        elif file_type in ("png", "jpg", "jpeg"):
            logger.info("Tải lên CV định dạng ảnh (%s). Tiến hành quét OCR...", file_type)
            text = ocr.ocr_image_bytes(data)
            page_count = 1
        else:
            text, page_count = _extract_docx(data), None
    except AppError:
        raise
    except Exception as e:
        logger.warning("Không đọc được file CV (%s): %s", file_type, e)
        raise AppError(
            422, "File bị lỗi hoặc không đúng định dạng. Hãy kiểm tra lại file.", "cv_not_extractable"
        ) from e

    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if len("".join(text.split())) < MIN_TEXT_CHARS:
        raise AppError(
            422,
            "Không trích xuất được nội dung CV. Hãy đảm bảo file có chữ rõ ràng hoặc tải lại bản có lớp văn bản.",
            "cv_not_extractable",
        )
    return ExtractedCv(file_type=file_type, text=text, page_count=page_count)


def build_docx(document: dict, developing_title: str) -> bytes:
    """
    File DOCX bố cục đơn giản cho phiên bản CV đã tối ưu (không giữ được thiết kế của file gốc):
    phần đầu, tiêu đề từng mục, mỗi dòng nội dung là một gạch đầu dòng, cuối cùng là kỹ năng đang phát triển.
    """
    from docx import Document
    from docx.shared import Pt

    doc = Document()
    for index, line in enumerate(document["header"]):
        run = doc.add_paragraph().add_run(line["text"])
        if index == 0:
            run.bold = True
            run.font.size = Pt(16)

    def heading(title: str) -> None:
        run = doc.add_paragraph().add_run(title.upper())
        run.bold = True

    for section in document["sections"]:
        heading(section["title"])
        for line in section["lines"]:
            doc.add_paragraph(line["text"], style="List Bullet")
    if document["developing_skills"]:
        heading(developing_title)
        for skill in document["developing_skills"]:
            doc.add_paragraph(f"{skill['name']}: {skill['note']}", style="List Bullet")

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def stored_path(owner_id: str, cv_id: str, file_type: str) -> Path:
    return Path(get_settings().upload_dir) / owner_id / f"{cv_id}.{file_type}"


def save_file(owner_id: str, cv_id: str, file_type: str, data: bytes) -> None:
    path = stored_path(owner_id, cv_id, file_type)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def delete_file(owner_id: str, cv_id: str, file_type: str) -> None:
    stored_path(owner_id, cv_id, file_type).unlink(missing_ok=True)
