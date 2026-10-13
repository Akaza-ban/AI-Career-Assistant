"""Local benchmark. From root: python -m eval.pii.run --backends underthesea phobert spacy.

Metrics never contain raw text, filenames, originals or exception messages. A
failed backend/document is reported as failed, never silently excluded. Targets
are immutable here; generated drafts cannot establish a reviewed shipping gate.
"""

import argparse
import hashlib
import json
import time
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from eval.pii.dataset import ROOT, Sample, load_real, load_synthetic
from src.services.privacy.detectors import Detector
from src.services.privacy.extract import extract
from src.services.privacy.masker import escape_inbound
from src.services.privacy.types import KINDS, Span

TARGET_RECALL = {"EMAIL": 0.99, "PHONE": 0.99, "ID": 0.99, "PERSON": 0.92, "ADDRESS": 0.92}
TARGET_PRECISION = 0.9
MAX_KEEP_FALSE_POSITIVE_RATE = 0.03  # strictly below, not <=


@dataclass(frozen=True)
class BoundaryMap:
    starts: list[int]
    ends: list[int]


def _boundaries(original: str, observed: str) -> BoundaryMap:
    # Inserted whitespace belongs after an entity's end but before the next
    # entity's start. One shared boundary map would inflate spans with OCR CRLFs.
    starts = [-1] * (len(original) + 1)
    ends = [len(observed) + 1] * (len(original) + 1)

    def record(index: int, value: int) -> None:
        starts[index] = max(starts[index], value)
        ends[index] = min(ends[index], value)

    for operation, left, right, out_left, out_right in SequenceMatcher(
        None, original, observed, autojunk=False
    ).get_opcodes():
        if left == right:
            record(left, out_left)
            record(left, out_right)
            continue
        for offset in range(right - left + 1):
            record(left + offset, out_left + offset * (out_right - out_left) // (right - left))
    if not original:
        record(0, 0)
    return BoundaryMap(starts, ends)


def _mapped(span: Span, mapping: BoundaryMap) -> Span | None:
    start, end = mapping.starts[span.start], mapping.ends[span.end]
    return Span(start, end, span.kind) if end > start else None


def measure(
    samples: Sequence[Sample],
    detector: Detector,
    *,
    ner_only: bool = False,
    documents: dict[str, str | None] | None = None,
    filenames: bool = True,
) -> dict[str, Any]:
    counts = {kind: Counter(tp=0, fp=0, fn=0, covered=0, gold=0) for kind in sorted(KINDS)}
    keeps = {kind: Counter(total=0, masked=0) for kind in ("SKILL", "EMPLOYER", "SCHOOL", "CITY")}
    errors: list[str] = []
    start_time = time.monotonic()
    for sample in samples:
        inputs = [(sample.text, sample.entities, sample.keep, False)]
        if filenames and sample.filename:
            inputs.append((sample.filename, sample.filename_entities, (), True))
        for original, expected_original, preserve, is_filename in inputs:
            observed = original
            if documents is not None and sample.document and not is_filename:
                observed = documents.get(sample.id)
            missing_document = observed is None
            observed = observed or ""
            if is_filename:
                # Identical normalization as mask_document; character positions
                # and annotations still refer to the externally exposed filename.
                import re

                observed = re.sub(r"[_-]", " ", observed)
                observed = re.sub(r"\.(?:pdf|docx|txt)$", lambda m: " " * len(m.group()), observed, flags=re.I)
                normalized_original = observed
            else:
                normalized_original = original
            wire = escape_inbound(observed) if not ner_only else observed
            mapping = _boundaries(normalized_original, wire)
            expected = [
                (span.kind, _mapped(span, mapping) if not missing_document else None) for span in expected_original
            ]
            try:
                if missing_document:
                    raise RuntimeError("document failed")
                if ner_only:
                    predicted = list(detector.ner.detect(wire))
                else:
                    predicted = detector.detect(wire, document_type="cv" if is_filename else sample.category)
            except Exception:
                # This id is evaluator-controlled synthetic metadata, not a path.
                errors.append(sample.id + (":filename" if is_filename else ":text"))
                predicted = []
            remaining = list(predicted)
            for kind, span in expected:
                counts[kind]["gold"] += 1
                exact = next(
                    (
                        p
                        for p in remaining
                        if span is not None and (p.start, p.end, p.kind) == (span.start, span.end, kind)
                    ),
                    None,
                )
                if exact is not None:
                    counts[kind]["tp"] += 1
                    remaining.remove(exact)
                else:
                    counts[kind]["fn"] += 1
                if span is not None and all(
                    any(p.start <= char < p.end for p in predicted) for char in range(span.start, span.end)
                ):
                    counts[kind]["covered"] += 1
            for predicted_span in remaining:
                counts[predicted_span.kind]["fp"] += 1
            for left, right, kind in preserve:
                if kind in keeps:
                    keeps[kind]["total"] += 1
                    if any(p.start < mapping.ends[right] and p.end > mapping.starts[left] for p in predicted):
                        keeps[kind]["masked"] += 1
    entities = {}
    for kind, count in counts.items():
        entities[kind] = dict(count) | {
            "recall": count["tp"] / count["gold"] if count["gold"] else None,
            "precision": count["tp"] / (count["tp"] + count["fp"]) if count["tp"] + count["fp"] else None,
            "coverage_recall": count["covered"] / count["gold"] if count["gold"] else None,
        }
    keep_metrics = {
        kind: dict(count) | {"false_positive_rate": count["masked"] / count["total"] if count["total"] else None}
        for kind, count in keeps.items()
    }
    total_tp = sum(count["tp"] for count in counts.values())
    total_fp = sum(count["fp"] for count in counts.values())
    return {
        "samples": len(samples),
        "entities": entities,
        "preservation": keep_metrics,
        "micro_precision": total_tp / (total_tp + total_fp) if total_tp + total_fp else None,
        "failed_inputs": errors,
        "elapsed_seconds": round(time.monotonic() - start_time, 3),
    }


def gate_failures(result: dict[str, Any]) -> list[str]:
    failures = []
    for kind, threshold in TARGET_RECALL.items():
        recall = result["entities"][kind]["recall"]
        if recall is None or recall < threshold:
            failures.append(f"{kind} recall below {threshold}")
    for kind, metrics in result["entities"].items():
        if metrics["gold"] and (metrics["precision"] is None or metrics["precision"] < TARGET_PRECISION):
            failures.append(f"{kind} precision below {TARGET_PRECISION}")
    if result["micro_precision"] is None or result["micro_precision"] < TARGET_PRECISION:
        failures.append(f"Overall precision below {TARGET_PRECISION}")
    for kind in ("SKILL", "EMPLOYER", "SCHOOL"):
        rate = result["preservation"][kind]["false_positive_rate"]
        if rate is None or rate >= MAX_KEEP_FALSE_POSITIVE_RATE:
            failures.append(f"{kind} false positives not below {MAX_KEEP_FALSE_POSITIVE_RATE}")
    if result["failed_inputs"]:
        failures.append("Local detection/extraction failed on one or more inputs")
    return failures


def select_backend(results: dict[str, Any]) -> str | None:
    eligible = {
        name: value
        for name, value in results.items()
        if value.get("status") == "measured" and not value["ner_only"]["failed_inputs"]
    }
    if not eligible:
        return None

    def score(name: str) -> tuple[float, float, str]:
        entities = eligible[name]["ner_only"]["entities"]
        gold = sum(entities[kind]["gold"] for kind in ("PERSON", "ADDRESS"))
        tp = sum(entities[kind]["tp"] for kind in ("PERSON", "ADDRESS"))
        # Recall determines selection. Precision is only a tie-breaker.
        return tp / gold if gold else 0, eligible[name]["pipeline_raw"]["micro_precision"] or 0, name

    return max(eligible, key=score)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backends", nargs="+", default=["underthesea", "phobert", "spacy"])
    parser.add_argument("--output", type=Path, default=ROOT / "results" / "benchmark.json")
    parser.add_argument("--documents", action="store_true", help="Also evaluate actual text PDFs and local OCR scans")
    args = parser.parse_args()
    from src.services.privacy.ner import load_ner

    samples = load_synthetic()
    real = load_real()
    report: dict[str, Any] = {
        "measured_at": datetime.now(UTC).isoformat(),
        "dataset_sha256": hashlib.sha256((ROOT / "golden.jsonl").read_bytes()).hexdigest(),
        "source_sha256": {
            relative: hashlib.sha256((ROOT.parents[1] / relative).read_bytes()).hexdigest()
            for relative in (
                "src/services/privacy/detectors.py",
                "src/services/privacy/ner.py",
                "src/services/privacy/extract.py",
                "src/services/privacy/masker.py",
                "eval/pii/run.py",
            )
        },
        "review_status": "needs_human_review"
        if any(s.review_status != "human_reviewed" for s in samples)
        else "human_reviewed",
        "synthetic_cvs": sum(s.category == "cv" for s in samples),
        "held_out_real_count": len(real),
        "targets": {
            "recall": TARGET_RECALL,
            "precision": TARGET_PRECISION,
            "keep_false_positives_strictly_below": MAX_KEEP_FALSE_POSITIVE_RATE,
        },
        "results": {},
    }
    documents: dict[str, str | None] = {}
    if args.documents:
        for sample in [*samples, *real]:
            if sample.document:
                try:
                    documents[sample.id] = extract(sample.document)
                except Exception:
                    documents[sample.id] = None
        report["document_extraction"] = {
            "count": len(documents),
            "failed_count": sum(value is None for value in documents.values()),
        }
    for backend in args.backends:
        print(f"Benchmarking {backend} on CPU ...", flush=True)
        try:
            model = load_ner(backend)
            detector = Detector(model)
            result = {
                "status": "measured",
                "model": model.metadata,
                "ner_only": measure(samples, detector, ner_only=True),
                "pipeline_raw": measure(samples, detector),
                "by_language": {
                    language: measure([s for s in samples if s.language == language], detector)
                    for language in ("vi", "en", "mixed")
                },
            }
            result["gate_failures_raw"] = gate_failures(result["pipeline_raw"])
            if args.documents:
                result["pipeline_documents"] = measure(samples, detector, documents=documents)
                result["gate_failures_documents"] = gate_failures(result["pipeline_documents"])
            if real:
                result["held_out_real"] = measure(real, detector, documents=documents if args.documents else None)
                result["gate_failures_real"] = gate_failures(result["held_out_real"])
            report["results"][backend] = result
        except Exception as error:
            report["results"][backend] = {"status": "failed", "error_type": type(error).__name__}
        print(f"{backend}: {report['results'][backend]['status']}", flush=True)
    report["selected_backend"] = selected = select_backend(report["results"])
    report["shipping_gate_passed"] = bool(
        selected
        and len(report["results"]) == 3
        and all(result["status"] == "measured" for result in report["results"].values())
        and not report["results"][selected]["gate_failures_raw"]
        and args.documents
        and not report["results"][selected].get("gate_failures_documents")
        and report["review_status"] == "human_reviewed"
        and len(real) >= 10
        and not report["results"][selected].get("gate_failures_real")
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Selected by NER PERSON+ADDRESS strict recall: {selected}. Shipping gate: {report['shipping_gate_passed']}.")
    return 0 if report["shipping_gate_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
