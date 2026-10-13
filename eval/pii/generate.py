"""Generate deterministic draft CVs; human annotation review is still required.

From root: python -m eval.pii.generate --font <unicode-font.ttf>
Never generates data in real/. Names and contacts below are synthetic.
"""

import argparse
import json
import random
from io import BytesIO
from pathlib import Path
from typing import Any

from eval.pii.dataset import ROOT

VI_NAMES = [
    "Nguyễn Minh An",
    "Trần Thu Hà",
    "Lê Quốc Bình",
    "Phạm Ngọc Linh",
    "Hoàng Gia Bảo",
    "Vũ Thanh Mai",
    "Đặng Anh Tuấn",
    "Bùi Thảo Vy",
    "Đỗ Nhật Nam",
    "Hồ Khánh Chi",
    "Ngô Đức Huy",
    "Dương Bích Ngọc",
    "Lý Minh Khoa",
    "Đinh Hải Yến",
    "Mai Thành Đạt",
    "Cao Quỳnh Anh",
    "Tạ Quang Vinh",
    "Phan Diệu Hương",
    "Võ Hoài Phong",
    "Chu Tú Uyên",
    "Lâm Tấn Dũng",
    "Đoàn Ngọc Ánh",
    "Tô Bảo Long",
    "Hà Mỹ Duyên",
]
EN_NAMES = [
    "Alice Morgan",
    "Noah Bennett",
    "Emma Brooks",
    "Liam Carter",
    "Ava Collins",
    "Oliver Davies",
    "Mia Edwards",
    "Elijah Foster",
    "Sofia Garcia",
    "Lucas Hayes",
    "Amelia Hughes",
    "Mason Jordan",
    "Charlotte Kelly",
    "Ethan Lewis",
    "Isabella Martin",
    "Henry Mitchell",
    "Harper Nelson",
    "James Parker",
    "Evelyn Reed",
    "Daniel Rivera",
    "Abigail Ross",
    "Benjamin Scott",
    "Emily Taylor",
    "Samuel Turner",
]


class Builder:
    def __init__(self) -> None:
        self.text = ""
        self.entities: list[dict[str, Any]] = []
        self.keep: list[dict[str, Any]] = []

    def add(self, text: str, *, pii: str = "", keep: str = "") -> "Builder":
        start = len(self.text)
        self.text += text
        if pii or keep:
            value = {"start": start, "end": len(self.text), "kind": pii or keep, "text": text}
            (self.entities if pii else self.keep).append(value)
        return self


