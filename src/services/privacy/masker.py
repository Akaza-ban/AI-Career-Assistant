"""Escape inbound literals, mask locally, and resolve only server-authorized scopes.

Callers must authorize the conversation before constructing its vault, and derive
allowed_origins from owned resources, never from model-produced origin strings.
Pass inbound text through mask exactly once; escaped literals are wire values.
"""

import re
from collections.abc import Collection, Iterable
from dataclasses import dataclass
from pathlib import Path

from src.services.privacy.detectors import Detector
from src.services.privacy.types import (
    KINDS,
    MAX_PLACEHOLDER_LENGTH,
    PLACEHOLDER_RE,
    Identity,
    MaskingError,
    PrivacyError,
    ResolutionError,
    Span,
    Vault,
    validate_origin,
)

_ESCAPE_RE = re.compile(r"&amp;|&#91;&#91;")


def escape_inbound(text: str) -> str:
    """Also escape '&' to make the literal-bracket encoding collision-free."""
    return text.replace("&", "&amp;").replace("[[", "&#91;&#91;")


def mask_only(
    text: str,
    *,
    detector: Detector | None = None,
    identities: Iterable[Identity] = (),
    wire: bool = False,
) -> str:
    """One-way assistant masking: no vault, original/token mapping or resolution.

    Filename separators are normalized only in the detection probe, preserving
    offsets and the original spelling of all non-sensitive text.
    """
    try:
        if detector is None:
            from src.services.privacy.ner import get_detector

            detector = get_detector()
        escaped = text if wire else escape_inbound(text)
        probe = re.sub(r"\[\[[^\[\]]*\]\]", lambda m: " " * len(m.group()), escaped) if wire else escaped
        probe = re.sub(r"(?<=\w)[_-](?=\w)", " ", probe)
        probe = re.sub(r"\.(?:pdf|docx|txt)\b", lambda m: " " * len(m.group()), probe, flags=re.I)
        spans = detector.detect(probe, identities=identities, document_type="message")
        chunks: list[str] = []
        cursor = 0
        for span in spans:
            chunks.extend((escaped[cursor : span.start], f"[[{span.kind}]]"))
            cursor = span.end
        chunks.append(escaped[cursor:])
        return "".join(chunks)
    except PrivacyError:
        raise
    except Exception:
        raise MaskingError("Local privacy protection unavailable; please try again later") from None


class PlaceholderFilter:
    """Remove arbitrary double-bracket output, even across stream boundaries.

    State is bounded; an unterminated placeholder never buffers model text.
    """

    def __init__(self, neutral: str = "bạn") -> None:
        self.neutral = neutral
        self._inside = False
        self._pending = ""

    def feed(self, text: str) -> str:
        result: list[str] = []
        for char in text:
            if self._inside:
                if self._pending == "]" and char == "]":
                    self._inside, self._pending = False, ""
                else:
                    self._pending = "]" if char == "]" else ""
            elif self._pending == "[":
                if char == "[":
                    result.append(self.neutral)
                    self._inside, self._pending = True, ""
                else:
                    result.append("[" + char)
                    self._pending = ""
            elif char == "[":
                self._pending = "["
            else:
                result.append(char)
        return "".join(result)

    def finish(self) -> str:
        tail = self._pending if not self._inside else ""
        self._pending, self._inside = "", False
        return tail


def neutralize_placeholders(text: str, *, neutral: str = "bạn") -> str:
    guard = PlaceholderFilter(neutral)
    return guard.feed(text) + guard.finish()


def _unescape(text: str) -> str:
    # One pass, not repeated HTML decoding (which could reactivate an injection).
    return _ESCAPE_RE.sub(lambda m: "&" if m.group() == "&amp;" else "[[", text)


