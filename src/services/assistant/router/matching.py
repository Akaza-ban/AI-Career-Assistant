"""Match folded vocabulary while mapping every extracted span to raw NFC text."""

import re
from dataclasses import dataclass, field
from functools import lru_cache

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.text import normalize
from src.services.assistant.text import fold_diacritics

PATTERNS = {name: re.compile(pattern) for name, pattern in LEXICONS["patterns"].items()}


@lru_cache(maxsize=1024)
def phrase_pattern(phrase: str) -> re.Pattern[str]:
    return re.compile(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)")


def matches(text: str, phrases: list[str]) -> list[re.Match[str]]:
    found = []
    alternatives = fuzzy_tokens(text)
    for phrase in phrases:
        exact = list(phrase_pattern(phrase).finditer(text))
        if exact:
            found.extend(exact)
            continue
        words = phrase.split()
        if not any(word in alternatives for word in words):
            continue
        pattern = " ".join(
            "(?:" + "|".join(re.escape(v) for v in [word, *alternatives.get(word, ())]) + ")" for word in words
        )
        found.extend(re.finditer(r"(?<!\w)" + pattern + r"(?!\w)", text))
    return found


def edit_distance_one(left: str, right: str) -> bool:
    if min(len(left), len(right)) < 5 or abs(len(left) - len(right)) > 1:
        return False
    if len(left) > len(right):
        left, right = right, left
    i = j = errors = 0
    while i < len(left) and j < len(right):
        if left[i] != right[j]:
            errors += 1
            if errors > 1:
                return False
            if len(left) == len(right):
                i += 1
            j += 1
        else:
            i += 1
            j += 1
    return errors + int(j < len(right) or i < len(left)) == 1


_FUZZY_VOCABULARY = frozenset(
    word
    for section in ("families", "entities")
    for phrases in LEXICONS[section].values()
    for phrase in phrases
    for word in phrase.split()
    if len(word) >= 5
)


@lru_cache(maxsize=2048)
def fuzzy_tokens(text: str) -> dict[str, tuple[str, ...]]:
    found: dict[str, list[str]] = {}
    for token in set(re.findall(r"\b\w{5,}\b", text)):
        if token in _FUZZY_VOCABULARY:
            continue
        candidates = [word for word in _FUZZY_VOCABULARY if edit_distance_one(token, word)]
        if len(candidates) == 1:
            found.setdefault(candidates[0], []).append(token)
    return {word: tuple(sorted(tokens)) for word, tokens in found.items()}


@dataclass
class SurfaceText:
    raw: str
    folded: str = field(init=False)
    _offsets: list[int] = field(init=False, default_factory=list)

    def __post_init__(self) -> None:
        self.raw = normalize(self.raw).raw
        parts = []
        for token in re.finditer(r"\S+", self.raw):
            if parts:
                parts.append(" ")
                self._offsets.append(token.start() - 1)
            for offset, char in enumerate(token.group()):
                folded = fold_diacritics(char)
                parts.append(folded)
                self._offsets.extend([token.start() + offset] * len(folded))
        self.folded = "".join(parts)

    def span(self, start: int, end: int) -> str:
        if end <= start:
            return ""
        return self.raw[self._offsets[start] : self._offsets[end - 1] + 1].strip()

    def group(self, match: re.Match[str]) -> str:
        return self.span(match.start(), match.end())
