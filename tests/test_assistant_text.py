"""Behavior parity for shared legacy helpers used by the local router."""

import unicodedata

import pytest

from src.services.assistant.agent import normalized
from src.services.assistant.guardrails import is_role_forbidden
from src.services.assistant.text import fold_diacritics


@pytest.mark.parametrize("message", ["ĐIỂM CV", "Straße", "  Mở\nJD  ", "đĐ", "你好"])
def test_legacy_normalization_remains_available(message: str) -> None:
    expected = unicodedata.normalize("NFD", message.casefold()).replace("đ", "d")
    expected = "".join(char for char in expected if not unicodedata.combining(char))
    assert normalized(message) == fold_diacritics(message) == expected


@pytest.mark.parametrize(
    "message,forbidden",
    [
        ("Mở advisor", True),
        ("Mở dashboard", True),
        ("Mở cố vấn", True),
        ("Chia sẻ CV với cố vấn", False),
        ("Chia sẻ advisor dashboard", True),
        ("Mở CV", False),
    ],
)
def test_existing_student_role_gate(message: str, forbidden: bool) -> None:
    assert is_role_forbidden(message, "student") is forbidden
    assert not is_role_forbidden(message, "advisor")
