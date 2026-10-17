"""Harness correctness only. Recorded stubs here never establish router quality."""

import hashlib
import json
import subprocess
import sys
import types
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from eval import run
from eval.router import backends
from eval.router.backends import RouterInput, RouterPrediction, load_backend, register_backend
from eval.router.dataset import ROOT, NavSlots, RouterRow, load_contexts, load_rows
from eval.router.metrics import Observation, metrics, percentile, threshold_gates


def row(label: str, **updates: Any) -> RouterRow:
    values = dict(
        id="unit-" + label,
        text="Unit example " + label,
        role="student",
        page_route_id="student_home",
        label=label,
        language="en",
        tags=["en", "synthetic"],
    )
    if label in {"navigate", "result"}:
        values["slots"] = NavSlots(target="cv" if label == "navigate" else "analysis")
    if label == "deny":
        values["deny_reason"] = "unsafe"
    values.update(updates)
    return RouterRow.model_validate(values)


def prediction(label: str, **updates: Any) -> RouterPrediction:
    values = dict(route=label, source="rules")
    values.update(updates)
    return RouterPrediction.model_validate(values)


def observation(gold: str, predicted: str, **updates: Any) -> Observation:
    return Observation(row(gold), prediction(predicted, **updates), 1.0)


class RecordedBackend:
    def __init__(self, outputs: list[Any]) -> None:
        self.outputs: Iterator[Any] = iter(outputs)
        self.requests: list[RouterInput] = []
        self.clears = 0

    def clear_cache(self) -> None:
        self.clears += 1

    def predict(self, request: RouterInput) -> Any:
        self.requests.append(request)
        if len(self.requests) == 1:
            return prediction("smalltalk")  # Untimed neutral warmup.
        value = next(self.outputs)
        if isinstance(value, Exception):
            raise value
        return value


def test_confusion_precision_recall_and_directional_pairs() -> None:
    samples = [
        observation("navigate", "howto"),
        observation("howto", "navigate", slots={"target": "page"}),
        observation("locate", "howto"),
        observation("howto", "locate"),
        observation("result", "navigate", slots={"target": "cv"}),
        observation("navigate", "result", slots={"target": "analysis"}),
        observation("howto", "howto"),
        observation("smalltalk", "smalltalk"),
        Observation(row("locate"), None, 2, "prediction_error"),
    ]
    result = metrics(samples)
    assert result["accuracy"] == 2 / 9
    assert result["per_route"]["howto"] == {"precision": 1 / 3, "recall": 1 / 3, "support": 3, "predicted": 3}
    assert result["per_route"]["locate"]["recall"] == 0
    assert result["confusion_matrix"]["locate"]["<error>"] == 1
    assert sum(sum(values.values()) for values in result["confusion_matrix"].values()) == 9
    for pair, left, right, support in [
        ("navigate<->howto", "navigate", "howto", 5),
        ("locate<->howto", "locate", "howto", 5),
        ("result<->navigate", "result", "navigate", 3),
    ]:
        assert result["confusion_pairs"][pair] == {
            f"{left}_to_{right}": 1,
            f"{right}_to_{left}": 1,
            "total": 2,
            "support": support,
            "rate": 2 / support,
        }


def test_slot_exact_match_counts_wrong_route_missing_and_spurious_qualifiers() -> None:
    samples = [
        observation("navigate", "navigate", slots={"target": "cv"}),
        observation("navigate", "navigate", slots={"target": "cv", "latest": True}),
        observation("navigate", "howto", slots={"target": "cv"}),
        observation("navigate", "navigate"),
        observation("result", "result", slots={"target": "analysis"}),
    ]
    result = metrics(samples)
    assert result["slots"]["navigate"] == {"correct": 1, "support": 4, "exact_match": 0.25}
    assert result["slots"]["result"]["exact_match"] == 1.0
    dated = row("navigate", slots=NavSlots(target="interview", when_expr="hôm qua"))
    assert (
        metrics([Observation(dated, prediction("navigate", slots={"target": "interview", "when_expr": "hom qua"}), 1)])[
            "slots"
        ]["navigate"]["exact_match"]
        == 0
    )


