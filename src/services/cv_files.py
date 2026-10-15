"""Xử lý file CV tải lên: kiểm tra định dạng/dung lượng, trích văn bản, lưu file gốc (US-SV-01)."""

import io
import logging
import re
import unicodedata
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
    # Chỉ để mở lại file ảnh đã tải lên trước đây; tải mới chỉ nhận UPLOAD_TYPES (PDF scan vẫn được OCR).
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}
UPLOAD_TYPES = ("pdf", "docx")
# Ít hơn ngưỡng này coi như không có lớp văn bản (ví dụ PDF scan ảnh) — US-SV-01 AC2
MIN_TEXT_CHARS = 50


@dataclass
class ExtractedCv:
    file_type: str
    text: str
    page_count: int | None
    # True khi chữ được đọc bằng OCR (PDF scan): kết quả phân tích có thể kém chính xác hơn
    read_by_ocr: bool = False


def file_type_of(file_name: str) -> str:
    """Trả về "pdf" | "docx" hoặc báo lỗi 415 nếu sai định dạng (US-SV-01 AC3)."""
    ext = Path(file_name).suffix.lower().lstrip(".")
    if ext not in UPLOAD_TYPES:
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


def clean_stutter_text(text: str) -> str:
    """Khử hiện tượng lặp đôi ký tự (DDựự áánn -> Dự án, 771155 -> 715) do Canva/PDF export 2 layer chữ đè nhau."""
    if not text:
        return text

    def _clean_line(line: str) -> str:
        line_nfc = unicodedata.normalize("NFC", line)
        tokens = re.split(r"(\s+)", line_nfc)
        has_obvious_stutter = any(
            len(t) >= 4 and len(t) % 2 == 0 and all(t[i] == t[i + 1] for i in range(0, len(t), 2))
            for t in tokens
            if t.strip()
        )
        if not has_obvious_stutter:
            return line_nfc

        def _clean_token(t: str) -> str:
            if not t.strip():
                return t
            n = len(t)
            if n >= 2 and n % 2 == 0 and all(t[i] == t[i + 1] for i in range(0, n, 2)):
                return "".join(t[i] for i in range(0, n, 2))
            return t

        return "".join(_clean_token(t) for t in tokens)

    return "\n".join(_clean_line(line) for line in text.splitlines())


def _extract_pdfplumber_page(page: Any) -> str:
    words = page.extract_words()
    if not words:
        return (page.extract_text() or "").strip()

    from src.services.cv_layout import extract_layout_aware_text

    raw_text = extract_layout_aware_text(words, page.width, page.height)
    return clean_stutter_text(raw_text)


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


