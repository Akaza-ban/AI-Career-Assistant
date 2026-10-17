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
import math
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

_RAPID_OCR_INSTANCE = None

# Chỗ giữa hai ký tự không chèn dấu cách: giữ nguyên email, link, ngày, số thập phân, từ có gạch nối
_NO_SPACE_AROUND = set("@./-_:,;()'\"&+%#|")
# Khoảng trống tối thiểu giữa hai từ, tính theo bề rộng ký tự thường gặp của chính dòng đó
SPACE_GAP_RATIO = 0.6
# Số chữ cái trung bình của một từ (tiếng Anh ~4,7; âm tiết tiếng Việt ~3,5): ước lượng dòng nên có bao nhiêu từ
LETTERS_PER_WORD = 6.0


def respace(chars: list[str], char_boxes: list[list[list[float]]]) -> str | None:
    """
    Chèn dấu cách OCR bỏ sót ("abackendengineering" → "a backend engineering") dựa vào vị trí từng ký tự trên ảnh:
    hai ký tự cách nhau xa hơn hẳn mức thường gặp trong dòng là ranh giới hai từ. Ngưỡng tự tính theo cỡ chữ của
    dòng nên dùng chung cho mọi font, độ phân giải, tiếng Việt lẫn tiếng Anh. None nếu không đủ dữ liệu.
    """
    if len(chars) != len(char_boxes) or len(chars) < 4:
        return None
    spans = [(min(pt[0] for pt in box), max(pt[0] for pt in box)) for box in char_boxes]
    widths = sorted(x1 - x0 for (x0, x1), ch in zip(spans, chars, strict=True) if ch.strip())
    if not widths:
        return None
    char_w = max(1.0, widths[len(widths) // 2])
    # Dòng OCR đã tự đặt dấu cách: khoảng trắng giữa hai từ của chính dòng đó là thước đo (ảnh mờ có nhiễu 3–4 px
    # ngay trong một từ, không được coi là ranh giới). Dòng không có dấu cách nào thì dựa vào bề rộng ký tự.
    word_gaps = []
    for i, ch in enumerate(chars):
        if ch == " " and 0 < i < len(chars) - 1 and chars[i - 1].strip():
            nxt = next((j for j in range(i + 1, len(chars)) if chars[j].strip()), None)
            if nxt is not None:
                word_gaps.append(spans[nxt][0] - spans[i - 1][1])
    word_gaps.sort()
    threshold = char_w * SPACE_GAP_RATIO
    if len(word_gaps) >= 2:
        threshold = max(threshold, word_gaps[len(word_gaps) // 2] * 0.75)
    candidates = []
    for i in range(1, len(chars)):
        prev, cur = chars[i - 1], chars[i]
        gap = spans[i][0] - spans[i - 1][1]
        if (
            prev.strip()
            and cur.strip()
            and gap > threshold
            and prev not in _NO_SPACE_AROUND
            and cur not in _NO_SPACE_AROUND
        ):
            candidates.append((gap, i))
    # Không chèn quá số dấu cách dòng còn thiếu: ước lượng số từ theo số chữ cái, trừ chỗ đã ngăn bằng dấu cách / dấu
    # câu. Vị trí ước lượng của chữ rộng ("m", "w") hay tạo khoảng trống giả; chỉ giữ các khoảng lớn nhất.
    letters = sum(1 for ch in chars if ch.isalnum())
    separated = 1 + sum(
        1
        for i, ch in enumerate(chars[:-1])
        if (ch == " " or ch in ",;/") and chars[i + 1].strip() and chars[i + 1] != " "
    )
    missing = max(0, round(letters / LETTERS_PER_WORD) - separated)
    chosen: set[int] = set()
    for _, i in sorted(candidates, reverse=True):
        if len(chosen) >= missing:
            break
        if not _leaves_lone_consonant(chars, chosen | {i}, i):
            chosen.add(i)
    out = [chars[0]]
    for i in range(1, len(chars)):
        if i in chosen:
            out.append(" ")
        out.append(chars[i])
    return " ".join("".join(out).split())


_LONE_LETTERS = set("aAiIoOuUyYeE")


def _leaves_lone_consonant(chars: list[str], cuts: set[int], at: int) -> bool:
    """Chèn dấu cách ở `at` tạo ra mảnh chỉ một phụ âm ("m anaged", "problem s"): một chữ cái đứng riêng chỉ hợp lý
    khi là nguyên âm ("a", "I", "o", "y"), còn lại gần như luôn là khoảng trống giả quanh chữ rộng."""

    def boundary(j: int) -> bool:
        return j in cuts or not chars[j].strip() or chars[j] in _NO_SPACE_AROUND or chars[j - 1] in _NO_SPACE_AROUND

    start = next((j for j in range(at - 1, 0, -1) if boundary(j)), 0)
    end = next((j for j in range(at + 1, len(chars)) if boundary(j)), len(chars))
    left = "".join(chars[start:at]).strip(" ,;/()")
    right = "".join(chars[at:end]).strip(" ,;/()")
    return any(len(piece) == 1 and piece.isalpha() and piece not in _LONE_LETTERS for piece in (left, right))


def _with_spaces(res: list[Any]) -> list[Any]:
    """Kết quả RapidOCR có vị trí từng ký tự (return_word_box) → thay chữ của mỗi dòng bằng bản đã chèn dấu cách."""
    fixed = []
    for item in res:
        if len(item) >= 5 and isinstance(item[3], list) and isinstance(item[4], list):
            text = respace([str(c) for c in item[4]], item[3])
            if text:
                item = [item[0], text, *item[2:]]
        fixed.append(item)
    return fixed


# Vẽ trang PDF scan thành ảnh rộng cố định ~1800 px bất kể khổ trang: OCR đọc tốt nhất khi ảnh vào cỡ ổn định
# (RapidOCR tự thu ảnh về cạnh dài 2000 px); vẽ theo tỉ lệ cố định thì PDF khổ nhỏ (ảnh chụp đóng gói) ra ảnh quá bé.
# Đo trên eval/ocr: trung bình 60,5% → 68,1% từ đọc đúng so với vẽ ×2.
OCR_PAGE_WIDTH_PX = 1800


def render_scale(page_width_pt: float) -> float:
    return min(5.0, max(1.5, OCR_PAGE_WIDTH_PX / max(1.0, page_width_pt)))


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


def _deskew(polys: list[list[tuple[float, float]]], width: float, height: float) -> list[list[tuple[float, float]]]:
    """
    Ảnh chụp bằng điện thoại thường nghiêng 1–3 độ: dòng của hai cột lệch độ cao, bị ghép nhầm. Góc nghiêng đo từ
    chính các khung chữ OCR (trung vị góc cạnh trên của các khung dài) rồi xoay ngược toạ độ quanh tâm trang.
    """
    angles = []
    for poly in polys:
        (x0, y0), (x1, y1) = poly[0], poly[1]
        h = max(abs(poly[3][1] - poly[0][1]), 1.0)
        if x1 - x0 > 3 * h:
            angles.append(math.atan2(y1 - y0, x1 - x0))
    if len(angles) < 5:
        return polys
    angles.sort()
    angle = angles[len(angles) // 2]
    if abs(math.degrees(angle)) < 0.2:
        return polys
    cos, sin = math.cos(-angle), math.sin(-angle)
    cx, cy = width / 2, height / 2
    return [[(cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos) for x, y in p] for p in polys]


def format_ocr_boxes(boxes: list[Any], width: float, height: float) -> str:
    """
    Kết quả OCR dạng khung chữ ([đa giác, chữ, độ tin cậy, ...]) → chữ theo thứ tự đọc: chỉnh nghiêng, rồi chia trang
    theo khoảng trắng như PDF có chữ (cv_layout.extract_layout_aware_text: một cột, hai cột, bố cục lai, ô lồng nhau).
    """
    from src.services.cv_layout import extract_layout_aware_text

    kept = [
        (item[0], str(item[1]).strip())
        for item in boxes or []
        if str(item[1]).strip() and (float(item[2]) if len(item) > 2 else 1.0) >= 0.25
    ]
    if not kept:
        return ""
    polys = _deskew([[(float(x), float(y)) for x, y in poly] for poly, _ in kept], width, height)
    items = [
        {
            "text": text,
            "x0": min(x for x, _ in poly),
            "x1": max(x for x, _ in poly),
            "top": min(y for _, y in poly),
            "bottom": max(y for _, y in poly),
        }
        for poly, (_, text) in zip(polys, kept, strict=True)
    ]
    return extract_layout_aware_text(items, width, height)


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
            res, _ = engine(np_img, return_word_box=True)
            res = _with_spaces(res) if res else res
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
            pil_img = page.render(scale=render_scale(page.get_width())).to_pil()
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
