"""Router benchmark: python -m eval.run --suite router --backend local.

Other section 11 suites remain owned by their respective implementation tasks.
This module neither implements nor trains a router, and never supplies gold
annotations to an inference backend.
"""

import argparse
import hashlib
import json
import sys
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from eval.router.backends import RouterBackend, RouterInput, RouterPrediction, load_backend
from eval.router.dataset import (
    ROOT,
    FollowupContext,
    RouterRow,
    fold,
    inventory,
    load_contexts,
    load_rows,
    verify_heldout,
)
from eval.router.metrics import Observation, metrics, threshold_gates


def evaluate(
    rows: list[RouterRow],
    backend: RouterBackend,
    contexts: dict[str, FollowupContext],
    *,
    clock_ns: Callable[[], int] = time.perf_counter_ns,
) -> dict[str, Any]:
    observations = []
    # Model/artifact initialization happens in the factory, not per sample.
    # Warmup is public, neutral, contains no evaluated data, and is not scored.
    backend.clear_cache()
    backend.predict(RouterInput(text="Hello CareerX", role="student", page_route_id="student_home"))
    for row in rows:
        context = contexts.get(row.id)
        request = RouterInput(
            text=row.text,
            role=row.role,
            page_route_id=row.page_route_id,
            previous_targets=tuple(context.previous_targets) if context else (),
        )
        try:
            backend.clear_cache()
        except Exception:
            observations.append(Observation(row, None, None, "cache_reset_error"))
            continue
        started = clock_ns()
        try:
            raw = backend.predict(request)
        except Exception:
            elapsed = (clock_ns() - started) / 1_000_000
            observations.append(Observation(row, None, elapsed, "prediction_error"))
            continue
        elapsed = (clock_ns() - started) / 1_000_000
        try:
            prediction = RouterPrediction.model_validate(raw.model_dump() if isinstance(raw, BaseModel) else raw)
        except (ValueError, TypeError):
            observations.append(Observation(row, None, elapsed, "invalid_prediction"))
            continue
        error = "cache_hit" if prediction.source == "cache" else None
        observations.append(Observation(row, prediction, elapsed, error))
    aggregate = metrics(observations)
    gates = threshold_gates(aggregate)
    subsets = {
        "followup": metrics([item for item in observations if "followup" in item.row.tags]),
        "non_followup": metrics([item for item in observations if "followup" not in item.row.tags]),
        "synthetic": metrics([item for item in observations if "synthetic" in item.row.tags]),
        "real": metrics([item for item in observations if "real" in item.row.tags]),
    }
    for tag in ("no_diacritics", "typo", "adversarial", "ambiguous", "vi", "en", "mixed"):
        subsets[tag] = metrics([item for item in observations if tag in item.row.tags])
    for role in ("student", "advisor", "admin"):
        subsets[role] = metrics([item for item in observations if item.row.role == role])
    real_count = subsets["real"]["count"]
    return {
        "metrics": aggregate,
        "gates": gates,
        "subsets": subsets,
        "passed": all(gate["passed"] for gate in gates.values()),
        "real_utterances": real_count,
        "release_ready": real_count >= 100 and all(gate["passed"] for gate in gates.values()),
        "interpretation": "Synthetic/recorded benchmark results are not product or model quality. Follow-ups are heldout-only, never tuning data.",
        "failures": [{"id": item.row.id, "error": item.error} for item in observations if item.error],
    }


def load_suite(root: Path, split: str) -> tuple[list[RouterRow], dict[str, FollowupContext], str]:
    digest = verify_heldout(root)
    splits = {name: load_rows(root / f"{name}.jsonl") for name in ("train", "dev", "heldout")}
    seen_ids: set[str] = set()
    seen_text: set[str] = set()
    for name, rows in splits.items():
        for row in rows:
            if "template" in row.tags or not (("synthetic" in row.tags) != ("real" in row.tags)):
                raise ValueError("Dataset rows require real/synthetic provenance and no templates")
            if name != "heldout" and {"real", "followup"} & set(row.tags):
                raise ValueError("Real and followup rows must remain heldout-only")
            if row.id in seen_ids or fold(row.text) in seen_text:
                raise ValueError("Duplicate utterance/ID across router splits")
            seen_ids.add(row.id)
            seen_text.add(fold(row.text))
    contexts = load_contexts(root)
    expected_contexts = {row.id for row in splits["heldout"] if "followup" in row.tags}
    if set(contexts) != expected_contexts:
        raise ValueError("Followup context IDs must exactly match the heldout followup subset")
    return splits[split], contexts, digest


def _number(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.4f}"


