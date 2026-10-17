"""Encrypted, short-lived vault for jobs without an assistant conversation.

No mapping is checkpointed or logged. Destroy at the end of the business call;
conversation workflows with persistent checkpoints must use PiiVault instead.
"""

import hmac
import secrets
from collections.abc import Collection
from time import monotonic

from cryptography.fernet import Fernet

from src.services.privacy.detectors import _fold, merge_spans
from src.services.privacy.types import Kind, ResolutionError, Span, VaultError, validate_origin


class TransientVault:
    def __init__(self, ttl_seconds: float) -> None:
        self._cipher = Fernet(Fernet.generate_key())
        self._nonce = secrets.token_hex(16)
        self._expires = monotonic() + ttl_seconds
        self._entries: dict[str, tuple[Kind, set[str], bytes]] = {}
        self._hash_key = secrets.token_bytes(32)
        self._index: dict[bytes, str] = {}

    def _check(self) -> None:
        if monotonic() >= self._expires:
            raise VaultError("Transient privacy scope expired")

    def store(self, original: str, kind: Kind, origin: str) -> str:
        self._check()
        validate_origin(origin)
        digest = hmac.digest(self._hash_key, original.encode(), "sha256")
        token = self._index.get(digest)
        if token is not None:
            _, origins, ciphertext = self._entries[token]
            if self._cipher.decrypt(ciphertext).decode() != original:
                raise VaultError("Transient privacy vault integrity failure")
            origins.add(origin)
            return token
        token = f"[[{kind}_{self._nonce}_{len(self._entries) + 1}]]"
        self._entries[token] = (kind, {origin}, self._cipher.encrypt(original.encode()))
        self._index[digest] = token
        return token

    def resolve_placeholder(
        self, placeholder: str, allowed_kinds: Collection[str], allowed_origins: Collection[str]
    ) -> str:
        self._check()
        entry = self._entries.get(placeholder)
        if entry is None or entry[0] not in allowed_kinds or not entry[1].intersection(allowed_origins):
            raise ResolutionError("Placeholder unavailable or outside its scope")
        return self._cipher.decrypt(entry[2]).decode()

    def dictionary_spans(self, text: str) -> list[Span]:
        """Re-detect identified header/referee names elsewhere in a full prompt."""
        import re

        self._check()
        folded, offsets = _fold(text)
        spans = []
        for kind, _, ciphertext in self._entries.values():
            needle, _ = _fold(self._cipher.decrypt(ciphertext).decode())
            for match in re.finditer(r"(?<!\w)" + re.escape(needle) + r"(?!\w)", folded):
                spans.append(Span(offsets[match.start()], offsets[match.end() - 1] + 1, kind, 1))
        return merge_spans(spans, len(text))

    def clear(self) -> None:
        self._entries.clear()
        self._index.clear()
        self._hash_key = b""
        self._expires = 0
