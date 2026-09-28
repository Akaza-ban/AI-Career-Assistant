import pytest

from src.agents.gap_analysis.graph import gap_analysis_agent
from src.services.taxonomy import (
    STATIC_TAXONOMY,
    apply_taxonomy_matching,
    check_skill_match,
    get_parent_skill,
)


def test_static_taxonomy_mappings():
    """Kiểm tra các cặp mapping taxonomy bắt buộc theo yêu cầu đề bài."""
    expected_pairs = {
        "FastAPI": "Python",
        "Flask": "Python",
        "Django": "Python",
        "PyTorch": "Machine Learning",
        "TensorFlow": "Machine Learning",
        "React": "JavaScript",
        "Next.js": "JavaScript",
    }
    for child, parent in expected_pairs.items():
        assert STATIC_TAXONOMY.get(child) == parent
        assert get_parent_skill(child) == parent


def test_taxonomy_skill_match_logic():
    """Kiểm tra logic so khớp kỹ năng trực tiếp và qua taxonomy."""
    # Trực tiếp
    match, _ = check_skill_match("Python", "Python")
    assert match is True

    # Ứng viên có kỹ năng con (FastAPI) đáp ứng yêu cầu cha (Python)
    match, reason = check_skill_match("FastAPI", "Python")
    assert match is True
    assert reason is not None and "taxonomy" in reason.lower()

    # Ứng viên có PyTorch đáp ứng yêu cầu Machine Learning
    match, _ = check_skill_match("PyTorch", "Machine Learning")
    assert match is True

    # Kỹ năng không liên quan
    match, _ = check_skill_match("React", "Python")
    assert match is False


def test_apply_taxonomy_matching_list():
    """Kiểm tra hàm so khớp danh sách kỹ năng tổng thể."""
    cv_skills = ["Flask", "Django", "PyTorch", "Git"]
    jd_skills = ["Python", "Machine Learning", "Docker", "Git"]

    matched, missing, tax_notes = apply_taxonomy_matching(cv_skills, jd_skills)

    assert "Git" in matched  # Trùng khớp trực tiếp
    assert "Python" in matched  # Match qua Flask/Django -> Python
    assert "Machine Learning" in matched  # Match qua PyTorch -> Machine Learning
    assert "Docker" in missing  # Thiếu Docker
    assert len(tax_notes) > 0


@pytest.mark.asyncio
async def test_gap_analysis_graph_4_nodes_flow():
    """
    Kiểm thử luồng chạy tuần tự 4 node của Gap Analysis Agent:
    parse -> retrieve -> compare -> generate
    """
    cv_text = """
    # Nguyễn Văn A - Software Engineer
    - Kỹ năng: Python, Flask, Django, Docker, PostgreSQL, Git
    - Kinh nghiệm: 2 năm làm Backend Developer với Flask và PostgreSQL.
    """
    jd_text = """
    Tuyển dụng Senior Python Backend Engineer:
    Yêu cầu: Python, FastAPI, PostgreSQL, Docker, Qdrant, Redis.
    Kinh nghiệm xây dựng REST API và triển khai hệ thống AI/Backend.
    """

    initial_state = {
        "cv_raw": cv_text,
        "jd_raw": jd_text,
    }

    result = await gap_analysis_agent.ainvoke(initial_state)

    # 1. Kiểm tra đầu ra matched_skills và missing_skills
    assert "matched_skills" in result
    assert "missing_skills" in result
    assert isinstance(result["matched_skills"], list)
    assert isinstance(result["missing_skills"], list)

    # Python, Docker, PostgreSQL là matched
    assert "Python" in result["matched_skills"]
    assert "PostgreSQL" in result["matched_skills"]
    assert "Docker" in result["matched_skills"]

    # Qdrant, Redis là missing
    assert "Qdrant" in result["missing_skills"]
    assert "Redis" in result["missing_skills"]

    # 2. Kiểm tra suggestions và ràng buộc evidence_span
    assert "suggestions" in result
    suggestions = result["suggestions"]
    assert len(suggestions) > 0

    for item in suggestions:
        assert "skill" in item
        assert "evidence_span" in item
        assert "suggested_revision" in item

        # RÀNG BUỘC CỐT LÕI: evidence_span PHẢI được trích từ CV gốc
        span = item["evidence_span"]
        assert span in cv_text, f"evidence_span '{span}' không có trong CV gốc!"

    # 3. Kiểm tra ngữ cảnh retrieved_context từ RAG (top-k=3-5)
    assert "retrieved_context" in result
    retrieved = result["retrieved_context"]
    assert 3 <= len(retrieved) <= 5
