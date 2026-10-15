"""Aggregate coverage and error attribution; never print evaluation utterances."""

import re
import unicodedata
from typing import Any

from eval.router.dataset import NavSlots
from eval.router.metrics import Observation, metrics, ratio, slot_match


def _convention_form(slots: NavSlots) -> dict[str, Any]:
    values = slots.model_dump()
    for key, value in values.items():
        if isinstance(value, str):
            value = " ".join(unicodedata.normalize("NFC", value).split())
            if key == "page_hint":
                value = re.sub(r"^(?:trang|page)\s+|\s+page$", "", value, flags=re.IGNORECASE)
            values[key] = value
    return values


def slot_miss_kind(item: Observation) -> str | None:
    """Keep route failures separate from extractor failures and surface conventions.

    Convention matches are review candidates, not corrected scores or labels.
    Never fold diacritics, infer a JD, or interpret dates to forgive an error.
    """
    if item.row.label not in {"navigate", "result"} or slot_match(item):
        return None
    if item.error or item.prediction is None or item.prediction.route != item.row.label:
        return "upstream_route_miss"
    if item.prediction.slots is None:
        return "extractor_bug"
    predicted = NavSlots.model_validate(item.prediction.slots)
    if item.row.slots is not None and _convention_form(predicted) == _convention_form(item.row.slots):
        return "gold_convention_mismatch"
    return "extractor_bug"


def diagnostics(observations: list[Observation], *, threshold: float = 0.9) -> dict[str, Any]:
    decided = [
        item
        for item in observations
        if item.error is None
        and item.prediction is not None
        and item.prediction.source in {"stage0", "rules"}
        and item.prediction.confidence is not None
        and item.prediction.confidence >= threshold
    ]
    selected = metrics(decided)
    stages = {source: sum(item.prediction.source == source for item in decided) for source in ("stage0", "rules")}
    deny = {}
    for reason in ("unsafe", "injection", "out_of_role", "off_topic"):
        gold = [item for item in observations if item.row.label == "deny" and item.row.deny_reason == reason]
        correct_route = sum(
            item.error is None and item.prediction is not None and item.prediction.route == "deny" for item in gold
        )
        correct_reason = sum(
            item.error is None
            and item.prediction is not None
            and item.prediction.route == "deny"
            and item.prediction.deny_reason == reason
            for item in gold
        )
        deny[reason] = {
            "support": len(gold),
            "route_correct": correct_route,
            "recall": ratio(correct_route, len(gold)),
            "reason_correct": correct_reason,
            "reason_exact_recall": ratio(correct_reason, len(gold)),
        }
    slot_misses = {}
    for route in ("navigate", "result"):
        subset = [item for item in observations if item.row.label == route]
        categories = dict.fromkeys(("gold_convention_mismatch", "extractor_bug", "upstream_route_miss"), 0)
        for item in subset:
            kind = slot_miss_kind(item)
            if kind is not None:
                categories[kind] += 1
        slot_misses[route] = {"support": len(subset), "misses": sum(categories.values()), **categories}
    return {
        "coverage": {
            "threshold": threshold,
            "decided": len(decided),
            "total": len(observations),
            "share": ratio(len(decided), len(observations)),
            "by_stage": stages,
        },
        "decided_only": {
            "count": len(decided),
            "correct": selected["correct"],
            "precision_micro": selected["accuracy"],
            "recall_micro": selected["accuracy"],
            "correct_share_all": ratio(selected["correct"], len(observations)),
            "per_route": selected["per_route"],
        },
        "deny_by_reason": deny,
        "slot_miss_categories": slot_misses,
    }
