"""Nhận xét ghép từ bảng cuối, kỹ năng cha không thấp hơn kỹ năng con, bỏ yêu cầu chung chung khi trích."""

from src.agents.gap_analysis.nodes.retrieve_context import is_generic_requirement
from src.services.fit_summary import compose_summary
from src.services.skill_matching import assessment, lift_parents, normalize_requirements, split_cv_lines

CV = """PROJECTS
Maintenance Management Platform 07/2023 - 11/2023
Software Engineer
Technologies: Python, FastAPI, PostgreSQL, Docker, Redis
Sử dụng Redis để cache dữ liệu trạng thái thiết bị.
SKILLS
Python, FastAPI, Git
"""


def scored(cv: str, levels: dict[str, tuple[str, float]]):
    """Bảng giả: {tên: (mức yêu cầu, match)}; dòng bằng chứng là dòng đầu tiên có tên kỹ năng."""
    lines = split_cv_lines(cv)
    reqs = normalize_requirements([{"name": n, "importance": imp} for n, (imp, _) in levels.items()])
    rows = []
    for r in reqs:
        match = levels[r["name"]][1]
        line = next((x for x in lines if r["name"].lower() in x["text"].lower()), None) if match else None
        rows.append(assessment(r, match, line, None, "llm"))
    return reqs, rows, lines


def test_summary_matches_table_and_names_the_project():
    _, rows, lines = scored(
        CV,
        {
            "Redis": ("additional", 1),
            "FastAPI": ("preferred", 0.5),
            "Git": ("preferred", 0.5),
            "Unit test": ("additional", 0),
        },
    )
    assert compose_summary(rows, lines) == (
        "Đáp ứng tốt: Redis. FastAPI, Git mới được liệt kê: thêm một câu mô tả bạn đã dùng các kỹ năng này làm gì, "
        "ví dụ trong dự án Maintenance Management Platform. Còn thiếu Unit test (Bổ trợ): nên học thêm để tăng mức "
        "phù hợp."
    )


def test_missing_required_comes_first_and_never_says_add_to_cv():
    _, rows, lines = scored(CV, {"Python": ("required", 0.5), "LLM": ("required", 0), "Chatbot": ("preferred", 0)})
    summary = compose_summary(rows, lines)
    assert summary.startswith(
        "Còn thiếu 1 yêu cầu Bắt buộc: LLM. Thiếu yêu cầu Bắt buộc là lý do phổ biến khiến CV bị loại ở vòng lọc hồ "
        "sơ. Còn thiếu yêu cầu Ưu tiên: Chatbot. Nên học"
    )
    assert "Python mới được liệt kê" in summary
    assert compose_summary([], lines) is None


def test_parent_is_lifted_to_child_level():
    """FastAPI được chấm ● thì Python (kỹ năng cha) không còn ◐."""
    reqs, rows, lines = scored(CV, {"Python": ("required", 0.5), "FastAPI": ("preferred", 1)})
    by_no = {x["line_no"]: x for x in lines}
    lifted = {a["skill"]: a for a in lift_parents(reqs, rows, by_no)}
    assert lifted["Python"]["match"] == 1 and lifted["Python"]["status"] == "matched"
    assert lifted["Python"]["note"] == "FastAPI → tính là Python (taxonomy)"
    assert lifted["FastAPI"]["match"] == 1


def test_generic_requirements_are_dropped():
    assert is_generic_requirement("Programming fundamentals")
    assert is_generic_requirement("Lập trình cơ bản")
    assert not is_generic_requirement("Python")
