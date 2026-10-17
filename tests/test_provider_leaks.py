"""Golden integration: real local NER, recording providers, no network inference."""

import json
import logging
import re

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage
from langchain_core.runnables.config import var_child_runnable_config
from langsmith import tracing_context
from langsmith.run_helpers import get_tracing_context
from sqlalchemy import select

from eval.pii.dataset import load_synthetic
from src.agents.gap_analysis.graph import gap_analysis_agent
from src.agents.gap_analysis.nodes import compare_gap, retrieve_context, verify_grounding
from src.config import get_settings
from src.db.database import SessionLocal
from src.db.models import CvVersion, GapAnalysis, JobDescription, ProviderUsage
from src.services import gap_analysis, guardrails
from src.services.jd_store import JDDocumentStore
from src.services.privacy import ner
from src.services.privacy.detectors import Detector
from src.services.providers import gateway
from src.services.skill_matching import assess_by_rules, compute_score, normalize_requirements, split_cv_lines

REQUIREMENTS = [{"name": name, "importance": "required"} for name in ("Python", "SQL", "Docker")]


class RecordingAnalysisProvider:
    def __init__(self):
        self.requests = []

    async def ainvoke(self, prompt, **kwargs):
        assert get_tracing_context()["enabled"] is False
        self.requests.append({"prompt": prompt, **kwargs})
        logging.getLogger("provider.fake").debug("Full model request: %s", prompt)
        if "Hãy trích xuất" in prompt:
            content = {"requirements": REQUIREMENTS}
        else:
            lines = [(int(m[1]), m[2], m[3]) for m in re.finditer(r"^\[(\d+)\|([^\]]+)\] (.*)$", prompt, re.M)]
            scored = []
            for index, skill in enumerate(("Python", "SQL", "Docker"), start=1):
                matches = [line for line in lines if skill in line[2]]
                descriptive = [line for line in matches if "Kinh nghiệm" in line[1]]
                chosen = (descriptive or matches)[-1:] or []
                scored.append(
                    {
                        "id": f"r{index}",
                        "match": 1 if descriptive else 0.5 if matches else 0,
                        "evidence_lines": [line[0] for line in chosen],
                        "note": "",
                    }
                )
            evidence = [line for line in lines if "Viết API Python" in line[2]]
            content = {
                "requirements": scored,
                "summary": "Python has concrete evidence.",
                "suggestions": [
                    {
                        "requirement_id": "r1",
                        "line": line[0],
                        "rewrite": line[2].replace("API Python", "Python API"),
                        "reason": "Clear evidence",
                    }
                    for line in evidence
                ],
            }
        return AIMessage(
            content=json.dumps(content, ensure_ascii=False),
            usage_metadata={"input_tokens": 120, "output_tokens": 80, "total_tokens": 200},
        )


class RecordingEmbeddings(Embeddings):
    def __init__(self):
        self.requests = []

    def embed_documents(self, texts):
        assert get_tracing_context()["enabled"] is False
        self.requests.append(texts)
        logging.getLogger("provider.fake").debug("Embedding body: %s", texts)
        return [[1.0, float("Python" in text), float("SQL" in text), 0.5] for text in texts]

    def embed_query(self, text):
        return self.embed_documents([text])[0]


class TraceRecorder(BaseCallbackHandler):
    def __init__(self):
        self.events = []

    def on_chain_start(self, *args, **kwargs):
        self.events.append(args)

    def on_llm_start(self, *args, **kwargs):
        self.events.append(args)


@pytest.fixture
def golden_providers(monkeypatch, tmp_path):
    # Exercise the actual selected, packaged CPU NER (no annotated/oracle detector).
    monkeypatch.setattr(ner, "_detector", Detector(ner.load_ner(get_settings().pii_ner_backend)))
    provider = RecordingAnalysisProvider()
    embedding = RecordingEmbeddings()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: provider)
    monkeypatch.setattr(compare_gap, "llm_configured", lambda: True)
    monkeypatch.setattr(retrieve_context, "llm_configured", lambda: True)
    monkeypatch.setattr(gap_analysis, "llm_configured", lambda: True)
    monkeypatch.setattr(get_settings(), "provider_input_usd_per_million", 1.0)
    monkeypatch.setattr(get_settings(), "provider_output_usd_per_million", 2.0)
    monkeypatch.setattr(
        verify_grounding,
        "check_output_grounding",
        lambda **kwargs: guardrails.check_output_grounding(**kwargs, db_path=tmp_path / "audit.db"),
    )
    return provider, embedding


def identifiers(samples):
    return {sample.text[entity.start : entity.end] for sample in samples for entity in sample.entities}


