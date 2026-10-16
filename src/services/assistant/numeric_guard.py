"""Deterministic numeric grounding checks shared by result and agent answers."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

_NUMBER = re.compile(r"(?<![\w])[-+]?\d+(?:[.,]\d+)?\s*%?(?!\w)")


def _canonical(value: str) -> str | None:
    value = value.strip().replace("%", "").replace(",", ".")
    try:
        number = Decimal(value)
    except InvalidOperation:
        return None
    if not number.is_finite():
        return None
    normalized = number.normalize()
    return format(normalized, "f")


def _flatten(value: Any) -> list[str]:
    if isinstance(value, dict):
        return [item for child in value.values() for item in _flatten(child)]
    if isinstance(value, (list, tuple, set)):
        return [item for child in value for item in _flatten(child)]
    return [str(value)] if value is not None else []


def numeric_claims_are_grounded(prose: str, facts: Any) -> bool:
    """Return false when prose contains any numeric value absent from facts.

    Percent signs and equivalent decimal spellings are normalized, so 72 and
    72.0% ground to the same stored figure.
    """
    allowed = {
        claim
        for value in _flatten(facts)
        for claim in (_canonical(match.group()) for match in _NUMBER.finditer(value))
        if claim is not None
    }
    return all(
        (claim := _canonical(match.group())) is not None and claim in allowed for match in _NUMBER.finditer(prose)
    )
