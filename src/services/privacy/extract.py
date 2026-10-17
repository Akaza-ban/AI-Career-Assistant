"""PDF text-layer extraction and local Tesseract vie+eng fallback, page by page."""

import subprocess
from collections.abc import Callable
from pathlib import Path

from src.config import get_settings
from src.services.privacy.types import ExtractionError


def local_ocr(image_png: bytes) -> str:
    settings = get_settings()
    try:
        result = subprocess.run(
            [settings.pii_ocr_command, "stdin", "stdout", "-l", "vie+eng", "--psm", "6"],
            input=image_png,
            capture_output=True,
            timeout=settings.pii_ocr_timeout_seconds,
            check=True,
        )
        text = result.stdout.decode("utf-8", errors="strict").strip()
        if not text:
            raise ExtractionError("Local OCR returned no text")
        return text
    except ExtractionError:
        raise
    except Exception:
        # Do not echo stderr, paths, filenames or subprocess input to telemetry.
        raise ExtractionError("Local OCR unavailable or failed; provider calls are forbidden") from None


def extract(document: Path | bytes, *, ocr: Callable[[bytes], str] = local_ocr) -> str:
    """Return text only, never photos or PDF metadata. No cloud fallback exists.

    Large scanned images trigger OCR even on a page with a small text header.
    A failed page fails the entire extraction instead of returning a partial CV.
    """
    try:
        import pymupdf
        from pypdf import PdfReader

        settings = get_settings()
        raw = document.read_bytes() if isinstance(document, Path) else document
        if len(raw) > settings.pii_document_max_bytes:
            raise ExtractionError("PDF exceeds local extraction size limit")
        from io import BytesIO

        reader = PdfReader(BytesIO(raw), strict=True)
        if reader.is_encrypted or not 0 < len(reader.pages) <= settings.pii_document_max_pages:
            raise ExtractionError("Encrypted, empty or oversized PDF")
        pages: list[str] = []
        with pymupdf.open(stream=raw, filetype="pdf") as pdf:
            for index, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                rendered_page = pdf[index]
                area = rendered_page.rect.get_area()
                scanned = any(
                    info["bbox"] and pymupdf.Rect(info["bbox"]).get_area() > area * 0.25
                    for info in rendered_page.get_image_info()
                )
                if scanned or len(text.strip()) < 20:
                    pix = rendered_page.get_pixmap(dpi=settings.pii_ocr_dpi, alpha=False)
                    text = ocr(pix.tobytes("png"))
                    if not isinstance(text, str) or not text.strip():
                        raise ExtractionError("Local OCR returned no text")
                pages.append(text.rstrip())
        return "\n".join(pages)
    except ExtractionError:
        raise
    except Exception:
        raise ExtractionError("Local PDF extraction failed; provider calls are forbidden") from None
