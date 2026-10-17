"""Encrypted, conversation-bound storage with mandatory kind/origin scopes.

The caller supplies an authorized conversation and owns the SQL transaction.
Writes/cleanup flush, never commit an unrelated business transaction. Commit
before checkpoint/provider dispatch; rollback on any privacy failure.
"""

import base64
import hashlib
import hmac
import json
import secrets
from collections.abc import Callable, Collection
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from src.config import Settings, get_settings
from src.db.models import AssistantConversation
from src.services.privacy.storage import VaultRecord
from src.services.privacy.types import (
    KINDS,
    MAX_PLACEHOLDER_LENGTH,
    PLACEHOLDER_RE,
    Kind,
    PrivacyError,
    ResolutionError,
    VaultError,
    validate_origin,
)


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class PiiVault:
    def __init__(
        self,
        db: Session,
        conversation_id: str,
        *,
        settings: Settings | None = None,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        settings = settings or get_settings()
        try:
            key = settings.pii_vault_key.get_secret_value().encode("ascii")
            self._fernet = Fernet(key)
            self._hash_key = base64.urlsafe_b64decode(key)
            if db.get(AssistantConversation, conversation_id) is None:
                raise VaultError("PII vault conversation not found")
        except VaultError:
            raise
        except Exception:
            raise VaultError("PII vault key or storage unavailable") from None
        self._db = db
        self._conversation_id = conversation_id
        self._ttl = timedelta(hours=settings.pii_vault_ttl_hours)
        self._clock = clock

    def _nonce(self) -> str:
        # Compare-and-set is safe even when separate sessions first mask the same
        # conversation. SQLite serializes writers; no process-local nonce cache.
        self._db.execute(
            update(AssistantConversation)
            .where(AssistantConversation.id == self._conversation_id, AssistantConversation.pii_nonce.is_(None))
            .values(pii_nonce=secrets.token_hex(16))
        )
        nonce = self._db.scalar(
            select(AssistantConversation.pii_nonce).where(AssistantConversation.id == self._conversation_id)
        )
        if nonce is None or not PLACEHOLDER_RE.fullmatch(f"[[PERSON_{nonce}_1]]"):
            raise VaultError("PII vault conversation unavailable")
        return nonce

    def _decrypt(self, record: VaultRecord) -> str:
        now = self._clock()
        if record.created_at <= now - self._ttl or record.created_at > now:
            raise ResolutionError("Placeholder unavailable or outside its scope")
        try:
            value = json.loads(
                self._fernet.decrypt_at_time(
                    record.ciphertext.encode("ascii"),
                    ttl=max(1, int(self._ttl.total_seconds())),
                    current_time=int(now.replace(tzinfo=UTC).timestamp()),
                )
            )
            expected = [record.conversation_id, record.placeholder, record.kind, record.origin]
            if value["scope"] != expected or not isinstance(value["original"], str):
                raise VaultError("PII vault integrity failure")
            return value["original"]
        except PrivacyError:
            raise
        except Exception:
            raise VaultError("PII vault integrity failure") from None

    def store(self, original: str, kind: Kind, origin: str) -> str:
        """Deduplicate exact originals without storing a plaintext reverse index."""
        try:
            validate_origin(origin)
            if kind not in KINDS or len(origin) > 128 or not isinstance(original, str) or not original:
                raise VaultError("Invalid PII entry")
            nonce = self._nonce()
            digest = hmac.digest(
                self._hash_key, (self._conversation_id + "\0" + original).encode("utf-8"), hashlib.sha256
            )
            number = str(int.from_bytes(digest[:16], "big"))
            placeholder = f"[[{kind}_{nonce}_{number}]]"
            if len(placeholder) > MAX_PLACEHOLDER_LENGTH:
                raise VaultError("Invalid PII placeholder length")
            now = self._clock()
            # One exact original has one canonical kind/token, even if another
            # detector later classifies an ambiguous phone/ID differently.
            existing = list(
                self._db.scalars(
                    select(VaultRecord).where(
                        VaultRecord.conversation_id == self._conversation_id,
                        VaultRecord.placeholder.like(f"%_{nonce}_{number}]]"),
                        VaultRecord.created_at > now - self._ttl,
                    )
                )
            )
            for record in existing:
                if self._decrypt(record) != original:
                    raise VaultError("PII vault integrity failure")
                if record.placeholder != existing[0].placeholder or record.kind != existing[0].kind:
                    raise VaultError("PII vault has inconsistent canonical entries")
            if existing:
                kind = existing[0].kind
                placeholder = existing[0].placeholder
            record = self._db.get(VaultRecord, (self._conversation_id, placeholder, origin))
            if record is not None and record.created_at > now - self._ttl:
                if record.kind != kind or self._decrypt(record) != original:
                    raise VaultError("PII vault integrity failure")
                return placeholder
            scope = [self._conversation_id, placeholder, kind, origin]
            ciphertext = self._fernet.encrypt_at_time(
                json.dumps({"scope": scope, "original": original}, ensure_ascii=False).encode("utf-8"),
                current_time=int(now.replace(tzinfo=UTC).timestamp()),
            ).decode("ascii")
            if record is None:
                record = VaultRecord(conversation_id=self._conversation_id, placeholder=placeholder, origin=origin)
                self._db.add(record)
            record.kind, record.ciphertext, record.created_at = kind, ciphertext, now
            self._db.flush()
            return placeholder
        except PrivacyError:
            raise
        except Exception:
            raise VaultError("PII vault write failed; provider calls are forbidden") from None

    def resolve_placeholder(
        self, placeholder: str, allowed_kinds: Collection[str], allowed_origins: Collection[str]
    ) -> str:
        """Only lookup API; SQL itself restricts conversation, kind, origin, TTL."""
        try:
            kinds, origins = frozenset(allowed_kinds), frozenset(allowed_origins)
            for origin in origins:
                validate_origin(origin)
            match = PLACEHOLDER_RE.fullmatch(placeholder)
            if not kinds or not origins or kinds - KINDS or match is None or match.group(1) not in kinds:
                raise ResolutionError("Placeholder unavailable or outside its scope")
            record = self._db.scalar(
                select(VaultRecord).where(
                    VaultRecord.conversation_id == self._conversation_id,
                    VaultRecord.placeholder == placeholder,
                    VaultRecord.kind.in_(kinds),
                    VaultRecord.origin.in_(origins),
                    VaultRecord.created_at > self._clock() - self._ttl,
                )
            )
            if record is None:
                raise ResolutionError("Placeholder unavailable or outside its scope")
            return self._decrypt(record)
        except PrivacyError:
            raise
        except Exception:
            raise VaultError("PII vault resolution failed") from None

    def purge_expired(self) -> int:
        """Delete expired entries for this conversation, without committing."""
        try:
            result = self._db.execute(
                delete(VaultRecord).where(
                    VaultRecord.conversation_id == self._conversation_id,
                    VaultRecord.created_at <= self._clock() - self._ttl,
                )
            )
            return result.rowcount
        except Exception:
            raise VaultError("PII vault TTL cleanup failed") from None

    def delete_by_conversation(self) -> int:
        """Erase this vault; deleting the conversation also cascades via migration."""
        try:
            result = self._db.execute(delete(VaultRecord).where(VaultRecord.conversation_id == self._conversation_id))
            return result.rowcount
        except Exception:
            raise VaultError("PII vault deletion failed") from None
