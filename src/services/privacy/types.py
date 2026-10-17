"""Shared contracts; errors deliberately never contain inbound text."""

import re
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from typing import Literal, Protocol

Kind = Literal["PERSON", "EMAIL", "PHONE", "ID", "URL", "HANDLE", "DOB", "ADDRESS"]
KINDS: frozenset[str] = frozenset(Kind.__args__)
# KIND <= 7, nonce = 32 hex characters, n <= 39 decimal digits, delimiters = 6.
# Streaming code must import this constant rather than invent its own bound.
MAX_PLACEHOLDER_LENGTH = 84
PLACEHOLDER_RE = re.compile(r"\[\[([A-Z]+)_([a-f0-9]{32})_([0-9]{1,39})\]\]")


class PrivacyError(RuntimeError):
    """Fail closed: the caller must stop before any provider invocation."""


class MaskingError(PrivacyError):
    pass


class NerUnavailableError(MaskingError):
    pass


class ExtractionError(MaskingError):
    pass


class VaultError(PrivacyError):
    pass


class ResolutionError(PrivacyError):
    pass


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    kind: Kind
    layer: int = 4


@dataclass(frozen=True)
class Identity:
    """Supply only identities loaded from an authenticated, authorized DB scope."""

    name: str = ""
    email: str = ""
    phone: str = ""


class Ner(Protocol):
    def detect(self, text: str) -> Sequence[Span]: ...


class Vault(Protocol):
    def store(self, original: str, kind: Kind, origin: str) -> str: ...

    def resolve_placeholder(
        self, placeholder: str, allowed_kinds: Collection[str], allowed_origins: Collection[str]
    ) -> str: ...


def validate_origin(origin: str) -> None:
    if not re.fullmatch(r"message|(?:cv|jd):[^\s:]+", origin):
        raise VaultError("Invalid PII origin")
