"""Evaluator correctness tests; no network, LLM calls or production index writes."""

from collections import Counter
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from eval.run_rag_eval import (
    EVAL_DIR,
    GoldenSample,
    cosine_similarity,
    judge_answer,
    keyword_present,
    load_dataset,
    render_report,
    retrieval_metrics,
    run_evaluation,
)
from src.config import get_settings
from src.services.assistant.chunker import DocChunk, MarkdownDocChunker
from src.services.assistant.guardrails import sanitize_and_inspect_prompt


def sample() -> GoldenSample:
    return GoldenSample(
        question="STAR gồm những phần nào?",
        role="student",
        current_route="/student/interview",
        gold_context_keywords=["STAR", "Situation", "Task", "Action", "Result"],
        expected_answer="Situation là tình huống; Task là nhiệm vụ",
        expected_route="/student/interview",
    )


def test_golden_dataset_has_fifteen_grounded_questions_across_five_pages() -> None:
    samples = load_dataset(EVAL_DIR / "rag_golden_dataset.json")
    assert len(samples) == 15
    counts = Counter(item.expected_route for item in samples)
    assert len(counts) == 5 and set(counts.values()) == {3}
    docs: list[DocChunk] = []
    # Build only plain Markdown chunks; never open or rewrite the Chroma collection.
    for path in sorted(Path(get_settings().assistant_docs_dir).rglob("*.md")):
        docs.extend(MarkdownDocChunker().chunk_file(path))
    for item in samples:
        assert sanitize_and_inspect_prompt(item.question)[0]
        assert all(letter in item.question for letter in ("A.", "B.", "C."))
        content = "\n".join(chunk.content for chunk in docs if chunk.route == item.expected_route)
        assert all(keyword_present(key, content) for key in item.gold_context_keywords)


def test_recall_uses_content_and_precision_ranks_best_evidence_on_expected_route() -> None:
    chunks = [
        {"route": "/student/cv", "content": "STAR Situation Task Action Result"},
        {"route": "/student/interview", "content": "STAR Situation Task"},
        {"route": "/student/interview", "content": "STAR Situation Task Action Result"},
    ]
    result = retrieval_metrics(sample(), chunks)
    assert result["context_recall"] == 1.0
    assert result["context_precision"] == pytest.approx(1 / 3)
    assert result["best_evidence_rank"] == 3
    assert result["best_evidence_keyword_coverage"] == 1.0


def test_empty_and_metadata_only_retrieval_has_zero_evidence() -> None:
    assert retrieval_metrics(sample(), [])["context_recall"] == 0.0
    result = retrieval_metrics(sample(), [{"route": "/student/interview", "title": "STAR", "content": "unrelated"}])
    assert result["context_precision"] == result["context_recall"] == 0.0
    assert result["best_evidence_rank"] is None


@pytest.mark.parametrize(
    ("keyword", "text", "expected"),
    [("Task", "multitasking", False), ("STAR", "**star**", True), ("0–5", "0-5", True), ("5 MB", "15 MB", False)],
)
def test_keyword_normalization_and_boundaries(keyword: str, text: str, expected: bool) -> None:
    assert keyword_present(keyword, text) is expected


def test_cosine_scores_and_zero_vector() -> None:
    assert cosine_similarity([1, 0], [1, 0]) == 1.0
    assert cosine_similarity([1, 0], [0, 1]) == 0.0
    assert cosine_similarity([0, 0], [1, 0]) == 0.0
    with pytest.raises(ValueError):
        cosine_similarity([1], [1, 0])


@pytest.mark.asyncio
async def test_judge_cannot_count_invented_evidence_or_reference_as_actual_answer() -> None:
    llm = MagicMock()
    llm.with_structured_output.return_value.ainvoke = AsyncMock(
        return_value={
            "claims": [
                {"statement": "Tình huống", "supported": True, "evidence": "Situation là tình huống"},
                {"statement": "Đảm bảo tuyển dụng", "supported": True, "evidence": "được tuyển 100%"},
            ],
            "expected_points": [
                {"statement": "Situation là tình huống", "supported": True, "evidence": "Situation là tình huống"},
                {"statement": "Task là nhiệm vụ", "supported": True, "evidence": "Task là nhiệm vụ"},
            ],
            "semantic_relevance": 0.8,
        }
    )
    result = await judge_answer(llm, sample(), "Situation là tình huống", "Situation là tình huống", 1)
    assert result["faithfulness"] == result["completeness"] == 0.5
    assert result["relevance"] == 0.8