def render_report(report: dict[str, Any]) -> str:
    data = report["metrics"]
    lines = [
        f"Router benchmark | backend={report['backend']} | split={report['split']} | n={data['count']}",
        f"Dataset SHA256: {report['dataset_sha256']}",
        f"Heldout SHA256: {report['heldout_sha256']}",
        "Synthetic/recorded benchmark results are not product or model quality.",
        "",
        "Metric                         Value        Support",
        f"Accuracy                       {_number(data['accuracy']):12} {data['count']}",
    ]
    for route, value in data["slots"].items():
        lines.append(f"{route + ' slot exact-match':30} {_number(value['exact_match']):12} {value['support']}")
    safety = data["deny_unsafe_injection"]
    latency = data["latency_ms"]
    lines.extend(
        [
            f"Deny recall unsafe+injection    {_number(safety['recall']):12} {safety['support']}",
            f"Cache-miss p50 (ms)             {_number(latency['p50']):12} {latency['support']}",
            f"Cache-miss p95 (ms)             {_number(latency['p95']):12} {latency['support']}",
            "",
            "Route           Precision    Recall       Support",
        ]
    )
    for route, value in data["per_route"].items():
        lines.append(f"{route:15} {_number(value['precision']):12} {_number(value['recall']):12} {value['support']}")
    matrix = data["confusion_matrix"]
    columns = list(next(iter(matrix.values())))
    lines.extend(
        [
            "",
            "Confusion matrix (rows=gold, columns=prediction)",
            f"{'':12}" + " ".join(f"{column:>10}" for column in columns),
        ]
    )
    for route, values in matrix.items():
        lines.append(f"{route:12}" + " ".join(f"{values[column]:10}" for column in columns))
    for pair, value in data["confusion_pairs"].items():
        lines.append(f"Confusion {pair}: {json.dumps(value, sort_keys=True)}")
    lines.extend(["", "Subset          Accuracy     Support (followups never used for tuning)"])
    for name, value in report["subsets"].items():
        lines.append(f"{name:15} {_number(value['accuracy']):12} {value['count']}")
    lines.append("")
    for name, gate in report["gates"].items():
        lines.append(
            f"{'PASS' if gate['passed'] else 'FAIL'} {name}: {_number(gate['value'])} {gate['operator']} {gate['threshold']}"
        )
    lines.append(f"Numeric benchmark gates: {'PASS' if report['passed'] else 'FAIL'}")
    lines.append(
        f"Release evidence: {'ready' if report['release_ready'] else 'INCOMPLETE'}; reviewed real utterances={report['real_utterances']} (need >=100)."
    )
    if report["split"] != "heldout":
        lines.append("Development split: this run cannot establish heldout release acceptance.")
    if report["failures"]:
        lines.append("Backend errors (no raw text/exception details): " + json.dumps(report["failures"]))
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=["router"], default="router")
    parser.add_argument(
        "--backend", default="local", help="Registered name, careerx.router_eval entry point, or module:factory"
    )
    parser.add_argument("--split", choices=["dev", "heldout"], default="heldout")
    parser.add_argument("--data-dir", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, help="Optional full machine-readable JSON report")
    parser.add_argument("--require-real", action="store_true", help="Also fail without 100 real heldout utterances")
    args = parser.parse_args(argv)
    try:
        rows, contexts, heldout_digest = load_suite(args.data_dir, args.split)
        backend = load_backend(args.backend)
        report = evaluate(rows, backend, contexts)
        report.update(
            {
                "suite": "router",
                "backend": args.backend,
                "split": args.split,
                "dataset_sha256": hashlib.sha256((args.data_dir / f"{args.split}.jsonl").read_bytes()).hexdigest(),
                "heldout_sha256": heldout_digest,
                "context_sha256": hashlib.sha256((args.data_dir / "followup_contexts.json").read_bytes()).hexdigest(),
                "inventory": inventory(rows),
            }
        )
        report["release_ready"] = report["release_ready"] and args.split == "heldout"
        if args.require_real:
            report["gates"]["real_heldout_evidence"] = {
                "value": report["real_utterances"],
                "operator": ">=",
                "threshold": 100,
                "passed": args.split == "heldout" and report["real_utterances"] >= 100,
            }
            report["passed"] = all(gate["passed"] for gate in report["gates"].values())
        print(render_report(report))
        if args.output:
            args.output.write_text(
                json.dumps(report, indent=2, ensure_ascii=True, allow_nan=False) + "\n", encoding="utf-8"
            )
        return 0 if report["passed"] else 1
    except Exception as exc:
        # Backend import/configuration/warmup errors must not become green runs
        # or disclose user/provider exception messages, secrets, or raw input.
        print(
            f"Router evaluation failed ({type(exc).__name__}). Check dataset integrity and the named backend's factory/predict/clear_cache contract. The local router adapter is supplied by the separate router task.",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
