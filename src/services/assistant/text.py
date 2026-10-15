"""Shared Unicode folding, extracted from the legacy assistant classifier."""

import unicodedata


def fold_diacritics(text: str) -> str:
    """Keep the legacy casefold/NFD convention, including Vietnamese đ."""
    text = unicodedata.normalize("NFD", text.casefold()).replace("đ", "d")
    return "".join(char for char in text if not unicodedata.combining(char))