def test_safety_recall_uses_only_unsafe_and_injection_gold_denominator() -> None:
    samples = [
        observation("deny", "deny"),
        Observation(row("deny", deny_reason="injection"), prediction("howto"), 1),
        Observation(row("deny", deny_reason="off_topic"), prediction("howto"), 1),
        Observation(row("deny", deny_reason="out_of_role"), prediction("deny"), 1),
    ]
    assert metrics(samples)["deny_unsafe_injection"] == {"correct": 1, "support": 2, "recall": 0.5}


def test_nearest_rank_latency_and_empty_metrics() -> None:
    assert percentile(list(range(1, 101)), 0.50) == 50
    assert percentile(list(range(1, 101)), 0.95) == 95
    assert percentile([1, 100], 0.95) == 100
    assert percentile([], 0.95) is None
    empty = metrics([])
    assert empty["accuracy"] is None
    gates = threshold_gates(empty)
    assert not any(
        gates[name]["passed"]
        for name in ("accuracy", "deny_unsafe_injection_recall", "navigate_slot_exact_match", "cache_miss_p95_ms")
    )


@pytest.mark.parametrize(
    "name,value,passed",
    [
        ("accuracy", 0.93, True),
        ("accuracy", 0.929999, False),
        ("deny_unsafe_injection_recall", 0.97, True),
        ("deny_unsafe_injection_recall", 0.969999, False),
        ("navigate_slot_exact_match", 0.90, True),
        ("navigate_slot_exact_match", 0.899999, False),
        ("cache_miss_p95_ms", 29.999, True),
        ("cache_miss_p95_ms", 30.0, False),
        ("cache_miss_p95_ms", None, False),
        ("accuracy", float("nan"), False),
    ],
)
def test_exact_threshold_boundaries(name: str, value: float | None, passed: bool) -> None:
    result = metrics([observation("navigate", "navigate", slots={"target": "cv"}), observation("deny", "deny")])
    result["accuracy"] = 1.0
    if name == "accuracy":
        result["accuracy"] = value
    elif name == "deny_unsafe_injection_recall":
        result["deny_unsafe_injection"]["recall"] = value
    elif name == "navigate_slot_exact_match":
        result["slots"]["navigate"]["exact_match"] = value
    else:
        result["latency_ms"]["p95"] = value
    assert threshold_gates(result)[name]["passed"] is passed


def test_cache_cleared_before_each_call_and_only_predict_is_timed() -> None:
    rows = [row("navigate"), row("deny")]
    backend = RecordedBackend([prediction("navigate", slots={"target": "cv"}), prediction("deny")])
    ticks = iter([0, 5_000_000, 100_000_000, 110_000_000])
    result = run.evaluate(rows, backend, {}, clock_ns=lambda: next(ticks))
    assert backend.clears == len(rows) + 1
    assert result["metrics"]["latency_ms"] == {"p50": 5.0, "p95": 10.0, "support": 2, "cache_miss": True}
    assert result["passed"] is True
    assert result["release_ready"] is False
    for request in backend.requests:
        assert set(request.model_dump()) == {"text", "role", "page_route_id", "previous_targets"}
        assert not {"id", "label", "slots", "tags", "deny_reason"} & request.model_dump().keys()


def test_followup_context_forwarded_and_reported_without_training() -> None:
    rows = [r for r in load_rows(ROOT / "heldout.jsonl") if "followup" in r.tags]
    contexts = load_contexts()
    backend = RecordedBackend([prediction("clarify") for _ in rows])
    result = run.evaluate(rows, backend, contexts)
    assert result["subsets"]["followup"]["count"] == 18
    assert result["subsets"]["non_followup"]["count"] == 0
    assert [request.previous_targets for request in backend.requests[1:]] == [
        tuple(contexts[r.id].previous_targets) for r in rows
    ]