@pytest.mark.asyncio
async def test_golden_analysis_and_jd_embeddings_have_zero_request_log_or_trace_identifiers(
    golden_providers, tmp_path, caplog
):
    provider, embeddings = golden_providers
    samples = load_synthetic()
    cvs = [sample for sample in samples if sample.category == "cv"]
    jds = [sample for sample in samples if sample.category == "jd"]
    store = JDDocumentStore(collection_name="golden_gateway", embeddings=embeddings)
    store.persist_dir = str(tmp_path / "chroma")
    fixture = tmp_path / "jds.json"
    fixture.write_text(
        json.dumps(
            [
                {"id": sample.id, "title": "Python Engineer", "content": sample.text, "skills": REQUIREMENTS}
                for sample in jds
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    with SessionLocal() as db:
        before = set(db.scalars(select(ProviderUsage.id)))
    trace = TraceRecorder()
    token = var_child_runnable_config.set({"callbacks": [trace]})
    deltas = []
    try:
        with tracing_context(enabled=True), caplog.at_level(logging.DEBUG):
            assert store.index_from_fixtures(str(fixture)) == len(jds)
            for sample in cvs:
                candidate = next(
                    sample.text[entity.start : entity.end] for entity in sample.entities if entity.kind == "PERSON"
                )
                cv_text = sample.text + f"\nKINH NGHIỆM\nViết API Python cùng {candidate}\n"
                jd_text = jds[0].text + "\nRequirements: Python, SQL, Docker."
                with gateway.provider_scope(user_id="sv-0142", origins=(f"cv:{sample.id}", "jd:golden")) as scope:
                    scope.prime(cv_text, f"cv:{sample.id}")
                    scope.prime(jd_text, "jd:golden")
                    result = await gap_analysis_agent.ainvoke({"cv_raw": cv_text, "jd_raw": jd_text})
                    assert result["llm_used"] and result["llm_calls"] == 2, sample.id
                    assert result["requirements"]
                    for item in result["assessments"]:
                        if item["evidence"]:
                            assert item["evidence"]["text"] in cv_text
                    assert result["suggestions"] and candidate in result["suggestions"][0]["original_text"]
                    assert candidate in result["suggestions"][0]["suggested_revision"]
                    baseline, _ = compute_score(
                        [assess_by_rules(r, split_cv_lines(cv_text)) for r in normalize_requirements(REQUIREMENTS)]
                    )
                    deltas.append(result["match_score"] - baseline)
                    assert store.search_candidates(cv_text, top_k=1)
    finally:
        var_child_runnable_config.reset(token)
    recorded = json.dumps([provider.requests, embeddings.requests, trace.events], ensure_ascii=False, default=str)
    for identifier in identifiers(cvs + jds):
        assert identifier not in recorded, identifier
        assert identifier not in caplog.text, identifier
    assert trace.events == []
    assert len(provider.requests) == len(cvs) * 2
    assert len(embeddings.requests) == len(cvs) + 1
    assert deltas == [0.0] * len(cvs)
    with SessionLocal() as db:
        rows = list(db.scalars(select(ProviderUsage).where(ProviderUsage.id.not_in(before))))
    assert len(rows) == len(cvs) * 3 + 1
    assert all(row.status == "success" for row in rows)
    assert sum(row.user_id == "sv-0142" for row in rows) == len(cvs) * 3
    assert sum(row.user_id == "system" for row in rows) == 1


@pytest.mark.asyncio
async def test_background_job_accounts_to_owner_and_stores_unmasked_business_records(golden_providers):
    sample = next(sample for sample in load_synthetic() if sample.category == "cv")
    candidate = next(sample.text[entity.start : entity.end] for entity in sample.entities if entity.kind == "PERSON")
    with SessionLocal() as db:
        cv = CvVersion(
            id="gateway-bg-cv",
            owner_id="sv-0142",
            version=9127,
            file_name=sample.filename,
            file_type="pdf",
            size_bytes=1024,
            content_text=sample.text + f"\nKINH NGHIỆM\nViết API Python cùng {candidate}",
        )
        jd = JobDescription(
            id="gateway-bg-jd",
            owner_id="sv-0142",
            source="pasted",
            title="Engineer",
            content="Python, SQL, Docker. Recruiter: Alice Morgan mail@example.test",
            skills=[],
        )
        analysis = GapAnalysis(
            id="gateway-bg-analysis",
            owner_id="sv-0142",
            cv_version_id=cv.id,
            cv_file_name=sample.filename,
            cv_label="v1.0",
            jd_id=jd.id,
            status="processing",
            current_step="parse",
        )
        db.add_all([cv, jd, analysis])
        db.commit()
        before = set(db.scalars(select(ProviderUsage.id)))
    await gap_analysis.run_analysis("gateway-bg-analysis")
    with SessionLocal() as db:
        result = db.get(GapAnalysis, "gateway-bg-analysis")
        assert result.status == "completed" and result.llm_calls == 2
        assert candidate in json.dumps(result.result, ensure_ascii=False)
        assert db.get(JobDescription, "gateway-bg-jd").skills == [dict(item, aliases=[]) for item in REQUIREMENTS]
        rows = list(db.scalars(select(ProviderUsage).where(ProviderUsage.id.not_in(before))))
        assert len(rows) == 2 and all(row.user_id == "sv-0142" and row.status == "success" for row in rows)
        assert all(row.cost_usd > 0 and row.cost_known for row in rows)
        db.delete(db.get(GapAnalysis, "gateway-bg-analysis"))
        db.delete(db.get(JobDescription, "gateway-bg-jd"))
        db.delete(db.get(CvVersion, "gateway-bg-cv"))
        db.commit()
