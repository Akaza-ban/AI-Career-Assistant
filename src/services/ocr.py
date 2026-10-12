"""Dịch vụ nhận diện văn bản (OCR) cho file CV scan hoặc file ảnh (US-SV-01 nâng cấp).

Hỗ trợ trích xuất văn bản từ:
- PDF scan / PDF dạng ảnh (khi lớp văn bản gốc bị thiếu hoặc ít hơn MIN_TEXT_CHARS)
- File ảnh CV trực tiếp (PNG, JPG, JPEG)

Sử dụng RapidOCR (chạy trên ONNX Runtime đa nền tảng, hỗ trợ tiếng Việt và tiếng Anh)
kết hợp giải thuật phân tích bố cục dòng / cột (Reading Order Heuristic),
có cơ chế fallback sang PyTesseract hoặc Vision LLM khi cần.
"""

import io
import logging
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

_RAPID_OCR_INSTANCE = None


def get_ocr_engine():
    """Khởi tạo engine RapidOCR theo cơ chế lazy singleton."""
    global _RAPID_OCR_INSTANCE
    if _RAPID_OCR_INSTANCE is None:
        try:
            from rapidocr_onnxruntime import RapidOCR

            _RAPID_OCR_INSTANCE = RapidOCR()
            logger.info("Khởi tạo RapidOCR engine thành công.")
        except Exception as e:
            logger.warning("Không thể khởi tạo RapidOCR: %s", e)
            _RAPID_OCR_INSTANCE = None
    return _RAPID_OCR_INSTANCE


def _check_column_split(boxes: list[dict[str, Any]], width: float) -> float | None:
    """
    Phát hiện vạch chia 2 cột dọc (thường gặp ở CV có sidebar bên trái: kỹ năng, liên hệ;
    cột chính bên phải: kinh nghiệm, học vấn).
    Tìm đường x_split trong khoảng 20% - 65% chiều rộng sao cho ít box bị cắt ngang nhất
    và có khoảng trống (clearance) lớn nhất.
    """
    if not boxes or len(boxes) < 6 or width <= 0:
        return None

    best_split = None
    min_crossings = float("inf")
    best_clearance = -1

    for xi in range(int(0.20 * width), int(0.65 * width), 2):
        sx = float(xi)
        crossings = 0
        min_dist = float("inf")
        left_c = 0
        right_c = 0

        for it in boxes:
            if it["xmin"] < sx < it["xmax"]:
                crossings += 1
            elif it["xmax"] <= sx:
                left_c += 1
                dist = sx - it["xmax"]
                if dist < min_dist:
                    min_dist = dist
            elif it["xmin"] >= sx:
                right_c += 1
                dist = it["xmin"] - sx
                if dist < min_dist:
                    min_dist = dist

        if left_c >= 5 and right_c >= 5:
            if crossings < min_crossings or (crossings == min_crossings and min_dist > best_clearance):
                min_crossings = crossings
                best_clearance = min_dist
                best_split = sx

    if best_split is not None and min_crossings <= 3:
        return best_split
    return None


def _group_and_sort_lines(items: list[dict[str, Any]]) -> str:
    """Gom các hộp chữ thành từng dòng theo toạ độ dọc và sắp xếp từ trái qua phải."""
    if not items:
        return ""

    # Sắp xếp sơ bộ theo toạ độ y
    items.sort(key=lambda it: it["y_center"])

    lines: list[list[dict[str, Any]]] = []
    current_line = [items[0]]

    for it in items[1:]:
        ref = current_line[-1]
        line_h = max(ref["height"], it["height"])
        # Nếu khoảng cách y_center nhỏ hơn 50% chiều cao dòng -> cùng 1 dòng ngang
        if abs(it["y_center"] - ref["y_center"]) <= line_h * 0.5:
            current_line.append(it)
        else:
            lines.append(current_line)
            current_line = [it]
    lines.append(current_line)

    result_blocks: list[str] = []
    prev_line_bottom = None

    for line in lines:
        # Sắp xếp các từ/cụm trong cùng một dòng từ trái sang phải
        line.sort(key=lambda it: it["xmin"])
        line_text = " ".join(it["text"] for it in line).strip()
        if not line_text:
            continue

        line_top = min(it["ymin"] for it in line)
        line_bottom = max(it["ymax"] for it in line)
        line_height = max(1.0, line_bottom - line_top)

        # Nếu khoảng cách giữa dòng trước và dòng sau lớn hơn 1.8 lần chiều cao dòng -> ngắt đoạn
        if prev_line_bottom is not None and (line_top - prev_line_bottom) > line_height * 1.8:
            result_blocks.append("")  # Dòng trống biểu thị khoảng cách đoạn

        result_blocks.append(line_text)
        prev_line_bottom = line_bottom

    return "\n".join(result_blocks)