def cv(index: int) -> dict[str, Any]:
    language = ("vi", "en", "mixed")[index % 3]
    vietnamese = language != "en"
    name = VI_NAMES[(index // 3) % 24] if vietnamese else EN_NAMES[(index // 3) % 24]
    referee = (
        EN_NAMES[(index // 3 + 7) % 24]
        if language == "mixed"
        else (VI_NAMES[(index // 3 + 7) % 24] if vietnamese else EN_NAMES[(index // 3 + 7) % 24])
    )
    layout = (index // 3) % 8
    b = Builder()
    if layout in (0, 1, 2, 3):
        if layout == 1:
            b.add("CURRICULUM VITAE\n\n")
        elif layout == 2:
            b.add("Software Engineer\nName: ")
        elif layout == 3:
            b.add("RESUME\nHọ và tên: " if vietnamese else "RESUME\nFull name: ")
        b.add(name, pii="PERSON").add("\n")
    elif layout == 4:
        b.add("Giới thiệu: Tôi là " if vietnamese else "Summary: I am ").add(name, pii="PERSON").add(
            ", đang tìm việc lập trình.\n" if vietnamese else ", seeking an engineering role.\n"
        )
    elif layout == 5:
        b.add("Họ tên: " if vietnamese else "Candidate: ").add(name, pii="PERSON").add(" | Software Engineer\n")
    elif layout == 6:
        b.add("Ứng viên " if vietnamese else "Applicant ").add(name, pii="PERSON").add(" - Backend Developer\n")
    else:
        b.add("Sinh viên: " if vietnamese else "Student: ").add(name, pii="PERSON").add("\n")
    b.add("SYNTHETIC DRAFT - needs_human_review\n")
    email = f"candidate{index:03d}@example.test"
    b.add("Email: ").add(email, pii="EMAIL").add("\n")
    phones = [
        f"090 555 {index:04d}",
        f"+84 90 555 {index:04d}",
        f"+1 (202) 555-{100 + index:04d}",
        f"+44 20 7946 {index:04d}",
        f"090555{index:04d}",
        f"+8490555{index:04d}",
    ]
    b.add("Điện thoại: " if vietnamese else "Phone: ").add(phones[index % len(phones)], pii="PHONE").add("\n")
    b.add("CCCD: " if vietnamese else "National ID: ").add(f"099800{index:06d}", pii="ID").add("\n")
    if index % 4 == 0:
        b.add("Passport: ").add(f"X{1000000 + index}", pii="ID").add("\n")
    b.add("Ngày sinh: " if vietnamese else "DOB: ").add(f"{index % 27 + 1:02d}/03/2001", pii="DOB").add("\n")
    b.add("Địa chỉ: " if vietnamese else "Home address: ")
    address = f"{index + 11} đường Hoa Mai, phường 4" if vietnamese else f"{index + 11} Cedar Lane"
    b.add(address, pii="ADDRESS").add("\n")
    b.add("Location: ").add("Hà Nội, Việt Nam" if vietnamese else "London, United Kingdom", keep="CITY").add("\n")
    b.add("Profile: ").add(f"https://linkedin.com/in/synthetic-{index}", pii="URL").add("\nHandle: ").add(
        f"@synthetic_{index:03d}", pii="HANDLE"
    ).add("\n")
    b.add("Skills: ")
    for position, skill in enumerate(["Python", "React", "Machine Learning", "Project Management", "Java", "SQL"]):
        if position:
            b.add(", ")
        b.add(skill, keep="SKILL")
    employer = ["Acme Labs", "Johnson Controls", "FPT Software", "Microsoft", "Bright Systems", "Oracle"][index % 6]
    school = [
        "Brown University",
        "James Cook University",
        "Đại học Bách Khoa Hà Nội",
        "Stanford University",
        "National University",
        "University of London",
    ][index % 6]
    if index % 4:
        b.add("\nEmployer: ").add(employer, keep="EMPLOYER").add("\nSchool: ").add(school, keep="SCHOOL")
    else:
        b.add("\nWorked at ").add(employer, keep="EMPLOYER").add("; studied at ").add(school, keep="SCHOOL").add(".")
    b.add("\nEmployment: 2020-2024\nProject: Inventory Tracker\n")
    if index % 2:
        b.add("Người tham chiếu: " if vietnamese else "Referee: ").add(referee, pii="PERSON")
    else:
        b.add(referee, pii="PERSON").add(" hướng dẫn dự án." if vietnamese else " supervised the project.")
    b.add("\nReference email: ").add(f"referee{index:03d}@example.test", pii="EMAIL").add("\n")
    b.add("Literal user text: [[PERSON_1]]\n")
    filename = name.replace(" ", "_") + ".pdf"
    return {
        "id": f"cv-{index:03d}",
        "category": "cv",
        "language": language,
        "format": "scan_pdf" if index % 2 else "text_pdf",
        "review_status": "needs_human_review",
        "text": b.text,
        "entities": b.entities,
        "keep": b.keep,
        "filename": filename,
        "filename_entities": [{"start": 0, "end": len(filename) - 4, "kind": "PERSON", "text": filename[:-4]}],
        "document": f"documents/cv-{index:03d}/{filename}",
        "layout": layout,
    }


def extras() -> list[dict[str, Any]]:
    samples = []
    for index in range(18):
        category = ("jd", "tool_error", "advisor")[index % 3]
        language = ("vi", "en", "mixed")[(index // 3) % 3]
        b = Builder()
        if category == "jd":
            b.add("Hiring a Python engineer at ").add("Johnson Controls", keep="EMPLOYER").add(".\nRecruiter: ")
            b.add(VI_NAMES[index] if language != "en" else EN_NAMES[index], pii="PERSON").add("\nEmail: ")
        elif category == "tool_error":
            b.add("Upload failed for candidate ").add(EN_NAMES[index], pii="PERSON").add("; contact ")
        else:
            b.add("Sinh viên: " if language != "en" else "Student: ").add(
                VI_NAMES[index] if language != "en" else EN_NAMES[index], pii="PERSON"
            )
            b.add("\nMSSV: ").add(f"ST{800000 + index}", pii="ID").add("\nEmail: ")
        b.add(f"synthetic{index}@example.test", pii="EMAIL").add("\nPhone: ").add(
            f"+1 202 555 {200 + index:04d}", pii="PHONE"
        )
        b.add("\nURL: ").add(f"https://example.test/people/synthetic{index}", pii="URL").add("\n[[PERSON_1]]\n")
        if category == "advisor":
            b.add("Address: ").add(f"{100 + index} Oak Street", pii="ADDRESS").add("\nSchool: ").add(
                "Brown University", keep="SCHOOL"
            )
        samples.append(
            {
                "id": f"extra-{index:03d}",
                "category": category,
                "language": language,
                "format": "text",
                "review_status": "needs_human_review",
                "text": b.text,
                "entities": b.entities,
                "keep": b.keep,
            }
        )
    return samples


def render_pdf(sample: dict[str, Any], font: Path, root: Path) -> None:
    import pymupdf
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen.canvas import Canvas

    if "PrivacyFixture" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("PrivacyFixture", str(font)))
    buffer = BytesIO()
    canvas = Canvas(buffer, pagesize=(595, 842), invariant=1)
    canvas.setTitle("Synthetic CV - needs_human_review")
    canvas.setFont("PrivacyFixture", 11)
    y = 795
    for line in sample["text"].splitlines():
        # Every fixture line fits the A4 text area; fail instead of clipping.
        if pdfmetrics.stringWidth(line, "PrivacyFixture", 11) > 505 or y < 47:
            raise ValueError("Synthetic fixture needs layout review")
        canvas.drawString(45, y, line)
        y -= 24
    canvas.save()
    raw = buffer.getvalue()
    if sample["format"] == "scan_pdf":
        # Rasterize then discard the source text layer. Mild downsampling varies
        # scans without manufacturing real CVs or annotations from OCR output.
        randomizer = random.Random(sample["id"])
        with pymupdf.open(stream=raw, filetype="pdf") as source, pymupdf.open() as scanned:
            page = scanned.new_page(width=595, height=842)
            pixmap = source[0].get_pixmap(dpi=randomizer.choice([160, 180, 200]), alpha=False)
            page.insert_image(page.rect, stream=pixmap.tobytes("jpeg", jpg_quality=85))
            raw = scanned.tobytes(deflate=True)
    path = root / sample["document"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", type=Path, required=True)
    args = parser.parse_args()
    samples = [cv(index) for index in range(72)]
    for sample in samples:
        render_pdf(sample, args.font, ROOT)
    samples.extend(extras())
    with (ROOT / "golden.jsonl").open("w", encoding="utf-8") as stream:
        for sample in samples:
            stream.write(json.dumps(sample, ensure_ascii=False) + "\n")
    print("Generated 72 synthetic CVs (36 text PDFs, 36 scans), plus 18 auxiliary fixtures; all needs_human_review.")


if __name__ == "__main__":
    main()