@pytest.mark.parametrize(
    "bad,error",
    [
        ({"route": "qa", "source": "rules"}, "invalid_prediction"),
        ({"route": "navigate", "source": "rules", "slots": {"target": "cv", "owner_id": "fake"}}, "invalid_prediction"),
        ({"route": "navigate", "source": "rules", "slots": {"target": "cv", "latest": "yes"}}, "invalid_prediction"),
        ({"route": "navigate", "slots": {"target": "cv"}}, "invalid_prediction"),
        ({"route": "navigate", "source": "cache", "slots": {"target": "cv"}}, "cache_hit"),
        (RuntimeError("private-utterance-or-api-key"), "prediction_error"),
    ],
)
def test_bad_outputs_remain_in_denominators_and_fail(bad: Any, error: str) -> None:
    result = run.evaluate([row("navigate")], RecordedBackend([bad]), {})
    assert result["passed"] is False
    assert result["metrics"]["accuracy"] == 0
    assert result["metrics"]["slots"]["navigate"]["support"] == 1
    assert result["metrics"]["slots"]["navigate"]["exact_match"] == 0
    assert result["metrics"]["confusion_matrix"]["navigate"]["<error>"] == 1
    assert result["metrics"]["errors"] == {error: 1}
    assert "private-utterance-or-api-key" not in json.dumps(result)
    if error == "cache_hit":
        assert result["metrics"]["latency_ms"]["support"] == 0


def test_cache_clear_error_is_counted_and_never_timed() -> None:
    class BrokenCache(RecordedBackend):
        def clear_cache(self) -> None:
            super().clear_cache()
            if self.clears > 1:
                raise RuntimeError("secret")

    result = run.evaluate([row("navigate")], BrokenCache([]), {})
    assert result["metrics"]["errors"] == {"cache_reset_error": 1}
    assert result["metrics"]["count"] == 1
    assert result["metrics"]["latency_ms"]["support"] == 0
    assert result["passed"] is False


def test_backend_can_return_plain_mapping_or_production_model() -> None:
    rows = [row("navigate"), row("deny")]
    outputs = [dict(route="navigate", source="rules", slots={"target": "cv"}, confidence=0.95), prediction("deny")]
    assert run.evaluate(rows, RecordedBackend(outputs), {})["metrics"]["accuracy"] == 1


def test_pluggable_backend_name_module_and_entry_point(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backends, "BACKENDS", {})

    def factory() -> RecordedBackend:
        return RecordedBackend([])

    register_backend("recorded-unit", factory)
    assert isinstance(load_backend("recorded-unit"), RecordedBackend)
    with pytest.raises(ValueError):
        register_backend("recorded-unit", factory)
    module = types.ModuleType("_router_unit_plugin")
    module.create_backend = factory
    monkeypatch.setitem(sys.modules, module.__name__, module)
    assert isinstance(load_backend("_router_unit_plugin:create_backend"), RecordedBackend)

    class EntryPoint:
        def load(self) -> Any:
            return factory

    monkeypatch.setattr(
        backends,
        "entry_points",
        lambda **kwargs: [EntryPoint()] if kwargs == {"group": "careerx.router_eval", "name": "candidate"} else [],
    )
    assert isinstance(load_backend("candidate"), RecordedBackend)
    with pytest.raises(ValueError):
        load_backend("missing")
    register_backend("bad-contract", lambda: object())
    with pytest.raises(TypeError, match="clear_cache"):
        load_backend("bad-contract")


def test_inference_input_rejects_gold_annotations() -> None:
    with pytest.raises(ValidationError):
        RouterInput(text="hello", role="student", page_route_id=None, label="smalltalk")


