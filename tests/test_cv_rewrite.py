"""Kiểm tra câu AI đề xuất viết lại (dùng chung cho bước phân tích và Trình tối ưu)."""

from src.services.cv_rewrite import check_rewrite, keeps_original, only_cosmetic, rewrite_lines
from src.services.skill_matching import split_cv_lines

CV = """EXPERIENCE
Nielsen Vietnam 06/2023 - 09/2023
Fresher Data Analyst
Collected questionnaires and processed data for the market research model.
PROJECTS
Chat App 2024
Developed interactive chatinterface using Streamit forreai-time userinteraction
SKILLS
Python, SQL
"""


def lines_and_index():
    lines = split_cv_lines(CV)
    return lines, {line["line_no"]: line for line in lines}


def find(lines, text):
    return next(line for line in lines if line["text"].startswith(text))


def test_ocr_spacing_and_typo_fixes_are_not_suggestions():
    lines, by_no = lines_and_index()
    chat = find(lines, "Developed interactive")
    assert only_cosmetic(
        chat["text"], "Developed interactive chat interface using Streamlit for real-time user interaction"
    )
    assert (
        check_rewrite(
            chat, "Developed interactive chat interface using Streamlit for real-time user interaction", by_no
        )
        is None
    )
    # Viết lại thật sự (động từ, mục đích) thì giữ; chỉ thêm chỗ trống hỏi số liệu cũng giữ
    better = "Built the interactive chat interface with Streamlit for real-time user interaction in the app"
    assert check_rewrite(chat, better, by_no) == better
    assert check_rewrite(chat, chat["text"] + ", achieving [kết quả đo được]", by_no).endswith("[measurable result]")


def test_title_line_cannot_become_a_sentence_from_elsewhere():
    lines, by_no = lines_and_index()
    title = find(lines, "Fresher Data Analyst")
    assert not keeps_original(title["text"], "Processed data and built BI reports for the market research model.")
    assert (
        check_rewrite(title, "Collected questionnaires and processed data for the market research model.", by_no)
        is None
    )
    assert keeps_original(
        "&Enchanteurproducts quantitative data and", "Collected quantitative data for Enchanteur products."
    )


def test_only_description_lines_of_evidence_sections_are_reviewed():
    lines, _ = lines_and_index()
    reviewed = [line["text"] for line in rewrite_lines(lines)]
    assert "Python, SQL" not in reviewed
    assert any(t.startswith("Collected questionnaires") for t in reviewed)


def test_technology_lists_are_not_rewritten():
    from src.services.cv_rewrite import is_listing

    assert is_listing("Python,Java,Weka,scikit-learn")
    assert is_listing("Technologies: Python, FastAPI, PostgreSQL, Docker, Redis")
    # Câu mô tả kèm danh sách vẫn là câu
    assert not is_listing("Evaluated and compared 6 classification algorithms: SVM, Logistic Regression, OneR, J48")
    lines = split_cv_lines("PROJECTS\nChat App 2024\nPython, Selenium, Milvus, Docker, Streamlit\n")
    tech = find(lines, "Python, Selenium")
    by_no = {line["line_no"]: line for line in lines}
    assert check_rewrite(tech, "Technologies used: Python, Selenium, Milvus, Docker, Streamlit", by_no) is None
    assert tech not in rewrite_lines(lines)


WRAPPED = """WORK EXPERIENCE
VNPT IT | Backend Developer Intern August 2025 – December 2025
• Developed RESTful APIs using FastAPI to automate Markdown-to-PDF conversion and document metadata
management.
• Built a Jenkins CI/CD pipeline to automate Docker image builds, vulnerability scanning with Trivy, image publishing
to Docker Hub, and production deployment.
• Wrote unit tests with pytest.
"""


def test_wrapped_bullets_are_rewritten_as_one_sentence():
    from src.services.cv_optimizer import apply_changes
    from src.services.cv_rewrite import merge_wrapped, wrapped_line_nos

    lines = split_cv_lines(WRAPPED)
    units = {u["text"].split()[0]: u for u in merge_wrapped(lines, WRAPPED) if not u["is_heading"]}
    api = units["Developed"]
    assert api["text"].endswith("document metadata management.") and len(api["extra_line_nos"]) == 1
    assert units["Built"]["text"].endswith("to Docker Hub, and production deployment.")
    assert units["Wrote"]["extra_line_nos"] == []
    assert "management." not in units and wrapped_line_nos(lines, WRAPPED) >= {api["line_no"], *api["extra_line_nos"]}

    # Câu thay thế thay cả gạch ý: dòng nối bị bỏ, ký hiệu đầu dòng giữ nguyên
    out = apply_changes(
        WRAPPED,
        {api["line_no"]: "Built FastAPI services for Markdown-to-PDF conversion."},
        None,
        set(api["extra_line_nos"]),
    )
    assert "• Built FastAPI services for Markdown-to-PDF conversion." in out
    assert "\nmanagement.\n" not in out and "to Docker Hub, and production deployment." in out
