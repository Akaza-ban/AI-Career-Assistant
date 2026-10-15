"""Train-only OOF diagnosis and aggregate-only dev measurement; no heldout access."""

import argparse
import json
import time
from collections import Counter
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from sklearn.model_selection import StratifiedKFold

from eval.router.backends import RouterPrediction
from eval.router.dataset import ROOT, RouterRow, load_rows
from eval.router.diagnostics import diagnostics
from eval.router.metrics import Observation, metrics, threshold_gates
from eval.router.train import build_model
from src.services.assistant.router.classifier import predict_probabilities
from src.services.assistant.router.engine import LocalRouter
from src.services.assistant.router.matching import fuzzy_tokens
from src.services.assistant.router.rules import decide_rules, is_contextual, plausible_targets
from src.services.assistant.router.text import detect_language, normalize

SEED = 20261015
SOURCES = ("stage0", "cache", "rules", "classifier", "fallback")


def clarify_origin(router: LocalRouter, row: RouterRow) -> str:
    if is_contextual(row.text):
        return "context_rule"
    hint = decide_rules(row.text, role=row.role, language=detect_language(row.text))
    if hint.route == "clarify" and len(plausible_targets(row.text, row.role)) >= 2:
        return "stage4_candidate_ambiguity"
    if router.classifier is not None:
        ranked = predict_probabilities(router.classifier, normalize(row.text).folded)
        if ranked[0][1] >= router.classifier_threshold and ranked[0][1] - ranked[1][1] >= router.classifier_margin:
            if ranked[0][0] == "clarify":
                return "stage3_classifier"
            if ranked[0][0] in {"navigate", "locate"} and hint.route == "clarify":
                return "stage4_overrode_classifier"
            if ranked[0][0] in {"navigate", "result"}:
                return "stage3_missing_target"
    return "stage4_abstention"


def observe(rows: list[RouterRow], router: LocalRouter) -> tuple[list[Observation], Counter[str]]:
    observations = []
    origins: Counter[str] = Counter()
    for row in rows:
        router.clear_cache()
        fuzzy_tokens.cache_clear()
        started = time.perf_counter_ns()
        raw = router.decide(row.text, role=row.role, page_route_id=row.page_route_id)
        elapsed = (time.perf_counter_ns() - started) / 1_000_000
        prediction = RouterPrediction.model_validate(raw.model_dump())
        observations.append(Observation(row, prediction, elapsed))
        if prediction.route == "clarify" and row.label != "clarify":
            origins[clarify_origin(router, row)] += 1
    return observations, origins


def summarize(observations: list[Observation], origins: Counter[str]) -> dict[str, Any]:
    aggregate = metrics(observations)
    return {
        "metrics": aggregate,
        "gates": threshold_gates(aggregate),
        "diagnostics": diagnostics(observations),
        "by_source": {
            source: metrics([item for item in observations if item.prediction.source == source]) for source in SOURCES
        },
        "typo_by_source": {
            source: metrics(
                [item for item in observations if "typo" in item.row.tags and item.prediction.source == source]
            )
            for source in SOURCES
        },
        "wrong_clarify_by_source": dict(
            Counter(
                item.prediction.source
                for item in observations
                if item.prediction.route == "clarify" and item.row.label != "clarify"
            )
        ),
        "wrong_clarify_origin": dict(origins),
        "subsets": {
            tag: metrics([item for item in observations if tag in item.row.tags])
            for tag in ("typo", "no_diacritics", "ambiguous", "vi", "en", "mixed")
        },
        "heldout_accessed": False,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["train-cv", "dev"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--augment", action="store_true")
    args = parser.parse_args(argv)
    observations: list[Observation] = []
    origins: Counter[str] = Counter()
    if args.split == "train-cv":
        rows = load_rows(ROOT / "train.jsonl")
        folds = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
        for fit_indices, validation_indices in folds.split(rows, [row.label for row in rows]):
            router = LocalRouter()
            router.classifier = build_model([rows[i] for i in fit_indices], augment=args.augment)
            batch, reasons = observe([rows[i] for i in validation_indices], router)
            observations.extend(batch)
            origins.update(reasons)
    else:
        observations, origins = observe(load_rows(ROOT / "dev.jsonl"), LocalRouter())
    report = summarize(observations, origins)
    report.update({"split": args.split, "seed": SEED, "folds": 5 if args.split == "train-cv" else None})
    if args.split == "train-cv":
        report["train_failures"] = [
            {"row": item.row.model_dump(), "prediction": item.prediction.model_dump()}
            for item in observations
            if item.prediction.route != item.row.label
            or (item.row.slots is not None and item.prediction.slots != item.row.slots.model_dump())
        ]
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "split": args.split,
                "metrics": report["metrics"],
                "by_source": {
                    s: {k: v[k] for k in ("count", "correct", "accuracy")} for s, v in report["by_source"].items()
                },
                "typo_by_source": {
                    s: {k: v[k] for k in ("count", "correct", "accuracy")} for s, v in report["typo_by_source"].items()
                },
                "wrong_clarify_origin": report["wrong_clarify_origin"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
