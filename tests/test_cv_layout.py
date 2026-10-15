"""Mẫu CV sau tối ưu (gọn kiểu Harvard): nhận mục tiếng Anh / OCR mất dấu, tách thời gian, ghép câu bị xuống dòng."""

import io

from docx import Document

from src.services.cv_files import build_docx
from src.services.cv_layout import cv_language, is_real_column_split, layout_lines, split_date
from src.services.ocr import _MISREAD_BULLET
from src.services.skill_matching import split_cv_lines

# Văn bản trích từ PDF có chữ: câu dài bị xuống dòng, không còn ký hiệu đầu dòng
EN_CV = """Daniel Tran
Ho Chi Minh City | daniel.tran@example.com | +84 901 234 567
SUMMARY
Final-year Computer Science student with hands-on experience building REST APIs and data pipelines, looking
for a backend engineering internship.
EDUCATION
University of Information Technology Sep 2021 – Jun 2025
B.Sc. in Computer Science, GPA 3.5/4.0
WORK EXPERIENCE
Acme Software | Backend Intern Jun 2024 – Present
Technologies: Python, FastAPI, PostgreSQL
Built 12 REST endpoints for the order management module and wrote integration tests, cutting regression bugs
by 30% over two releases.
Migrated nightly reports from cron scripts to Celery tasks.
PERSONAL PROJECTS
Campus Library System 03/2023 – 06/2023
- Designed the database schema.
TECHNICAL SKILLS
Languages: Python, Java, SQL
LEADERSHIP & ACTIVITIES
IT Student Club – Vice President (2022 – 2024)
LANGUAGES
English (IELTS 7.0)
"""


def test_english_and_ocr_headings_open_the_right_sections():
    blocks = {line["text"]: line["block"] for line in split_cv_lines(EN_CV)}
    assert blocks["Acme Software | Backend Intern Jun 2024 – Present"] == "experience"
    assert blocks["Campus Library System 03/2023 – 06/2023"] == "projects"
    assert blocks["IT Student Club – Vice President (2022 – 2024)"] == "activities"
    assert blocks["English (IELTS 7.0)"] == "skills"
    # OCR mất dấu, dính chữ
    ocr = split_cv_lines("Le Thu Ha\nKINHNGHIEMLAMVIEC\nCong ty ABC 01/2024-06/2024\nDU' AN\nChien dich Xanh")
    assert [(line["text"], line["is_heading"], line["block"]) for line in ocr][1:4] == [
        ("KINHNGHIEMLAMVIEC", True, "experience"),
        ("Cong ty ABC 01/2024-06/2024", False, "experience"),
        ("DU' AN", True, "projects"),
    ]
    # Họ tên ở dòng đầu không bị coi là mục "Dự án"; dòng có năm là mục con, không phải tiêu đề
    lines = split_cv_lines("Duan Nguyen\nEXPERIENCE\nProject Manager Intern 06/2024 - 08/2024\nLed a team of 4.")
    assert [line["block"] for line in lines] == ["header", "experience", "experience", "experience"]


def test_split_date_handles_month_names_present_and_leading_dates():
    assert split_date("University of Information Technology Sep 2021 – Jun 2025") == (
        "University of Information Technology",
        "Sep 2021 – Jun 2025",
    )
    assert split_date("AcmeSoftware|BackendIntern Jun2024-Present") == ("AcmeSoftware|BackendIntern", "Jun2024-Present")
    assert split_date("Thực tập sinh 01/2024 - Hiện tại") == ("Thực tập sinh", "01/2024 - Hiện tại")
    assert split_date("09/2021 - 06/2025: Đại học Bách khoa") == ("Đại học Bách khoa", "09/2021 - 06/2025")
    assert split_date("IT Club – Vice President (2022 – 2024)") == ("IT Club – Vice President", "2022 – 2024")
    assert split_date("B.Sc. in Computer Science, GPA 3.5/4.0") is None