def reformat_cv_with_deepseek(raw_text: str) -> str:
    """
    Sử dụng model DeepSeek (deepseek-chat) để đọc hiểu ngữ nghĩa văn bản thô trích xuất từ CV,
    tự động phân loại chính xác các mục (Học vấn, Kinh nghiệm, Kỹ năng, Dự án...)
    và sắp xếp lại theo cấu trúc chuẩn Harvard (Harvard Resume Format) rõ ràng, trung thực.
    """
    if not raw_text or len(raw_text.strip()) < 50:
        return raw_text

    try:
        import os

        settings = get_settings()
        api_key, _ = settings.get_llm_credentials()
        # Tránh gọi LLM ngoài trong unit test hoặc khi chưa cấu hình key
        if not api_key or api_key.startswith("sk-dummy") or api_key == "test-key" or os.getenv("PYTEST_CURRENT_TEST"):
            return raw_text

        from langchain_core.messages import HumanMessage, SystemMessage

        chat_model = settings.get_chat_model(temperature=0.1, timeout=25)

        system_prompt = (
            "Bạn là chuyên gia phân tích và tái cấu trúc hồ sơ CV theo định dạng chuẩn Harvard (Harvard Resume Format).\n"
            "Dưới đây là toàn bộ văn bản thô được trích xuất từ CV của ứng viên (có thể bị xáo trộn vị trí các cột, dính chữ ngang, hoặc ngắt dòng lộn xộn do OCR).\n\n"
            "NHIỆM VỤ CỦA BẠN:\n"
            "1. XÁC ĐỊNH NGÔN NGỮ CHỦ ĐẠO CỦA CV GỐC (CRITICAL - ĐỒNG BỘ NGÔN NGỮ 100%):\n"
            "   - Nếu CV gốc viết bằng TIẾNG ANH: TẤT CẢ tiêu đề mục BẮT BUỘC dùng TIẾNG ANH (SUMMARY, EDUCATION, WORK EXPERIENCE, PROJECTS, SKILLS, CERTIFICATIONS, LANGUAGES). TUYỆT ĐỐI KHÔNG dịch tiêu đề sang tiếng Việt. Toàn bộ văn bản xuất ra phải 100% tiếng Anh.\n"
            "   - Nếu CV gốc viết bằng TIẾNG VIỆT: TẤT CẢ tiêu đề mục BẮT BUỘC dùng TIẾNG VIỆT (TÓM TẮT BẢN THÂN, HỌC VẤN, KINH NGHIỆM LÀM VIỆC, DỰ ÁN, KỸ NĂNG, CHỨNG CHỈ, NGOẠI NGỮ). Toàn bộ văn bản xuất ra phải 100% tiếng Việt.\n"
            "   - TUYỆT ĐỐI KHÔNG ĐƯỢC TRỘN LẪN TIẾNG ANH VÀ TIẾNG VIỆT (không để nội dung tiếng Anh nhưng tiêu đề tiếng Việt hoặc ngược lại).\n\n"
            "2. ĐỌC HIỂU NGỮ NGHĨA VÀ PHÂN BIỆT ĐẦY ĐỦ CÁC THÀNH PHẦN:\n"
            "   - Thông tin liên hệ (Họ tên in hoa, vị trí, email, phone, location, LinkedIn/GitHub/Portfolio).\n"
            "   - Tóm tắt bản thân / Mục tiêu nghề nghiệp (Summary / Objective).\n"
            "   - Kinh nghiệm làm việc (Work Experience): Tên tổ chức/công ty, chức danh, thời gian, bullet trách nhiệm.\n"
            "   - Học vấn (Education): Tên trường, chuyên ngành/bằng cấp, thời gian, môn học/GPA/thành tích.\n"
            "   - Kỹ năng (Skills): Nhóm kỹ năng, công cụ, ngôn ngữ lập trình, thư viện...\n"
            "   - Dự án (Projects): Tên dự án, dòng Technologies, bullet mô tả tính năng/kết quả.\n"
            "   - Chứng chỉ (Certifications): Tất cả chứng chỉ nghề nghiệp, khóa học, job simulation, ngoại ngữ kèm thời gian.\n"
            "   - Ngoại ngữ (Languages): Danh sách ngôn ngữ và trình độ tương ứng.\n\n"
            "3. CẤU TRÚC MẪU CHUẨN HARVARD BẮT BUỘC:\n\n"
            "[HỌ VÀ TÊN IN HOA]\n"
            "[Vị trí chuyên môn nếu có]\n"
            "[Địa chỉ / Location] | [Số điện thoại / Phone] | [Email] | [LinkedIn / GitHub / Website]\n\n"
            "SUMMARY (hoặc TÓM TẮT BẢN THÂN nếu CV tiếng Việt)\n"
            "[Đoạn văn giới thiệu bản thân liền mạch, súc tích]\n\n"
            "EDUCATION (hoặc HỌC VẤN nếu CV tiếng Việt)\n"
            "[Tên trường học / University]\n"
            "[Bằng cấp / Degree / Chuyên ngành] | [Thời gian]\n"
            "• [Relevant Coursework / GPA / Xếp loại nếu có]\n\n"
            "WORK EXPERIENCE (hoặc KINH NGHIỆM LÀM VIỆC nếu CV tiếng Việt)\n"
            "[Tên công ty / Organization] | [Vị trí / Role]\n"
            "[Thời gian]\n"
            "• [Chi tiết trách nhiệm hoặc thành tích 1]\n"
            "• [Chi tiết trách nhiệm hoặc thành tích 2]\n\n"
            "PROJECTS (hoặc DỰ ÁN nếu CV tiếng Việt)\n"
            "[Tên dự án] | [Vai trò hoặc Team Project nếu có] | [Thời gian nếu có] (TUYỆT ĐỐI KHÔNG để dấu • ở dòng tên dự án)\n"
            "Technologies: [Liệt kê công nghệ, thư viện, công cụ sử dụng] (TUYỆT ĐỐI KHÔNG để dấu • ở dòng này)\n"
            "• [Mô tả chi tiết giải pháp, hành động, kết quả 1]\n"
            "• [Mô tả chi tiết giải pháp, hành động, kết quả 2]\n\n"
            "SKILLS (hoặc KỸ NĂNG nếu CV tiếng Việt)\n"
            "• [Nhóm kỹ năng 1]: [Danh sách kỹ năng]\n"
            "• [Nhóm kỹ năng 2]: [Danh sách kỹ năng]\n\n"
            "CERTIFICATIONS (hoặc CHỨNG CHỈ nếu CV tiếng Việt)\n"
            "[Tên chứng chỉ 1] (Credential ID: ... nếu có) by [Đơn vị cấp nếu có] | [Thời gian]\n"
            "[Tên chứng chỉ 2] (Credential ID: ... nếu có) by [Đơn vị cấp nếu có] | [Thời gian]\n"
            "(BẮT BUỘC liệt kê đầy đủ 100% mọi chứng chỉ có trong CV gốc, đếm kỹ để không bỏ sót bất kỳ chứng chỉ nào, kể cả SQL Intermediate, Python Basic, Job Simulation, HackerRank, Forage, Coursera, TOEIC, IELTS... TUYỆT ĐỐI KHÔNG để dấu • ở đầu dòng chứng chỉ)\n\n"
            "LANGUAGES (hoặc NGOẠI NGỮ nếu CV tiếng Việt)\n"
            "• [Ngôn ngữ 1] ([Trình độ / Mức độ thông thạo])\n"
            "• [Ngôn ngữ 2] ([Trình độ / Mức độ thông thạo])\n\n"
            "4. QUY TẮC BẮT BUỘC (CRITICAL GUARDRAILS):\n"
            "- ĐỒNG BỘ NGÔN NGỮ TUYỆT ĐỐI: CV tiếng Anh thì mọi tiêu đề mục là TIẾNG ANH. CV tiếng Việt thì mọi tiêu đề mục là TIẾNG VIỆT.\n"
            "- GIỮ NGUYÊN 100% SỰ THẬT: Số liệu, tên chứng chỉ, mã Credential ID, thời gian, tên công nghệ. KHÔNG TỰ BỎ SÓT và KHÔNG BỊA ĐẶT.\n"
            "- MỤC CHỨNG CHỈ & NGOẠI NGỮ: Tách biệt hoàn toàn thành 2 mục riêng biệt. BẮT BUỘC giữ lại ĐẦY ĐỦ 100% TẤT CẢ các chứng chỉ có trong văn bản thô (đếm kỹ từng dòng chứng chỉ để đảm bảo không bỏ sót bất kỳ chứng chỉ nào) và mọi ngôn ngữ có trong CV gốc. TUYỆT ĐỐI KHÔNG lấy ngày tháng của chứng chỉ gán sang mục Ngoại ngữ.\n"
            "- MỤC DỰ ÁN & KINH NGHIỆM: Tên dự án, tên công ty, dòng Technologies: ... TUYỆT ĐỐI KHÔNG có dấu gạch đầu dòng (•). Chỉ các câu mô tả công việc mới có dấu •.\n"
            "- Giữa các mục lớn và giữa các dự án/công ty phải có 1 dòng trống để tách bạch rõ ràng.\n"
            "- Tự động ghép nối các câu bị ngắt dòng giữa chừng do OCR thành câu hoàn chỉnh.\n"
            "- CHỈ xuất ra duy nhất nội dung văn bản CV đã được định dạng, KHÔNG thêm lời giải thích, chào hỏi hay bọc trong markdown ```."
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"VĂN BẢN CV THÔ TỪ BẢN QUÉT / TRÍCH XUẤT:\n\n{raw_text}"),
        ]

        response = chat_model.invoke(messages)
        formatted_text = str(response.content).strip()
        if formatted_text.startswith("```"):
            lines = formatted_text.splitlines()
            if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].startswith("```"):
                formatted_text = "\n".join(lines[1:-1]).strip()

        if len(formatted_text) >= len(raw_text) * 0.4:
            logger.info("Đã dùng DeepSeek chuẩn hóa cấu trúc CV theo format Harvard thành công.")
            return formatted_text
        return raw_text
    except Exception as e:
        logger.warning("Không thể định dạng lại CV bằng DeepSeek (fallback về text thô): %s", e)
        return raw_text