def format_ocr_boxes(boxes: list[Any], width: float, height: float) -> str:
    """
    Chuẩn hoá và tái cấu trúc thứ tự đọc từ kết quả OCR dạng bounding boxes.
    Hỗ trợ cả bố cục 1 cột tiêu chuẩn và bố cục 2 cột (sidebar + main column).
    """
    if not boxes:
        return ""

    items: list[dict[str, Any]] = []
    for item in boxes:
        # RapidOCR format: [box, text, score]
        box = item[0]
        text = str(item[1]).strip()
        score = float(item[2]) if len(item) > 2 else 1.0

        if not text or score < 0.25:
            continue

        ymin = float(min(pt[1] for pt in box))
        ymax = float(max(pt[1] for pt in box))
        xmin = float(min(pt[0] for pt in box))
        xmax = float(max(pt[0] for pt in box))
        y_center = (ymin + ymax) / 2.0
        h = max(1.0, ymax - ymin)

        items.append({
            "text": text,
            "xmin": xmin,
            "xmax": xmax,
            "ymin": ymin,
            "ymax": ymax,
            "y_center": y_center,
            "height": h,
        })

    if not items:
        return ""

    # Kiểm tra bố cục 2 cột
    split_x = _check_column_split(items, width)
    if split_x is not None:
        from src.services.skill_matching import _match_section

        left_items = [it for it in items if it["xmax"] <= split_x]
        right_items = [it for it in items if it["xmin"] >= split_x]
        mid_items = [it for it in items if it["xmin"] < split_x < it["xmax"]]

        left_text = _group_and_sort_lines(left_items)
        right_text = _group_and_sort_lines(right_items + mid_items)

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

        parts = []
        if header_lines:
            parts.append("\n".join(header_lines))
        if left_text.strip():
            parts.append(left_text.strip())
        if body_right_lines:
            parts.append("\n".join(body_right_lines))

        return "\n\n".join(p for p in parts if p.strip()).strip()

    # Bố cục 1 cột thông thường
    return _group_and_sort_lines(items).strip()


def _ocr_with_pytesseract(pil_img: Image.Image) -> str:
    """Dự phòng sử dụng pytesseract nếu có cài đặt."""
    try:
        import importlib

        pytesseract = importlib.import_module("pytesseract")

        # Thử tiếng Việt + Anh, nếu lỗi font thử mặc định
        try:
            return pytesseract.image_to_string(pil_img, lang="vie+eng").strip()
        except Exception:
            return pytesseract.image_to_string(pil_img).strip()
    except Exception as e:
        logger.debug("Pytesseract không khả dụng: %s", e)
        return ""


def ocr_image(pil_img: Image.Image) -> str:
    """Thực hiện OCR trên một đối tượng PIL Image."""
    # Đảm bảo ảnh ở định dạng RGB
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")

    width, height = pil_img.size

    # 1. Thử chạy với RapidOCR (ONNX)
    engine = get_ocr_engine()
    if engine is not None:
        try:
            np_img = np.array(pil_img)
            res, _ = engine(np_img)
            if res:
                text = format_ocr_boxes(res, float(width), float(height))
                if text and len("".join(text.split())) >= 20:
                    return text
        except Exception as e:
            logger.warning("Lỗi trong quá trình xử lý RapidOCR: %s", e)

    # 2. Thử dự phòng với pytesseract
    fallback_text = _ocr_with_pytesseract(pil_img)
    if fallback_text and len("".join(fallback_text.split())) >= 20:
        return fallback_text

    return ""


def ocr_image_bytes(data: bytes) -> str:
    """Nhận diện văn bản từ byte dữ liệu của file ảnh (PNG, JPG, JPEG, v.v.)."""
    try:
        pil_img = Image.open(io.BytesIO(data))
    except Exception as e:
        logger.warning("Không thể mở file ảnh để OCR: %s", e)
        return ""
    return ocr_image(pil_img)


def ocr_pdf_bytes(data: bytes) -> tuple[str, int]:
    """
    Nhận diện văn bản từ file PDF scan (không có lớp text hoặc text quá ngắn).
    Sử dụng pypdfium2 để render từng trang thành ảnh độ phân giải cao và chạy OCR.
    Trả về (text, page_count).
    """
    pages_text: list[str] = []
    page_count = 0

    # Cách 1: Render trang với pypdfium2
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(data)
        page_count = len(pdf)
        for i in range(page_count):
            page = pdf[i]
            # scale=2.0 tương đương ~144-150 DPI, đủ rõ chữ và xử lý nhanh
            pil_img = page.render(scale=2.0).to_pil()
            p_text = ocr_image(pil_img)
            if p_text.strip():
                pages_text.append(p_text.strip())
        if pages_text:
            return "\n\n".join(pages_text).strip(), page_count
    except Exception as e:
        logger.warning("pypdfium2 không đọc được PDF để OCR: %s", e)

    # Cách 2: Trích xuất ảnh nhúng qua pypdf nếu pypdfium2 không thành công
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        page_count = len(reader.pages)
        for page in reader.pages:
            page_extracted: list[str] = []
            for img_file in page.images:
                try:
                    img = Image.open(io.BytesIO(img_file.data))
                    txt = ocr_image(img)
                    if txt.strip():
                        page_extracted.append(txt.strip())
                except Exception:
                    continue
            if page_extracted:
                pages_text.append("\n".join(page_extracted))
    except Exception as e:
        logger.warning("pypdf images extraction thất bại: %s", e)

    return "\n\n".join(pages_text).strip(), page_count
