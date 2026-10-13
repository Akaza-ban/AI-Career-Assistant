"""Password verification and signed, server-revocable cookie sessions."""

import hashlib
import hmac
import secrets
from datetime import timedelta
from functools import lru_cache

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.config import get_settings
from src.db.models import AuthSession, User, utcnow

COOKIE_NAME = "careerx_session"
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 32768, 8, 3


def hash_password(password: str) -> str:
    """Versioned scrypt parameters with a fresh 128-bit salt for every account."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, maxmem=67108864)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, n, r, p, salt_hex, digest_hex = encoded.split("$")
        if (scheme, n, r, p) != ("scrypt", str(_SCRYPT_N), str(_SCRYPT_R), str(_SCRYPT_P)):
            return False
        salt, expected = bytes.fromhex(salt_hex), bytes.fromhex(digest_hex)
        if len(salt) < 16 or len(expected) != 64:
            return False
        actual = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, maxmem=67108864)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, UnicodeError):
        return False


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    return hash_password(secrets.token_urlsafe(32))


def authenticate(db: Session, email: str, password: str) -> User:
    dummy_hash = _dummy_password_hash()
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    valid = verify_password(password, user.password_hash if user and user.password_hash else dummy_hash)
    if not valid or user is None or not user.password_hash:
        raise AppError(401, "Email hoặc mật khẩu không đúng.", "invalid_credentials")
    return user


def _signature(token: str) -> str:
    key = get_settings().auth_secret_key.get_secret_value().encode()
    return hmac.new(key, token.encode(), hashlib.sha256).hexdigest()


def _token_hash(cookie: str | None) -> str | None:
    if not cookie or len(cookie) != 108:
        return None
    token, separator, signature = cookie.partition(".")
    if len(signature) != 64 or any(c not in "0123456789abcdef" for c in signature):
        return None
    if not separator or len(token) != 43 or not all(c.isascii() and (c.isalnum() or c in "-_") for c in token):
        return None
    if not hmac.compare_digest(signature, _signature(token)):
        return None
    return hashlib.sha256(token.encode()).hexdigest()


def revoke_session(db: Session, cookie: str | None) -> None:
    digest = _token_hash(cookie)
    if digest:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest))


def issue_session(db: Session, user: User, previous_cookie: str | None = None) -> str:
    revoke_session(db, previous_cookie)
    db.execute(delete(AuthSession).where(AuthSession.expires_at <= utcnow()))
    token = secrets.token_urlsafe(32)
    db.add(
        AuthSession(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user.id,
            expires_at=utcnow() + timedelta(seconds=get_settings().auth_session_ttl_seconds),
        )
    )
    db.commit()
    return f"{token}.{_signature(token)}"


def session_user(db: Session, cookie: str | None) -> User:
    digest = _token_hash(cookie)
    session = db.get(AuthSession, digest) if digest else None
    user = db.get(User, session.user_id) if session and session.expires_at > utcnow() else None
    if user is None:
        raise AppError(401, "Bạn chưa đăng nhập hoặc phiên đã hết hạn.", "unauthenticated")
    return user