def extract_cv(file_type: str, data: bytes) -> ExtractedCv:
    """Trích văn bản từ CV; tự động kích hoạt OCR khi là PDF scan không có lớp text."""
    read_by_ocr = False
    try:
        if file_type == "pdf":
            text, page_count = _extract_pdf(data)
            chars_count = len("".join(text.split()))
            # Nếu PDF không có lớp văn bản hoặc quá ít ký tự (< 120 ký tự, tránh file scan có text rác / watermark), quét OCR
            if chars_count < 120:
                logger.info("PDF chỉ có %d ký tự văn bản. Tiến hành quét OCR qua các trang...", chars_count)
                ocr_text, ocr_pages = ocr.ocr_pdf_bytes(data)
                if len("".join(ocr_text.split())) > chars_count:
                    text = ocr_text
                    page_count = ocr_pages or page_count
                    read_by_ocr = True
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
    text = clean_stutter_text(text)

    # Khi chữ được bóc tách từ OCR hoặc có layout phức tạp, dùng DeepSeek định dạng lại theo chuẩn Harvard
    if read_by_ocr or len(text) >= 100:
        text = reformat_cv_with_deepseek(text)

    if len("".join(text.split())) < MIN_TEXT_CHARS:
        raise AppError(
            422,
            "Không trích xuất được nội dung CV. Hãy đảm bảo file có chữ rõ ràng hoặc tải lại bản có lớp văn bản.",
            "cv_not_extractable",
        )
    return ExtractedCv(file_type=file_type, text=text, page_count=page_count, read_by_ocr=read_by_ocr)


