"""Stage-3 artifact and latency contracts."""

import hashlib
import json
import logging
from pathlib import Path

from eval.router.dataset import ROOT as EVAL_ROOT
from src.config import get_settings
from src.services.assistant.router import LocalRouter, engine
from src.services.assistant.router.classifier import verify_artifact

ARTIFACTS = EVAL_ROOT / "artifacts"


def artifact_path() -> Path:
    return Path(get_settings().router_classifier_artifact)


def test_artifact_hash_is_derived_from_train_bytes_only() -> None:
    assert verify_artifact(artifact_path(), EVAL_ROOT / "train.jsonl")


def test_missing_artifact_disables_stage_three_and_logs_once(tmp_path: Path, caplog, monkeypatch) -> None:
    missing = tmp_path / "missing.joblib"
    settings = get_settings().model_copy(update={"router_classifier_artifact": str(missing)})
    monkeypatch.setattr(engine, "get_settings", lambda: settings)
    with caplog.at_level(logging.WARNING, logger="src.services.assistant.router.classifier"):
        router = LocalRouter()
        assert router.classifier is None
        assert router.decide("button", role="student").route == "clarify"
        assert LocalRouter().classifier is None
    assert sum("classifier artifact is missing" in record.message for record in caplog.records) == 1


def test_predictions_are_deterministic_after_cache_eviction() -> None:
    router = LocalRouter()
    text = "Where is the button to open my analysis score? How to use it?"
    router.clear_cache()
    first = router.decide(text, role="student")
    router.clear_cache()
    second = router.decide(text, role="student")
    assert first.model_copy(update={"source": second.source}) == second


def test_dev_cache_miss_latency_p95_is_under_30_ms() -> None:
    # Reuse the single declared dev measurement rather than re-evaluating dev
    # each time tests run. The report is bound to data and acceptance settings.
    report = json.loads((EVAL_ROOT / "t23b_dev_final.json").read_text(encoding="utf-8"))
    assert report["dev_sha256"] == hashlib.sha256((EVAL_ROOT / "dev.jsonl").read_bytes()).hexdigest()
    assert report["artifact_sha256"] == hashlib.sha256(artifact_path().read_bytes()).hexdigest()
    assert report["threshold"] == get_settings().router_clf_threshold
    assert report["margin"] == get_settings().router_clf_margin
    assert report["metrics"]["latency_ms"]["cache_miss"] is True
    assert report["metrics"]["latency_ms"]["support"] == 84
    assert report["metrics"]["latency_ms"]["p95"] < 30.0
