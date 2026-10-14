"""Hàm dựng file CV mẫu dùng chung cho các test."""

import io

from docx import Document

STUDENT = {"X-Demo-Role": "student"}
ADVISOR = {"X-Demo-Role": "advisor"}
ADMIN = {"X-Demo-Role": "admin"}


def make_pdf(text: str | None) -> bytes:
    """PDF 1 trang tối giản; text=None tạo trang trắng (giống bản scan không có lớp văn bản)."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode() if text else b""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R"
        b" /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        out += b"%010d 00000 n \n" % offset
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return out


def make_docx(lines: list[str]) -> bytes:
    document = Document()
    for line in lines:
        document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_image(text: str | None, fmt: str = "PNG") -> bytes:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (800, 400), color=(255, 255, 255))
    if text:
        d = ImageDraw.Draw(img)
        d.text((40, 40), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def make_scanned_pdf(text: str | None) -> bytes:
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    if text:
        d = ImageDraw.Draw(img)
        d.text((50, 50), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PDF")
    return buf.getvalue()


async def upload_cv(client, name: str, data: bytes, headers=STUDENT):
    return await client.post("/api/v1/cv/upload", files={"file": (name, data)}, headers=headers)