def merge_wrapped(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ghép nửa sau của câu bị xuống dòng (cont) vào dòng trước, để mỗi câu là một đoạn."""
    merged: list[dict[str, Any]] = []
    for line in lines:
        if line.get("cont") and merged:
            merged[-1] = {**merged[-1], "text": f"{merged[-1]['text']} {line['text']}"}
        else:
            merged.append(line)
    return merged


def build_docx(document: dict, developing_title: str | None = None) -> bytes:
    """
    File DOCX cho phiên bản CV đã tối ưu, bố cục gọn kiểu Harvard (không giữ thiết kế của file gốc; chữ giữ nguyên):
    họ tên và liên hệ căn giữa, tiêu đề mục in hoa có kẻ dưới, tên mục con in đậm với thời gian căn phải,
    câu mô tả là gạch đầu dòng, cuối cùng là kỹ năng đang phát triển. Loại từng dòng: src/services/cv_layout.py.
    """
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt

    from src.services.cv_layout import DEVELOPING_TITLES

    doc = Document()
    page = doc.sections[0]
    page.page_width, page.page_height = Inches(8.27), Inches(11.69)  # A4
    page.left_margin = page.right_margin = Inches(0.7)
    page.top_margin = page.bottom_margin = Inches(0.6)
    text_width = page.page_width - page.left_margin - page.right_margin

    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing = 1.08

    def para(style: str | None = None, *, before: float = 0, align: Any = None):
        p = doc.add_paragraph(style=style)
        p.paragraph_format.space_before = Pt(before)
        p.paragraph_format.space_after = Pt(0)
        if align is not None:
            p.alignment = align
        return p

    def run(p: Any, text: str, *, bold: bool = False, italic: bool = False, size: float | None = None):
        r = p.add_run(text)
        r.bold, r.italic = bold or None, italic or None
        if size:
            r.font.size = Pt(size)
        return r

    def heading(title: str) -> None:
        p = para(before=10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        r = run(p, title, bold=True, size=12)
        r.font.all_caps = True
        border = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        for key, value in (("w:val", "single"), ("w:sz", "6"), ("w:space", "1"), ("w:color", "000000")):
            bottom.set(qn(key), value)
        border.append(bottom)
        p._p.get_or_add_pPr().append(border)

    def labelled(p: Any, text: str) -> None:
        label, _, rest = text.partition(":")
        run(p, f"{label}:", bold=True)
        run(p, rest)

    def line_paragraph(line: dict[str, Any]) -> None:
        kind, text = line.get("kind", "bullet"), line["text"]
        if kind == "entry":
            p = para(before=4)
            p.paragraph_format.keep_with_next = True
            p.paragraph_format.tab_stops.add_tab_stop(text_width, WD_TAB_ALIGNMENT.RIGHT)
            date = line.get("date")
            title = _without_date(text, date) if date else text
            run(p, title, bold=True)
            if date and title != text:
                run(p, f"\t{date}")
        elif kind in ("role", "tech"):
            run(para(), text, italic=True, bold=kind == "tech")
        elif kind == "label":
            labelled(para(), text)
        elif kind == "bullet":
            p = para("List Bullet")
            p.paragraph_format.left_indent = Inches(0.35)
            run(p, text)
        else:
            p = para(align=WD_ALIGN_PARAGRAPH.JUSTIFY)
            run(p, text)

    header = merge_wrapped(document["header"])
    name = next((line for line in header if line.get("kind") == "name"), header[0] if header else None)
    if name:
        run(para(align=WD_ALIGN_PARAGRAPH.CENTER), name["text"], bold=True, size=18).font.all_caps = True
    contacts = [line["text"] for line in header if line is not name and line.get("kind", "contact") == "contact"]
    if contacts:
        run(para(align=WD_ALIGN_PARAGRAPH.CENTER, before=2), " | ".join(contacts), size=10.5)
    for line in header:
        if line is not name and line.get("kind") == "text":
            run(para(align=WD_ALIGN_PARAGRAPH.JUSTIFY, before=6), line["text"])

    for section in document["sections"]:
        heading(section["title"])
        for line in merge_wrapped(section["lines"]):
            line_paragraph(line)
    if document["developing_skills"]:
        heading(developing_title or DEVELOPING_TITLES.get(document.get("lang", "vi"), DEVELOPING_TITLES["vi"]))
        for skill in document["developing_skills"]:
            labelled(para(), f"{skill['name']}: {skill['note']}")

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def _without_date(text: str, date: str) -> str:
    """Tên của dòng entry: bỏ phần thời gian (ở cuối hoặc đầu dòng) cùng dấu ngăn."""
    at = text.rfind(date)
    if at < 0:
        return text
    title = (text[:at] + text[at + len(date) :]).strip(" \t|,–—-:")
    # "(2022 – 2024)" → bỏ cả cặp ngoặc quanh thời gian
    title = title.removesuffix("(").removeprefix(")").replace("()", "").strip(" \t|,–—-:")
    return title or text


# Ảnh trang PDF để xem CV ngay trong app (không dùng trình xem PDF của trình duyệt): ~150 dpi với khổ A4
PAGE_IMAGE_WIDTH = 1240
MAX_PREVIEW_PAGES = 10


def pdf_page_count(path: Path) -> int:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(path)
    try:
        return len(pdf)
    finally:
        pdf.close()


def render_pdf_page(path: Path, page: int) -> bytes:
    """Ảnh PNG của trang `page` (đếm từ 1), rộng PAGE_IMAGE_WIDTH px."""
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(path)
    try:
        if not 1 <= page <= min(len(pdf), MAX_PREVIEW_PAGES):
            raise AppError(404, "Không có trang này trong CV.", "cv_page_not_found")
        sheet = pdf[page - 1]
        image = sheet.render(scale=PAGE_IMAGE_WIDTH / sheet.get_width()).to_pil()
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        return buffer.getvalue()
    finally:
        pdf.close()


def stored_path(owner_id: str, cv_id: str, file_type: str) -> Path:
    return Path(get_settings().upload_dir) / owner_id / f"{cv_id}.{file_type}"


def save_file(owner_id: str, cv_id: str, file_type: str, data: bytes) -> None:
    path = stored_path(owner_id, cv_id, file_type)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def delete_file(owner_id: str, cv_id: str, file_type: str) -> None:
    stored_path(owner_id, cv_id, file_type).unlink(missing_ok=True)