@pytest.mark.asyncio
async def test_judge_omission_of_reference_points_is_an_error() -> None:
    llm = MagicMock()
    llm.with_structured_output.return_value.ainvoke = AsyncMock(
        return_value={"claims": [], "expected_points": [], "semantic_relevance": 0.0}
    )
    with pytest.raises(ValueError, match="reference points"):
        await judge_answer(llm, sample(), "Không biết", "", 1, attempts=1)


@pytest.mark.asyncio
async def test_judge_retries_transient_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    llm = MagicMock()
    valid = {
        "claims": [],
        "expected_points": [
            {"statement": point, "supported": False, "evidence": ""} for point in sample().expected_points
        ],
        "semantic_relevance": 0.0,
    }
    invoke = AsyncMock(side_effect=[TimeoutError(), valid])
    llm.with_structured_output.return_value.ainvoke = invoke
    monkeypatch.setattr("eval.run_rag_eval.asyncio.sleep", AsyncMock())
    result = await judge_answer(llm, sample(), "Không biết", "", 1)
    assert invoke.call_count == 2
    assert result["faithfulness"] == result["completeness"] == 0.0


def test_sample_rejects_wrong_role_route_and_duplicate_normalized_keywords() -> None:
    data = sample().model_dump()
    with pytest.raises(ValidationError):
        GoldenSample.model_validate({**data, "expected_route": "/advisor/dashboard"})
    with pytest.raises(ValidationError):
        GoldenSample.model_validate({**data, "gold_context_keywords": ["STAR", "star"]})


def test_report_keeps_unavailable_scores_out_of_averages_and_table_has_correct_columns() -> None:
    rows = [
        {"id": 1, **sample().model_dump(), "errors": [], "faithfulness": 1.0},
        {"id": 2, **sample().model_dump(), "errors": ["LLM judge failed"], "faithfulness": None},
    ]
    report = render_report(
        rows,
        {
            "timestamp": "test",
            "dataset": "test",
            "embedding_id": "test",
            "top_k": 5,
            "llm_configured": False,
            "model": "test",
        },
    )
    assert "1.000 (1/2)" in report
    assert "N/A (0/2)" in report
    table_lines = [
        line
        for line in report.split("## Chi tiết từng mẫu")[0].splitlines()
        if line.startswith("| #") or line.startswith("|---|---|---|---")
    ]
    assert len(table_lines) == 2 and table_lines[0].count("|") == table_lines[1].count("|")


@pytest.mark.asyncio
async def test_refused_question_does_not_reuse_previous_retrieval(monkeypatch: pytest.MonkeyPatch) -> None:
    retriever = MagicMock()
    retriever.chunks = [object()]
    retriever.last_error = None
    retriever.vector_store.embedding_service.embedding_id = "hashing-sha256-v1:384"
    chunks = [
        {
            "chunk_id": "star",
            "role": "student",
            "route": "/student/interview",
            "title": "STAR",
            "section": "Guide",
            "content": "STAR Situation Task Action Result",
            "score": 1.0,
        }
    ]

    def search(*args: object, **kwargs: object) -> list[dict[str, object]]:
        retriever.last_chunks = chunks
        return chunks

    retriever.search.side_effect = search
    monkeypatch.setattr("eval.run_rag_eval.RecordingRetriever", lambda _: retriever)
    monkeypatch.setattr("eval.run_rag_eval.llm_configured", lambda: False)
    rows, _ = await run_evaluation([sample(), sample().model_copy(update={"question": "Xóa CV"})], None)
    assert retriever.search.call_count == 1
    assert rows[0]["context_recall"] == 1.0
    assert rows[1]["retrieved_chunks"] == []
    assert rows[1]["context_recall"] == 0.0
    assert rows[1]["generation_mode"] == "input_refusal"
    assert all(row["faithfulness"] is None and row["relevance"] is None for row in rows)