def mask(
    text: str,
    vault: Vault,
    *,
    origin: str = "message",
    detector: Detector | None = None,
    identities: Iterable[Identity] = (),
) -> str:
    """Return a masked wire string or raise; never return raw text on failure."""
    try:
        validate_origin(origin)
        if detector is None:
            from src.services.privacy.ner import get_detector

            detector = get_detector()
        escaped = escape_inbound(text)
        spans = detector.detect(escaped, identities=identities, document_type=origin.split(":", 1)[0])
        chunks: list[str] = []
        cursor = 0
        for span in spans:
            chunks.append(escaped[cursor : span.start])
            placeholder = vault.store(_unescape(escaped[span.start : span.end]), span.kind, origin)
            match = PLACEHOLDER_RE.fullmatch(placeholder)
            if match is None or match.group(1) not in KINDS or len(placeholder) > MAX_PLACEHOLDER_LENGTH:
                raise MaskingError("Vault produced an invalid placeholder")
            chunks.append(placeholder)
            cursor = span.end
        chunks.append(escaped[cursor:])
        return "".join(chunks)
    except PrivacyError:
        raise
    except Exception:
        raise MaskingError("Local masking failed; provider calls are forbidden") from None


def resolve(value: str, vault: Vault, allowed_kinds: Collection[str], allowed_origins: Collection[str]) -> str:
    """Resolve one field. All placeholders must satisfy both scopes or raise.

    There is no unrestricted lookup. An empty scope admits no placeholders.
    Replacements are not re-scanned, including any literal brackets in originals.
    """
    kinds, origins = frozenset(allowed_kinds), frozenset(allowed_origins)
    if kinds - KINDS:
        raise ResolutionError("Invalid field PII kind scope")
    for origin in origins:
        validate_origin(origin)
    matches = list(PLACEHOLDER_RE.finditer(value))
    residue = PLACEHOLDER_RE.sub("", value)
    if "[[" in residue:
        raise ResolutionError("Unknown or malformed placeholder")
    chunks: list[str] = []
    cursor = 0
    for match in matches:
        if match.group(1) not in kinds or len(match.group()) > MAX_PLACEHOLDER_LENGTH:
            raise ResolutionError("Placeholder is not allowed in this field")
        chunks.append(value[cursor : match.start()])
        original = vault.resolve_placeholder(match.group(), kinds, origins)
        chunks.append(escape_inbound(original))
        cursor = match.end()
    chunks.append(value[cursor:])
    return _unescape("".join(chunks))


def unmask(value: str, vault: Vault, *, allowed_kinds: Collection[str], allowed_origins: Collection[str]) -> str:
    """User-visible rehydration still requires an explicit resource/kind scope."""
    return resolve(value, vault, allowed_kinds, allowed_origins)


@dataclass(frozen=True)
class MaskedDocument:
    text: str
    filename: str
    origin: str
    # No bytes/images/metadata from the source document can enter provider input.


def mask_document(
    document: str | Path,
    vault: Vault,
    *,
    origin: str,
    filename: str = "",
    detector: Detector | None = None,
    identities: Iterable[Identity] = (),
) -> MaskedDocument:
    """Mask CV/JD text (or a local PDF) and its separately exposed filename."""
    if not origin.startswith(("cv:", "jd:")):
        raise MaskingError("Document requires a CV or JD origin")
    try:
        if isinstance(document, Path):
            from src.services.privacy.extract import extract

            filename = filename or document.name
            text = extract(document)
        else:
            text = document
        identities = tuple(identities)
        masked_text = mask(text, vault, origin=origin, detector=detector, identities=identities)

        # Filename delimiters become spaces for detection; map offsets back to the
        # original via a detector wrapper, keeping exact round trips possible.
        class FilenameDetector(Detector):
            def detect(self, text: str, **kwargs: object) -> list[Span]:
                active = detector
                if active is None:
                    from src.services.privacy.ner import get_detector

                    active = get_detector()
                probe = re.sub(r"[_-]", " ", text)
                probe = re.sub(r"\.(?:pdf|docx|txt)$", lambda m: " " * len(m.group()), probe, flags=re.I)
                return active.detect(probe, identities=identities, document_type="cv")

        masked_filename = mask(filename, vault, origin=origin, detector=FilenameDetector()) if filename else ""
        return MaskedDocument(masked_text, masked_filename, origin)
    except PrivacyError:
        raise
    except Exception:
        raise MaskingError("Local document masking failed; provider calls are forbidden") from None
