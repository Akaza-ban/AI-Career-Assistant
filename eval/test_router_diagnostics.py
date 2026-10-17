"""Authored diagnostic arithmetic fixtures; no dev/heldout misses are read here."""

import json
from pathlib import Path

import pytest

from eval.router.backends import RouterInput, RouterPrediction
from eval.router.dataset import NavSlots, RouterRow
from eval.router.diagnostics import diagnostics, slot_miss_kind
from eval.router.metrics import Observation
from eval.router.rules_report import main


def observation(
    label: str, route: str, *, source: str = "rules", confidence: float = 0.95, **updates: object
) -> Observation:
    gold = {
        "id": "authored-unit",
        "text": "Unit example",
        "role": "student",
        "page_route_id": None,
        "label": label,
        "language": "en",
        "tags": ["en", "synthetic"],
    }
    if label == "deny":
        gold["deny_reason"] = "unsafe"
    if label in {"navigate", "result"}:
        gold["slots"] = NavSlots(target="page", page_hint="CV")
    prediction = dict(route=route, source=source, confidence=confidence)
    prediction.update(updates)
    return Observation(RouterRow.model_validate(gold), RouterPrediction.model_validate(prediction), 1.0)


def test_coverage_and_conditional_precision_recall_have_explicit_denominators() -> None:
    rows = [
        observation("smalltalk", "smalltalk", source="stage0", confidence=1.0),
        observation("howto", "result"),
        observation("locate", "howto", source="fallback", confidence=0.0),
        observation("howto", "howto", confidence=0.8),
    ]
    value = diagnostics(rows)
    assert value["coverage"] == {
        "threshold": 0.9,
        "decided": 2,
        "total": 4,
        "share": 0.5,
        "by_stage": {"stage0": 1, "rules": 1},
    }
    assert value["decided_only"]["precision_micro"] == 0.5
    assert value["decided_only"]["recall_micro"] == 0.5
    assert value["decided_only"]["correct_share_all"] == 0.25
    assert value["decided_only"]["per_route"]["smalltalk"]["recall"] == 1.0


def test_deny_route_recall_is_separate_from_reason_exact_recall() -> None:
    value = diagnostics([observation("deny", "deny", deny_reason="injection"), observation("deny", "howto")])
    assert value["deny_by_reason"]["unsafe"] == {
        "support": 2,
        "route_correct": 1,
        "recall": 0.5,
        "reason_correct": 0,
        "reason_exact_recall": 0.0,
    }
    assert value["deny_by_reason"]["out_of_role"]["recall"] is None


def test_slot_categories_do_not_forgive_wrong_routes_or_raw_diacritics() -> None:
    convention = observation("navigate", "navigate", slots={"target": "page", "page_hint": "CV page"})
    bug = observation("navigate", "navigate", slots={"target": "page", "page_hint": "JD"})
    wrong_route = observation("navigate", "clarify")
    assert slot_miss_kind(convention) == "gold_convention_mismatch"
    assert slot_miss_kind(bug) == "extractor_bug"
    assert slot_miss_kind(wrong_route) == "upstream_route_miss"
    value = diagnostics([convention, bug, wrong_route])["slot_miss_categories"]["navigate"]
    assert value == {
        "support": 3,
        "misses": 3,
        "gold_convention_mismatch": 1,
        "extractor_bug": 1,
        "upstream_route_miss": 1,
    }
    dated = observation("navigate", "navigate", slots={"target": "interview", "when_expr": "hom qua"})
    dated = Observation(
        dated.row.model_copy(update={"slots": NavSlots(target="interview", when_expr="hôm qua")}), dated.prediction, 1.0
    )
    assert slot_miss_kind(dated) == "extractor_bug"


@pytest.mark.parametrize("backend_error", [False, True])
def test_dev_report_never_reads_heldout_or_prints_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], backend_error: bool
) -> None:
    row = {
        "id": "unit-private-marker",
        "text": "Hello",
        "role": "student",
        "page_route_id": None,
        "label": "smalltalk",
        "language": "en",
        "tags": ["en", "synthetic"],
    }
    (tmp_path / "dev.jsonl").write_text(json.dumps(row) + "\n", encoding="utf-8")
    original = Path.open

    def guarded(path: Path, *args: object, **kwargs: object):
        assert "heldout" not in path.name and path.name != "followup_contexts.json"
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", guarded)
    if backend_error:
        from eval.router import rules_report

        class BrokenBackend:
            def clear_cache(self) -> None:
                pass

            def predict(self, request: RouterInput) -> dict[str, object]:
                if request.text == "Hello CareerX":
                    return {"route": "smalltalk", "source": "stage0", "confidence": 1.0}
                raise RuntimeError("private-backend-error")

        monkeypatch.setattr(rules_report, "load_backend", lambda _: BrokenBackend())
    output = tmp_path / "aggregate.json"
    assert main(["--split", "dev", "--data-dir", str(tmp_path), "--output", str(output)]) == 1
    printed = capsys.readouterr().out
    assert "unit-private-marker" not in printed
    assert "Hello" not in printed
    encoded = output.read_text()
    assert "unit-private-marker" not in encoded
    assert "private-backend-error" not in encoded
    saved = json.loads(encoded)
    assert saved["heldout_accessed"] is False
    assert saved["failure_counts"] == ({"prediction_error": 1} if backend_error else {})


def test_smalltalk_printing_is_train_only() -> None:
    with pytest.raises(SystemExit):
        main(["--split", "dev", "--print-smalltalk"])
