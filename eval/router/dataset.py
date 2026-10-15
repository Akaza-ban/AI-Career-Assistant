"""Evaluation-only annotations, deliberately independent of the production router."""

import hashlib
import json
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).parent
ROUTES = ("smalltalk", "howto", "locate", "result", "navigate", "clarify", "deny")
Route = Literal["smalltalk", "howto", "locate", "result", "navigate", "clarify", "deny"]
Language = Literal["vi", "en", "mixed"]
DenyReason = Literal["off_topic", "unsafe", "injection", "out_of_role"]
NonEmpty = Annotated[str, Field(min_length=1)]


class NavSlots(BaseModel):
    """Section 5.1 raw qualifiers, not resolved IDs, URLs, dates or metrics."""

    model_config = ConfigDict(extra="forbid", strict=True)
    target: Literal["page", "cv", "jd", "analysis", "interview", "report"] | None = None
    page_hint: NonEmpty | None = None
    when_expr: NonEmpty | None = None
    latest: bool = False
    jd_ref: NonEmpty | None = None
    cv_ref: NonEmpty | None = None
    free_ref: NonEmpty | None = None


class RouterRow(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    id: Annotated[str, Field(pattern=r"^[a-zA-Z0-9_-]+$")]
    text: NonEmpty
    role: Literal["student", "advisor", "admin"]
    page_route_id: NonEmpty | None
    label: Route
    deny_reason: DenyReason | None = None
    slots: NavSlots | None = None
    language: Language
    tags: list[NonEmpty]

    @model_validator(mode="after")
    def annotations_consistent(self) -> Self:
        if not self.text.strip():
            raise ValueError("Utterance must not be whitespace")
        if len(set(self.tags)) != len(self.tags) or self.language not in self.tags:
            raise ValueError("Unique tags must include the language")
        if set(self.tags) & {"vi", "en", "mixed"} != {self.language}:
            raise ValueError("Language tags disagree")
        if (self.label == "deny") != (self.deny_reason is not None):
            raise ValueError("Only deny rows require deny_reason")
        if self.label in {"navigate", "result"} and (self.slots is None or self.slots.target is None):
            raise ValueError("Navigate/result require gold target slots")
        if self.label not in {"navigate", "result"} and self.slots is not None:
            raise ValueError("Gold NavSlots only apply to navigate/result")
        if "no_diacritics" in self.tags and (fold(self.text) != self.text.lower() or self.language == "en"):
            raise ValueError("no_diacritics is reserved for accent-free Vietnamese typing")
        if "synthetic" in self.tags and "real" in self.tags:
            raise ValueError("Provenance cannot be both real and synthetic")
        return self


class CardTarget(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    ref: NonEmpty
    route_id: NonEmpty
    params: dict[str, str]
    label: NonEmpty


class FollowupContext(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    previous_targets: list[CardTarget]


def fold(text: str) -> str:
    """Annotation duplicate check only; same stdlib convention as agent.normalized."""
    return " ".join(
        "".join(
            c for c in unicodedata.normalize("NFD", text.lower().replace("đ", "d")) if not unicodedata.combining(c)
        ).split()
    )


def load_rows(path: Path) -> list[RouterRow]:
    rows = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        try:
            rows.append(RouterRow.model_validate(json.loads(line)))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid annotation at {path.name}:{line_number}") from exc
    if not rows or len({row.id for row in rows}) != len(rows):
        raise ValueError(f"Empty dataset or duplicate IDs in {path.name}")
    return rows


def verify_heldout(root: Path = ROOT) -> str:
    """Hash exact bytes, so newline or encoding changes also invalidate the freeze."""
    expected = (root / "heldout.sha256").read_text(encoding="ascii").strip().split()
    actual = hashlib.sha256((root / "heldout.jsonl").read_bytes()).hexdigest()
    if expected != [actual, "heldout.jsonl"]:
        raise ValueError("Frozen heldout.jsonl hash mismatch; requires a reviewed data-version PR")
    return actual


def load_contexts(root: Path = ROOT) -> dict[str, FollowupContext]:
    values = json.loads((root / "followup_contexts.json").read_text(encoding="utf-8"))
    return {key: FollowupContext.model_validate(value) for key, value in values.items()}


def inventory(rows: list[RouterRow]) -> dict[str, object]:
    return {
        "total": len(rows),
        "route": dict(sorted(Counter(row.label for row in rows).items())),
        "language": dict(sorted(Counter(row.language for row in rows).items())),
        "role": dict(sorted(Counter(row.role for row in rows).items())),
        "subsets": {
            **{
                tag: sum(tag in row.tags for row in rows)
                for tag in ("no_diacritics", "typo", "adversarial", "ambiguous", "followup", "real")
            },
            "result": sum(row.label == "result" for row in rows),
            "navigate_with_slots": sum(row.label == "navigate" and row.slots is not None for row in rows),
        },
    }
