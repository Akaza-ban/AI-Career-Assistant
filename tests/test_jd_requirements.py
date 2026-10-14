"""Yêu cầu JD dùng để chấm điểm: JD tự dán chỉ có kỹ năng theo từ điển thì trích lại bằng AI."""

from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import delete

from src.db.database import SessionLocal, init_db
from src.db.models import JobDescription
from src.db.seed import DEMO_STUDENT_ID
from src.services.jd_requirements import requirements_for

JD_TEXT = "Thực tập sinh AI Engineer. Yêu cầu: Python, LLM, RAG, chatbot; ưu tiên kinh nghiệm pipeline dữ liệu."
EXTRACT = "src.agents.gap_analysis.nodes.retrieve_context.extract_requirements_with_llm"


@pytest.fixture
def pasted_jd():
    init_db()
    with SessionLocal() as db:
        jd = JobDescription(
            id="jd_test_reqs",
            source="pasted",
            owner_id=DEMO_STUDENT_ID,
            title="Thực tập sinh AI Engineer",
            content=JD_TEXT,
            skills=[{"name": "Python", "importance": "required", "aliases": []}],
            skills_source="sections",
        )
        db.add(jd)
        db.commit()
    yield "jd_test_reqs"
    with SessionLocal() as db:
        db.execute(delete(JobDescription).where(JobDescription.id == "jd_test_reqs"))
        db.commit()


@pytest.mark.asyncio
async def test_pasted_jd_is_extracted_by_ai_and_saved(pasted_jd):
    ai = [
        {"name": "Python", "importance": "required"},
        {"name": "LLM", "importance": "required", "aliases": ["GPT"]},
        {"name": "RAG", "importance": "preferred"},
    ]
    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch(EXTRACT, new=AsyncMock(return_value=ai)),
        SessionLocal() as db,
    ):
        skills, source = await requirements_for(db, db.get(JobDescription, pasted_jd))
    assert source == "llm"
    assert [s["name"] for s in skills] == ["Python", "LLM", "RAG"]
    with SessionLocal() as db:
        jd = db.get(JobDescription, pasted_jd)
        assert jd.skills_source == "analysis" and len(jd.skills) == 3


@pytest.mark.asyncio
async def test_ai_failure_keeps_dictionary_skills_untrusted(pasted_jd):
    with (
        patch("src.services.llm.llm_configured", return_value=True),
        patch(EXTRACT, new=AsyncMock(side_effect=TimeoutError())),
        SessionLocal() as db,
    ):
        skills, source = await requirements_for(db, db.get(JobDescription, pasted_jd))
    assert source == "dictionary" and [s["name"] for s in skills] == ["Python"]
    with SessionLocal() as db:
        assert db.get(JobDescription, pasted_jd).skills_source == "sections"


@pytest.mark.asyncio
async def test_library_jd_uses_its_skills_without_ai():
    extract = AsyncMock()
    with patch("src.services.llm.llm_configured", return_value=True), patch(EXTRACT, new=extract), SessionLocal() as db:
        skills, source = await requirements_for(db, db.get(JobDescription, "jd-be-intern"))
    assert source == "given" and len(skills) > 0
    extract.assert_not_called()