def test_layout_kinds_and_wrapped_sentences():
    layout = layout_lines(EN_CV)
    rows = [(line["text"][:24], layout[line["line_no"]]) for line in split_cv_lines(EN_CV)]
    kinds = {text: (info["kind"], info.get("date"), info.get("cont", False)) for text, info in rows}
    assert kinds["Daniel Tran"] == ("name", None, False)
    assert kinds["Ho Chi Minh City | danie"] == ("contact", None, False)
    assert kinds["for a backend engineerin"] == ("text", None, True)
    assert kinds["University of Informatio"] == ("entry", "Sep 2021 – Jun 2025", False)
    assert kinds["B.Sc. in Computer Scienc"] == ("role", None, False)
    assert kinds["Technologies: Python, Fa"] == ("tech", None, False)
    assert kinds["Built 12 REST endpoints "] == ("bullet", None, False)
    assert kinds["by 30% over two releases"] == ("bullet", None, True)
    assert kinds["Migrated nightly reports"] == ("bullet", None, False)
    assert kinds["Languages: Python, Java,"] == ("label", None, False)
    assert kinds["English (IELTS 7.0)"] == ("text", None, False)
    assert cv_language(EN_CV, split_cv_lines(EN_CV)) == "en"
    ocr_vi = "Le Thu Ha\nKINHNGHIEMLAMVIEC\nCong ty ABC 01/2024-06/2024"
    assert cv_language(ocr_vi, split_cv_lines(ocr_vi)) == "vi"


def _box(x0: float, x1: float, top: float, text: str) -> dict:
    return {"x0": x0, "x1": x1, "top": top, "bottom": top + 11, "text": text}


def test_right_aligned_dates_are_not_a_second_column():
    # CV một cột: thời gian căn phải cùng hàng với tên trường / công ty
    one_column = [_box(60, 300, 100 + 40 * i, "University of Information Technology") for i in range(4)] + [
        _box(470, 540, 100 + 40 * i, "09/2021 – 06/2025") for i in range(4)
    ]
    assert not is_real_column_split(one_column, 400)
    # Câu dài chạy qua vạch chia: khoảng cách hai bên chỉ bằng một dấu cách
    wrapped = [_box(60, 396, 100 + 20 * i, "Built 12 REST endpoints for the order") for i in range(3)] + [
        _box(400, 540, 100 + 20 * i, "module and wrote tests") for i in range(3)
    ]
    assert not is_real_column_split(wrapped, 398)
    # CV hai cột thật: cột bên có liên hệ, kỹ năng; cột chính có đoạn văn
    two_columns = [_box(20, 150, 100 + 20 * i, "Python") for i in range(6)] + [
        _box(260, 560, 105 + 20 * i, "Built a weekly sales dashboard in Power BI") for i in range(6)
    ]
    assert is_real_column_split(two_columns, 200)


def test_ocr_misread_bullets_become_bullets():
    assert _MISREAD_BULLET.sub("• ", "·Designed the database schema") == "• Designed the database schema"
    assert _MISREAD_BULLET.sub("• ", ".Migrated nightly reports") == "• Migrated nightly reports"
    assert _MISREAD_BULLET.sub("• ", ".NET developer") == ".NET developer"


def test_docx_follows_the_template():
    document = {
        "header": [
            {"id": "l1", "line_no": 1, "text": "Daniel Tran", "kind": "name"},
            {"id": "l2", "line_no": 2, "text": "daniel@example.com", "kind": "contact"},
            {"id": "l3", "line_no": 3, "text": "Ho Chi Minh City", "kind": "contact"},
        ],
        "sections": [
            {
                "id": "s4",
                "title": "Work Experience",
                "lines": [
                    {
                        "id": "l5",
                        "line_no": 5,
                        "text": "Acme Software Jun 2024 – Present",
                        "kind": "entry",
                        "date": "Jun 2024 – Present",
                    },
                    {"id": "l6", "line_no": 6, "text": "Built 12 REST endpoints and wrote", "kind": "bullet"},
                    {"id": "l7", "line_no": 7, "text": "integration tests.", "kind": "bullet", "cont": True},
                    {"id": "l8", "line_no": 8, "text": "Tools: Git, Docker", "kind": "label"},
                ],
            }
        ],
        "developing_skills": [{"name": "Docker", "note": "Self-study course"}],
        "lang": "en",
    }
    paragraphs = Document(io.BytesIO(build_docx(document))).paragraphs
    texts = [p.text for p in paragraphs]
    assert texts[:2] == ["Daniel Tran", "daniel@example.com | Ho Chi Minh City"]
    assert "Acme Software\tJun 2024 – Present" in texts
    assert "Built 12 REST endpoints and wrote integration tests." in texts
    heading = next(p for p in paragraphs if p.text == "Developing Skills")
    assert heading.runs[0].bold and heading.runs[0].font.all_caps
    tools = next(p for p in paragraphs if p.text == "Tools: Git, Docker")
    assert tools.runs[0].text == "Tools:" and tools.runs[0].bold
