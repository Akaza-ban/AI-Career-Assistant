"""Text preparation only; dates and resource references remain raw."""

import re
import unicodedata
from dataclasses import dataclass

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.models import Language
from src.services.assistant.text import fold_diacritics


@dataclass(frozen=True)
class NormalizedText:
    raw: str
    normalized: str
    folded: str


def normalize(message: str) -> NormalizedText:
    raw = unicodedata.normalize("NFC", message)
    normalized = " ".join(raw.lower().split())
    return NormalizedText(raw=raw, normalized=normalized, folded=fold_diacritics(normalized))


def detect_language(message: str) -> Language:
    text = normalize(message)
    words = set(re.findall(r"\w+", text.folded))
    vocabulary = LEXICONS["language"]
    vi = bool(words.intersection(vocabulary["vi"]) or re.search(vocabulary["vi_characters"], text.raw.lower()))
    en = bool(words.intersection(vocabulary["en"]))
    return "mixed" if vi and en else "en" if en else "vi"
