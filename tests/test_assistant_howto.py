"""How-to contracts use the existing guide index and gateway, never a live provider."""

import json
from pathlib import Path

import pytest

from eval.run_rag_eval import GoldenSample, retrieval_metrics
from src.config import get_settings
from src.services.assistant.chunker import MarkdownDocChunker
from src.services.assistant.hybrid_search import corpus_path
from src.services.assistant.indexer import build_assistant_index
from src.services.assistant.vector_store import AssistantVectorStore
from tests import test_assistant_rag

knowledge_base = test_assistant_rag.knowledge_base


def test_ingestion_metadata_roundtrip(knowledge_base) -> None:
    chunks = knowledge_base.vector_store.get_chunks()
    assert len({c.docs_version for c in chunks}) == 1
    assert len(chunks[0].docs_version) == 64
    assert all(c.route_id for c in chunks)
    upload = next(c for c in chunks if c.selector == '[data-agent-target="btn-upload-cv"]')
    assert upload.route_id == "cv_list"
    assert upload.ui_targets == ["btn-upload-cv"]
    saved = json.loads(corpus_path(knowledge_base.vector_store).read_text(encoding="utf-8"))
    assert sorted(saved["chunks"], key=lambda c: c["chunk_id"]) == sorted(
        [c.model_dump() for c in chunks], key=lambda c: c["chunk_id"]
    )


def test_corpus_version_changes_on_any_guide_edit(knowledge_base, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "assistant_chroma_persist_dir", str(tmp_path / "index"))
    docs = tmp_path / "docs"
    docs.mkdir()
    guide = docs / "guide.md"
    text = "---\nroute: /student/cv\nrole: student\ntitle: CV\ntags: [cv]\nui_targets: [btn-upload-cv]\n---\n# CV\nUpload PDF."
    guide.write_text(text, encoding="utf-8")
    build_assistant_index(str(docs))
    first = AssistantVectorStore().get_chunks()[0]
    assert first.ui_targets == ["btn-upload-cv"]
    build_assistant_index(str(docs))
    assert AssistantVectorStore().get_chunks()[0].docs_version == first.docs_version
    guide.write_text(text + " DOCX is accepted.", encoding="utf-8")
    build_assistant_index(str(docs))
    assert AssistantVectorStore().get_chunks()[0].docs_version != first.docs_version


@pytest.mark.parametrize(
    "metadata", ["route_id: advisor_home", "ui_targets: [advisor-student-search]", "ui_targets: [unknown]"]
)
def test_ingestion_rejects_invalid_action_metadata(metadata: str) -> None:
    text = f"---\nroute: /student/cv\nrole: student\ntitle: CV\ntags: [cv]\n{metadata}\n---\nUpload PDF."
    with pytest.raises(ValueError):
        MarkdownDocChunker().chunk(text)


def test_retrieval_matches_frozen_prechange_baseline(knowledge_base) -> None:
    samples = json.loads(Path("eval/rag_golden_dataset.json").read_text(encoding="utf-8"))
    baseline = json.loads(Path("eval/howto/retrieval_baseline.json").read_text(encoding="utf-8"))
    for row, before in zip(samples, baseline, strict=True):
        sample = GoldenSample.model_validate(row)
        assert sample.question == before["question"]
        chunks = knowledge_base.search(sample.question, sample.role, route=sample.current_route)
        assert [c["chunk_id"] for c in chunks] == before["chunk_ids"]
        after = retrieval_metrics(sample, chunks)
        assert after["context_recall"] >= before["metrics"]["context_recall"]
        assert after["context_precision"] >= before["metrics"]["context_precision"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message, phrase",
    [("How do I build a submarine?", "usage guide"), ("Cách chế tạo tàu ngầm?", "Tài liệu hướng dẫn")],
)
async def test_abstention_is_before_generation(message: str, phrase: str) -> None:
    from unittest.mock import MagicMock

    from src.models.assistant import ClientPageContext
    from src.services.assistant.agent import AssistantAgent

    llm = MagicMock()
    context = ClientPageContext(current_url="/student/cv", route="/student/cv", user_role="student")
    result = await AssistantAgent(llm=llm)._generate(
        {"message": message, "context": context, "sources": [], "confidence": "low", "intent": "qa"}
    )
    assert phrase in result["response"].message
    assert result["response"].sources == result["response"].actions == result["response"].ui_actions == []
    assert llm.mock_calls == []


def test_abstention_threshold_configured_before_generation(monkeypatch) -> None:
    from src.services.assistant.hybrid_search import select_citation_chunks

    monkeypatch.setattr(get_settings(), "rag_abstain_threshold", 0.6)
    assert select_citation_chunks([{"chunk_id": "low", "score": 0.599}]) == []
    assert select_citation_chunks([{"chunk_id": "boundary", "score": 0.6}])


def test_answer_cache_key_and_ttl_isolation() -> None:
    from src.services.assistant.howto import AnswerCache, GuideAnswer, answer_cache_key

    keys = [
        answer_cache_key("Cách tải CV?", *args)
        for args in [("student", "vi", "v1"), ("advisor", "vi", "v1"), ("student", "en", "v1"), ("student", "vi", "v2")]
    ]
    assert len(set(keys)) == 4
    assert keys[0] == answer_cache_key("  CACH  tai cv? ", "student", "vi", "v1")
    now = [0.0]
    cache = AnswerCache(maxsize=2, ttl_s=10, clock=lambda: now[0])
    cache.put(keys[0], GuideAnswer(message="Select a PDF.", sources=[]))
    assert all(cache.get(key) is None for key in keys[1:])
    cached = cache.get(keys[0])
    cached.message = "changed"
    assert cache.get(keys[0]).message == "Select a PDF."
    now[0] = 10.0
    assert cache.get(keys[0]) is None
