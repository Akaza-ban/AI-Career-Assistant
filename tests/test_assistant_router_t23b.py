"""Train-derived T2.3b regressions; no consumed evaluation data is opened."""

import json
import random
from pathlib import Path

import joblib
import numpy as np
import pytest

from eval.router import cv_report
from eval.router.dataset import ROOT, load_rows
from eval.router.train import AUGMENTATION, noisy_variants
from src.config import get_settings
from src.services.assistant.router import LocalRouter
from src.services.assistant.router.matching import SurfaceText, edit_distance_one, matches
from src.services.assistant.router.rules import plausible_targets
from src.services.assistant.router.slots import extract_slots


class FixedClassifier:
    classes_ = np.asarray(["navigate", "locate", "howto", "clarify", "result", "deny", "smalltalk"])

    def predict_proba(self, texts: list[str]) -> np.ndarray:
        return np.asarray([[0.90, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01] for _ in texts])


def test_single_destination_is_not_two_actions_disguised_as_candidates() -> None:
    router = LocalRouter()
    router.classifier = FixedClassifier()
    assert len(plausible_targets("CV", "student")) == 1
    assert router.decide("CV", role="student").route == "navigate"
    ambiguous = router.decide("CV or JD", role="student")
    assert ambiguous.route == "clarify"
    assert len({chip.slots.target for chip in ambiguous.chips}) == 2
    router.classifier = None
    router.clear_cache()
    assert router.decide("CV", role="student").route == "howto"


def test_comparison_with_explicit_entity_is_not_a_bare_deictic() -> None:
    text = "How does my latest interview score for JD Shopee Backend compare with the previous one?"
    assert LocalRouter().decide(text, role="student").route == "result"


def test_fuzzy_matching_is_one_edit_long_tokens_only_and_preserves_span() -> None:
    surface = SurfaceText("Wheree are STAR scores shown on interview reports?")
    found = matches(surface.folded, ["where are"])
    assert found and surface.group(found[0]) == "Wheree are"
    assert edit_distance_one("wheree", "where")
    assert not edit_distance_one("showw", "show")
    assert not edit_distance_one("wheeree", "where")
    assert not matches("showw cv", ["show"])


def test_noise_is_seeded_and_artifact_records_parameters_and_grouped_calibration() -> None:
    text = "Mở lịch sử phỏng vấn hôm qua"
    assert noisy_variants(text, random.Random(AUGMENTATION["seed"])) == noisy_variants(
        text, random.Random(AUGMENTATION["seed"])
    )
    artifact = joblib.load(get_settings().router_classifier_artifact)
    assert artifact["augmentation"] == AUGMENTATION
    assert artifact["version"] == 2
    copies = 1 + len(AUGMENTATION["operations"]) * AUGMENTATION["copies_per_operation"]
    for fit, calibrate in artifact["pipeline"].named_steps["calibrated_linear"].cv:
        assert set(fit // copies).isdisjoint(set(calibrate // copies))


SLOT_REGRESSIONS = {
    "syn-navigate-en-03",
    "syn-navigate-en-04",
    "syn-navigate-en-06",
    "syn-navigate-en-11",
    "syn-result-en-01",
    "syn-result-en-03",
    "syn-result-en-06",
    "syn-result-en-10",
    "syn-result-en-11",
    "syn-result-mixed-01",
    "syn-result-mixed-03",
    "syn-result-mixed-10",
    "syn-result-mixed-12",
    "syn-result-vi-02",
    "syn-result-vi-10",
    "syn-result-vi-12",
}


@pytest.mark.parametrize(
    "row", [r for r in load_rows(ROOT / "train.jsonl") if r.id in SLOT_REGRESSIONS], ids=lambda r: r.id
)
def test_train_slot_boundary_regressions(row) -> None:
    assert extract_slots(row.text).model_dump() == row.slots.model_dump()


def test_dev_report_is_aggregate_only_and_loads_only_dev(tmp_path: Path, monkeypatch, capsys) -> None:
    rows = load_rows(ROOT / "train.jsonl")[:1]
    paths = []

    def safe_rows(path: Path):
        paths.append(path.name)
        assert path.name == "dev.jsonl"
        return rows

    monkeypatch.setattr(cv_report, "load_rows", safe_rows)
    output = tmp_path / "aggregate.json"
    assert cv_report.main(["--split", "dev", "--output", str(output)]) == 0
    report = json.loads(output.read_text(encoding="utf-8"))
    captured = capsys.readouterr().out
    assert paths == ["dev.jsonl"]
    assert rows[0].id not in captured and rows[0].text not in captured
    assert "train_failures" not in report and report["heldout_accessed"] is False
