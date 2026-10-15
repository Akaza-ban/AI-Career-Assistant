"""Match folded vocabulary while mapping every extracted span to raw NFC text."""

import re
from dataclasses import dataclass, field

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.text import normalize
from src.services.assistant.text import fold_diacritics

PATTERNS = {name: re.compile(pattern) for name, pattern in LEXICONS["patterns"].items()}


def phrase_pattern(phrase: str) -> re.Pattern[str]:
    return re.compile(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)")


def matches(text: str, phrases: list[str]) -> list[re.Match[str]]:
    return [match for phrase in phrases for match in phrase_pattern(phrase).finditer(text)]


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
