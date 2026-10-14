"""Xử lý file CV tải lên: kiểm tra định dạng/dung lượng, trích văn bản, lưu file gốc (US-SV-01)."""

import io
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from src.api.errors import AppError
from src.config import get_settings

logger = logging.getLogger(__name__)

# Khớp CV_MAX_BYTES ở frontend/components/student/cv/use-cv-upload.ts
CV_MAX_BYTES = 5 * 1024 * 1024
CV_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
# Ít hơn ngưỡng này coi như không có lớp văn bản (ví dụ PDF scan ảnh) — US-SV-01 AC2
MIN_TEXT_CHARS = 50


@dataclass
class ExtractedCv:
    file_type: str
    text: str
    page_count: int | None


def file_type_of(file_name: str) -> str:
    """Trả về "pdf" | "docx" hoặc báo lỗi 415 nếu sai định dạng (US-SV-01 AC3)."""
    ext = Path(file_name).suffix.lower().lstrip(".")
    if ext not in CV_MEDIA_TYPES:
        raise AppError(415, "Chỉ hỗ trợ file PDF hoặc DOCX.", "unsupported_file_type")
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


def _extract_pdf(data: bytes) -> tuple[str, int]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        raise AppError(422, "File PDF đang được đặt mật khẩu. Hãy gỡ mật khẩu rồi tải lại.", "cv_not_extractable")
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if _split_diacritics(text):
        layout = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in reader.pages)
        # Bỏ khoảng trắng căn lề của chế độ layout
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
    """Trích văn bản từ CV; báo lỗi 422 "cv_not_extractable" nếu không đọc được nội dung."""
    try:
        if file_type == "pdf":
            text, page_count = _extract_pdf(data)
        else:
            text, page_count = _extract_docx(data), None
    except AppError:
        raise
    except Exception as e:
        logger.warning("Không đọc được file CV (%s)", file_type)
        raise AppError(
            422, "File bị lỗi hoặc không đúng định dạng PDF/DOCX. Hãy kiểm tra lại file.", "cv_not_extractable"
        ) from e

    text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
    if len("".join(text.split())) < MIN_TEXT_CHARS:
        raise AppError(
            422,
            "Không trích xuất được nội dung CV. Có vẻ đây là bản scan ảnh; hãy tải lại bản có lớp văn bản.",
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
