from unittest.mock import Mock

import pymupdf
import pytest

from src.services.privacy.extract import extract, local_ocr
from src.services.privacy.types import ExtractionError


def pdf_bytes(texts):
    with pymupdf.open() as pdf:
        for text in texts:
            page = pdf.new_page()
            if text:
                page.insert_text((72, 72), text)
        return pdf.tobytes()


def test_text_layer_and_page_local_ocr():
    ocr = Mock(return_value="scanned local OCR content")
    result = extract(pdf_bytes(["Email: alice@example.test\nSkills: Python", ""]), ocr=ocr)
    assert "alice@example.test" in result and "scanned local OCR content" in result
    assert ocr.call_count == 1
    assert ocr.call_args.args[0].startswith(b"\x89PNG")


def test_scanned_body_with_text_header_uses_ocr():
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 40), "This header has a text layer")
        image = pymupdf.Pixmap(pymupdf.csRGB, (0, 0, 200, 200), False)
        image.clear_with(255)
        page.insert_image(pymupdf.Rect(0, 100, 595, 842), pixmap=image)
        raw = pdf.tobytes()
    ocr = Mock(return_value="entire page OCR")
    assert extract(raw, ocr=ocr) == "entire page OCR"
    ocr.assert_called_once()


def test_ocr_failure_never_returns_partial_document():
    def failed_ocr(raw):
        raise ValueError("private document text")

    with pytest.raises(ExtractionError) as error:
        extract(pdf_bytes(["Good first page with a text layer", ""]), ocr=failed_ocr)
    assert "private" not in str(error.value)
    with pytest.raises(ExtractionError):
        extract(b"invalid PDF secret@example.test")
    with pytest.raises(ExtractionError):
        extract(pdf_bytes([""]), ocr=lambda _: "")


def test_tesseract_failure_is_typed_and_sanitized(monkeypatch):
    from src.config import Settings

    monkeypatch.setattr(
        "src.services.privacy.extract.get_settings",
        lambda: Settings(_env_file=None, pii_ocr_command="nonexistent-privacy-ocr"),
    )
    with pytest.raises(ExtractionError) as error:
        local_ocr(b"private png")
    assert "private png" not in str(error.value)
