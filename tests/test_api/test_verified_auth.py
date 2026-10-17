"""HTTP-level identity regression tests; no authentication dependency overrides."""

from datetime import timedelta
from hashlib import sha256
from uuid import uuid4

import pytest
from pydantic import ValidationError

from src.config import Settings, get_settings
from src.db.database import SessionLocal
from src.db.models import AuthSession, User, utcnow
from src.services.auth import hash_password, verify_password


@pytest.mark.asyncio
@pytest.mark.parametrize("role", [None, "student", "advisor", "admin"])
async def test_header_cannot_authenticate(client, role):
    headers = {} if role is None else {"X-Demo-Role": role}
    response = await client.get("/api/v1/me", headers=headers)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_ignores_role_header_and_logout_revokes_cookie(client):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "minhanh.k21@student.university.edu.vn", "password": "Student-A-dev-only!"},
        headers={"X-Demo-Role": "advisor"},
    )
    assert response.status_code == 200
    assert response.json()["id"] == "sv-0142"
    assert "password_hash" not in response.json()
    cookie = response.headers["set-cookie"]
    assert "httponly" in cookie.lower()
    assert "samesite=lax" in cookie.lower()
    assert (await client.get("/api/v1/me", headers={"X-Demo-Role": "advisor"})).json()["role"] == "student"
    replay = {"Cookie": cookie.split(";", 1)[0]}
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    assert (await client.get("/api/v1/me", headers=replay)).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("email", ["missing@example.test", "minhanh.k21@student.university.edu.vn"])
async def test_wrong_credentials_are_unauthenticated(client, email):
    response = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong"})
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def credential_login(client):
    client.cookies.clear()
    response = await client.post(
        "/api/v1/auth/login", json={"email": "minhanh.k21@student.university.edu.vn", "password": "Student-A-dev-only!"}
    )
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].split(";", 1)[0]
    client.cookies.clear()
    return cookie


@pytest.mark.asyncio
async def test_expired_session_and_tampered_cookie_are_rejected(client):
    cookie = await credential_login(client)
    tampered = cookie[:-1] + ("0" if cookie[-1] != "0" else "1")
    assert (await client.get("/api/v1/me", headers={"Cookie": tampered})).status_code == 401
    token = cookie.split("=", 1)[1].split(".", 1)[0]
    with SessionLocal() as db:
        session = db.get(AuthSession, sha256(token.encode()).hexdigest())
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert (await client.get("/api/v1/me", headers={"Cookie": cookie})).status_code == 401


@pytest.mark.asyncio
async def test_login_rotates_existing_session(client):
    old_cookie = await credential_login(client)
    response = await client.post(
        "/api/v1/auth/login",
        headers={"Cookie": old_cookie},
        json={"email": "minhanh.k21@student.university.edu.vn", "password": "Student-A-dev-only!"},
    )
    assert response.status_code == 200
    assert response.headers["set-cookie"].split(";", 1)[0] != old_cookie
    assert (await client.get("/api/v1/me", headers={"Cookie": old_cookie})).status_code == 401


@pytest.mark.asyncio
async def test_role_is_reloaded_from_database(client):
    cookie = await credential_login(client)
    try:
        with SessionLocal() as db:
            db.get(User, "sv-0142").role = "advisor"
            db.commit()
        response = await client.get("/api/v1/me", headers={"Cookie": cookie, "X-Demo-Role": "student"})
        assert response.status_code == 200
        assert response.json()["role"] == "advisor"
    finally:
        with SessionLocal() as db:
            db.get(User, "sv-0142").role = "student"
            db.commit()


@pytest.mark.asyncio
async def test_account_without_password_or_deleted_account_cannot_authenticate(client):
    user_id = uuid4().hex
    email = f"{user_id}@example.test"
    with SessionLocal() as db:
        db.add(User(id=user_id, email=email, role="student", full_name="Individual"))
        db.commit()
    body = {"email": email, "password": "Isolation-dev-only!"}
    assert (await client.post("/api/v1/auth/login", json=body)).status_code == 401
    with SessionLocal() as db:
        db.get(User, user_id).password_hash = hash_password(body["password"])
        db.commit()
    assert (await client.post("/api/v1/auth/login", json=body)).status_code == 200
    with SessionLocal() as db:
        db.delete(db.get(User, user_id))
        db.commit()
    assert (await client.get("/api/v1/me")).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "headers", [{"Origin": "https://evil.example"}, {"Origin": "null"}, {"Sec-Fetch-Site": "cross-site"}]
)
@pytest.mark.parametrize("path", ["/auth/login", "/auth/logout", "/cv/upload"])
async def test_untrusted_browser_mutations_are_blocked(client, path, headers):
    response = await client.post(f"/api/v1{path}", headers=headers)
    assert response.status_code == 403
    assert response.json()["code"] == "untrusted_origin"


@pytest.mark.asyncio
async def test_trusted_browser_login_and_production_secure_cookie(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    response = await client.post(
        "/api/v1/auth/login",
        headers={"Origin": "http://localhost:3000"},
        json={"email": "minhanh.k21@student.university.edu.vn", "password": "Student-A-dev-only!"},
    )
    assert response.status_code == 200
    assert "secure" in response.headers["set-cookie"].lower()
    assert response.headers["cache-control"] == "no-store"


def test_password_hashes_are_salted_and_invalid_hashes_fail_closed():
    first, second = hash_password("Test-dev-only!"), hash_password("Test-dev-only!")
    assert first != second
    assert verify_password("Test-dev-only!", first)
    assert not verify_password("wrong", first)
    assert not verify_password("Test-dev-only!", "plaintext")
    assert not verify_password("Test-dev-only!", first.replace("32768", "999999999"))


def test_production_requires_explicit_strong_key():
    with pytest.raises(ValidationError, match="AUTH_SECRET_KEY"):
        Settings(_env_file=None, app_env="production", auth_secret_key="")
    with pytest.raises(ValidationError, match="AUTH_SECRET_KEY"):
        Settings(_env_file=None, app_env="production", auth_secret_key="short")
    assert Settings(_env_file=None, app_env="production", auth_secret_key="x" * 32).app_env == "production"
