"""Tests cho pipeline gợi ý JD (Two-Stage Recommendation Pipeline)."""

import pytest

from src.services.jd_recommendation import extract_cv_query, recommend_top_jds_from_cv
from src.services.jd_store import get_jd_store


@pytest.fixture(scope="module", autouse=True)
def setup_vector_store():
    """Đảm bảo JD vector store đã được index trước khi test recommendation."""
    store = get_jd_store()
    store.index_from_fixtures()


def test_extract_cv_query():
    cv_text = """
    # Nguyen Van B
    Email: b@example.com

    ## Kỹ năng
    - Python, FastAPI, Docker, PostgreSQL

    ## Kinh nghiệm làm việc
    - Phát triển hệ thống backend e-commerce sử dụng FastAPI và Redis

    ## Sở thích
    - Chơi bóng đá, đọc sách
    """
    query = extract_cv_query(cv_text)
    assert "Python, FastAPI" in query
    assert "Phát triển hệ thống backend" in query
    assert "Chơi bóng đá" not in query


def test_recommend_empty_cv():
    results = recommend_top_jds_from_cv("")
    assert results == []

    results_whitespace = recommend_top_jds_from_cv("   \n\t  ")
    assert results_whitespace == []


def test_recommend_top_jds_from_cv_structure():
    cv_text = """
    # Nguyễn Văn A - Software Engineer
    ## Kỹ năng
    - Python, Flask, Django, Docker, PostgreSQL, Git, FastAPI, REST API
    ## Kinh nghiệm
    - 2 năm làm Backend Developer phát triển REST API với Python và PostgreSQL
    """

    results = recommend_top_jds_from_cv(cv_text, top_n=3)
    assert len(results) > 0
    assert len(results) <= 3

    # Kiểm tra cấu trúc từng JD được gợi ý
    top_jd = results[0]
    required_keys = [
        "jd_id",
        "title",
        "company",
        "industry",
        "level",
        "semantic_score",
        "match_score",
        "match_label",
        "matched_skills",
        "missing_skills",
        "breakdown",
    ]
    for key in required_keys:
        assert key in top_jd, f"Thiếu key: {key}"

    # Vị trí hàng đầu phải liên quan đến Backend Developer
    assert "Backend" in top_jd["title"] or "Python" in str(top_jd.get("matched_skills"))

    # Kết quả phải được sắp xếp theo match_score giảm dần
    scores = [r["match_score"] for r in results if r["match_score"] is not None]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.asyncio
async def test_generate_career_advice_with_llm():
    """Kiểm tra bước sinh lời khuyên nghề nghiệp (RAG Generation) với fallback an toàn."""
    from src.services.jd_recommendation import generate_career_advice_with_llm

    dummy_recs = [
        {
            "jd_id": "jd-be-intern",
            "title": "Backend Developer Intern (Python)",
            "company": "Tech Corp",
            "match_score": 75.0,
            "matched_skills": ["Python", "SQL", "FastAPI"],
            "missing_skills": ["Docker", "Redis"],
        }
    ]

    advice = await generate_career_advice_with_llm("CV Backend Developer", dummy_recs)
    assert "summary" in advice
    assert "top_position_advice" in advice
    assert "action_plan" in advice
    assert len(advice["action_plan"]) > 0
    assert "Backend Developer" in advice["summary"] or "Backend Developer" in advice["top_position_advice"]
