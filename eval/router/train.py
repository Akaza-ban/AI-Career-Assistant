"""Train the local stage-3 classifier using train.jsonl and tune on dev.jsonl."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import unicodedata
from collections.abc import Sequence
from pathlib import Path

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from eval.router.dataset import ROOT, RouterRow, load_rows
from src.services.assistant.router.engine import LocalRouter

AUGMENTATION = {
    "seed": 20261015,
    "copies_per_operation": 2,
    "min_token_length": 2,
    "first_copy_prefix_bias": True,
    "operations": ["delete", "swap", "duplicate", "fold_then_typo"],
}


def fold(text: str) -> str:
    lowered = text.lower().replace("đ", "d")
    return " ".join("".join(c for c in unicodedata.normalize("NFD", lowered) if not unicodedata.combining(c)).split())


def noisy_variants(text: str, rng: random.Random) -> list[str]:
    variants = []
    for operation in AUGMENTATION["operations"]:
        for copy in range(AUGMENTATION["copies_per_operation"]):
            base = fold(text) if operation == "fold_then_typo" else text
            words = [m for m in re.finditer(r"[^\W\d_]+", base) if len(m.group()) >= AUGMENTATION["min_token_length"]]
            if not words:
                continue
            word = words[0] if copy == 0 else rng.choice(words)
            pos = (
                word.end() - 1
                if copy == 0 and operation in {"duplicate", "fold_then_typo"}
                else rng.randrange(word.start(), word.end())
            )
            if operation == "delete":
                value = base[:pos] + base[pos + 1 :]
            elif operation == "swap":
                pos = min(pos, word.end() - 2)
                value = base[:pos] + base[pos + 1] + base[pos] + base[pos + 2 :]
            else:
                value = base[:pos] + base[pos] + base[pos:]
            variants.append(value)
    return variants


def build_model(rows: list[RouterRow], *, augment: bool = False) -> Pipeline:
    texts, labels, groups = [], [], []
    rng = random.Random(AUGMENTATION["seed"])
    for index, row in enumerate(rows):
        variants = [row.text, *(noisy_variants(row.text, rng) if augment else [])]
        texts.extend(fold(text) for text in variants)
        labels.extend([row.label] * len(variants))
        groups.extend([index] * len(variants))
    calibration = (
        list(StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=20261015).split(texts, labels, groups))
        if augment
        else 3
    )
    pipeline = Pipeline(
        [
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=False, sublinear_tf=True)),
            ("calibrated_linear", CalibratedClassifierCV(LinearSVC(random_state=0), method="sigmoid", cv=calibration)),
        ]
    )
    pipeline.fit(texts, labels)
    return pipeline


def tune(pipeline: Pipeline, dev_path: Path) -> tuple[float, float, dict[str, float]]:
    rows = load_rows(dev_path)
    router = LocalRouter()

    class ProbabilityMemo:
        classes_ = pipeline.classes_

        def __init__(self) -> None:
            self.values: dict[str, np.ndarray] = {}

        def predict_proba(self, texts: list[str]) -> np.ndarray:
            for text in texts:
                if text not in self.values:
                    self.values[text] = pipeline.predict_proba([text])[0]
            return np.asarray([self.values[text] for text in texts])

    router.classifier = ProbabilityMemo()
    best: tuple[float, float, float, float, float] | None = None
    for threshold in np.arange(0.20, 0.901, 0.05):
        for margin in np.arange(0.0, 0.301, 0.05):
            correct = accepted = 0
            router.classifier_threshold = float(threshold)
            router.classifier_margin = float(margin)
            for row in rows:
                router.clear_cache()
                prediction = router.decide(row.text, role=row.role, page_route_id=row.page_route_id)
                predicted = prediction.route
                accepted += prediction.source == "classifier"
                if predicted == row.label:
                    correct += 1
            coverage = accepted / len(rows)
            accuracy = correct / len(rows)
            candidate = (accuracy, coverage, float(threshold), float(margin), accuracy)
            if best is None or candidate[:2] > best[:2]:
                best = candidate
    assert best is not None
    return best[2], best[3], {"accuracy": best[4], "coverage": best[1]}


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--no-tune", action="store_true", help="Train only, without opening dev")
    parser.add_argument("--measurement-output", type=Path, help="One aggregate dev measurement after tuning")
    args = parser.parse_args(argv)
    train_path = args.data_dir / "train.jsonl"
    raw_train = train_path.read_bytes()
    rows = load_rows(train_path)
    pipeline = build_model(rows, augment=True)
    from src.config import get_settings

    settings = get_settings()
    threshold, margin = settings.router_clf_threshold, settings.router_clf_margin
    dev = None
    if not args.no_tune:
        threshold, margin, dev = tune(pipeline, args.data_dir / "dev.jsonl")
    digest = hashlib.sha256(raw_train).hexdigest()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = args.output_dir / f"router-v2-{digest[:12]}.joblib"
    joblib.dump(
        {
            "format": "careerx-router-v2",
            "version": 2,
            "augmentation": AUGMENTATION,
            "train_sha256": digest,
            "pipeline": pipeline,
            "threshold": threshold,
            "margin": margin,
        },
        artifact_path,
    )
    if args.measurement_output and not args.no_tune:
        from eval.router.cv_report import observe, summarize

        router = LocalRouter()
        router.classifier = pipeline
        router.classifier_threshold, router.classifier_margin = threshold, margin
        observations, origins = observe(load_rows(args.data_dir / "dev.jsonl"), router)
        report = summarize(observations, origins)
        report.update(
            {
                "split": "dev",
                "threshold": threshold,
                "margin": margin,
                "train_sha256": digest,
                "artifact_sha256": hashlib.sha256(artifact_path.read_bytes()).hexdigest(),
                "dev_sha256": hashlib.sha256((args.data_dir / "dev.jsonl").read_bytes()).hexdigest(),
            }
        )
        args.measurement_output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "artifact": str(artifact_path),
                "train_sha256": digest,
                "threshold": threshold,
                "margin": margin,
                "dev": dev,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
