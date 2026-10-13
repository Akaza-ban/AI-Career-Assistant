"""Annotations are explicit original character spans, never detector-generated."""

import json
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from src.services.privacy.types import KINDS, Span

ROOT = Path(__file__).parent


@dataclass(frozen=True)
class Sample:
    id: str
    language: str
    category: str
    format: str
    review_status: str
    text: str
    entities: tuple[Span, ...]
    keep: tuple[tuple[int, int, str], ...]
    filename: str = ""
    filename_entities: tuple[Span, ...] = ()
    document: Path | None = None


def _spans(values: list[dict[str, Any]], text: str) -> tuple[Span, ...]:
    result = []
    for value in values:
        span = Span(value["start"], value["end"], value["kind"])
        if span.kind not in KINDS or not 0 <= span.start < span.end <= len(text):
            raise ValueError("Invalid golden PII annotation")
        if text[span.start : span.end] != value["text"]:
            raise ValueError("Golden PII annotation text/offset mismatch")
        result.append(span)
    return tuple(result)


def parse_sample(value: dict[str, Any], root: Path) -> Sample:
    text, filename = value["text"], value.get("filename", "")
    keeps = []
    for entity in value.get("keep", []):
        start, end = entity["start"], entity["end"]
        if not 0 <= start < end <= len(text) or text[start:end] != entity["text"]:
            raise ValueError("Invalid golden preservation annotation")
        keeps.append((start, end, entity["kind"]))
    document = None
    if value.get("document"):
        document = (root / value["document"]).resolve()
        if not document.is_relative_to(root.resolve()) or not document.is_file():
            raise ValueError("Golden document missing or outside dataset directory")
    return Sample(
        id=value["id"],
        language=value["language"],
        category=value["category"],
        format=value["format"],
        review_status=value["review_status"],
        text=text,
        entities=_spans(value["entities"], text),
        keep=tuple(keeps),
        filename=filename,
        filename_entities=_spans(value.get("filename_entities", []), filename),
        document=document,
    )


def load_synthetic(root: Path = ROOT) -> list[Sample]:
    with (root / "golden.jsonl").open(encoding="utf-8") as stream:
        samples = [parse_sample(json.loads(line), root) for line in stream if line.strip()]
    if len({sample.id for sample in samples}) != len(samples):
        raise ValueError("Duplicate golden sample IDs")
    return samples


def load_real(root: Path = ROOT / "real") -> list[Sample]:
    """Held-out only: never tune or manufacture examples for this directory."""
    files = sorted(root.glob("*.json")) if root.is_dir() else []
    if not files:
        warnings.warn(
            "Held-out real-format CV directory is empty; skipping real evaluation. Team must supply 10+ reviewed CVs.",
            UserWarning,
            stacklevel=2,
        )
        return []
    samples = [parse_sample(json.loads(path.read_text(encoding="utf-8")), root) for path in files]
    if any(sample.review_status != "human_reviewed" for sample in samples):
        raise ValueError("Held-out real CVs require human_reviewed annotations")
    if any(sample.category != "cv" for sample in samples) or len({sample.id for sample in samples}) != len(samples):
        raise ValueError("Invalid held-out CV categories or duplicate IDs")
    return samples
