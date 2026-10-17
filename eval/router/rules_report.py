"""Train prints or aggregate dev reports without opening heldout or its sidecar."""

import argparse
import hashlib
import json
from collections.abc import Sequence
from pathlib import Path

from eval.router.backends import RouterInput, load_backend
from eval.router.dataset import ROOT, load_rows
from eval.run import evaluate, render_report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["train", "dev"], required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--print-smalltalk", action="store_true")
    parser.add_argument("--data-dir", type=Path, default=ROOT)
    args = parser.parse_args(argv)
    if args.print_smalltalk and args.split != "train":
        parser.error("Smalltalk row printing is restricted to train")
    rows = load_rows(args.data_dir / f"{args.split}.jsonl")
    backend = load_backend("rules")
    if args.print_smalltalk:
        for row in rows:
            if row.label == "smalltalk":
                decision = backend.predict(RouterInput(text=row.text, role=row.role, page_route_id=row.page_route_id))
                print(
                    json.dumps({"id": row.id, "text": row.text, "decision": decision.model_dump()}, ensure_ascii=False)
                )
        return 0
    report = evaluate(rows, backend, {})
    # The general harness retains row IDs for backend errors. This entry point
    # promises aggregates even on failure; metric denominators/counts stay intact.
    report["failures"] = []
    report["failure_counts"] = report["metrics"]["errors"]
    report.update(
        {
            "suite": "router",
            "backend": "rules",
            "split": args.split,
            "dataset_sha256": hashlib.sha256((args.data_dir / f"{args.split}.jsonl").read_bytes()).hexdigest(),
            "heldout_sha256": "not read: excluded by task scope",
            "context_sha256": None,
            "heldout_accessed": False,
        }
    )
    report["release_ready"] = False
    if args.output:
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(render_report(report))
    print("Aggregate diagnostics: " + json.dumps(report["diagnostics"], sort_keys=True))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