def test_dataset_loader_verifies_freeze_and_keeps_dev_separate() -> None:
    rows, contexts, digest = run.load_suite(ROOT, "dev")
    assert len(rows) == 84 and len(contexts) == 18 and len(digest) == 64
    assert not any("followup" in r.tags for r in rows)


def test_real_collection_pr_can_append_heldout_without_rebalancing(tmp_path: Path) -> None:
    for name in ("train.jsonl", "dev.jsonl", "heldout.jsonl", "heldout.sha256", "followup_contexts.json"):
        (tmp_path / name).write_bytes((ROOT / name).read_bytes())
    # These temporary unit fixtures test ingestion only; they are never shipped
    # as a replacement for actual collection from teammates/student interviews.
    additions = [
        row("clarify", id=f"unit-real-{n}", text=f"Temporary ingestion fixture {n}", tags=["en", "real"])
        for n in range(100)
    ]
    path = tmp_path / "heldout.jsonl"
    path.write_bytes(path.read_bytes() + "".join(json.dumps(r.model_dump()) + "\n" for r in additions).encode("utf-8"))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    (tmp_path / "heldout.sha256").write_text(f"{digest}  heldout.jsonl\n", encoding="ascii")
    rows, _, actual = run.load_suite(tmp_path, "heldout")
    assert actual == digest and len(rows) == 184
    assert sum("real" in r.tags for r in rows) == 100
    assert load_rows(tmp_path / "train.jsonl") == load_rows(ROOT / "train.jsonl")
    assert load_rows(tmp_path / "dev.jsonl") == load_rows(ROOT / "dev.jsonl")


def test_cli_report_json_and_nonzero_threshold_exit(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    class AlwaysHowto:
        def clear_cache(self) -> None:
            pass

        def predict(self, request: RouterInput) -> dict[str, str]:
            return {"route": "howto", "source": "rules"}

    monkeypatch.setattr(run, "load_backend", lambda name: AlwaysHowto())
    output = tmp_path / "report.json"
    assert run.main(["--suite", "router", "--backend", "recorded-test-only", "--output", str(output)]) == 1
    report = json.loads(output.read_text(encoding="utf-8"))
    assert report["backend"] == "recorded-test-only"
    assert report["inventory"]["total"] == 84
    assert report["metrics"]["accuracy"] == 1 / 7
    assert report["release_ready"] is False
    assert "real_template" not in output.read_text()
    text = capsys.readouterr().out
    for term in (
        "Confusion matrix",
        "navigate<->howto",
        "locate<->howto",
        "result<->navigate",
        "slot exact-match",
        "Cache-miss p50",
        "Cache-miss p95",
        "followup",
        "INCOMPLETE",
    ):
        assert term in text


def test_cli_passes_numeric_gates_but_require_real_fails_without_evidence(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    rows = [row("navigate"), row("deny")]
    monkeypatch.setattr(run, "load_suite", lambda root, split: (rows, {}, "frozen-unit"))
    monkeypatch.setattr(
        run,
        "load_backend",
        lambda name: RecordedBackend([prediction("navigate", slots={"target": "cv"}), prediction("deny")]),
    )
    output = tmp_path / "recorded.json"
    assert run.main(["--output", str(output)]) == 0
    assert json.loads(output.read_text())["release_ready"] is False
    assert run.main(["--require-real"]) == 1
    assert run.main(["--split", "dev", "--require-real"]) == 1


def test_cli_error_is_nonzero_and_sanitized(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def broken(name: str) -> Any:
        raise RuntimeError("secret-provider-key")

    monkeypatch.setattr(run, "load_backend", broken)
    assert run.main([]) == 2
    assert "secret-provider-key" not in capsys.readouterr().err


def test_module_entrypoint_fails_cleanly_for_missing_backend() -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "eval.run", "--suite", "router", "--backend", "_nonexistent_router_module_:factory"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert completed.returncode == 2
    assert "Router evaluation failed (ModuleNotFoundError)" in completed.stderr
    assert "Traceback" not in completed.stderr
