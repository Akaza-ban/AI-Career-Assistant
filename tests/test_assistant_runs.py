"""Assistant HTTP isolation and lifecycle tests using real login sessions."""

import asyncio
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from src.db.database import SessionLocal
from src.db.models import AssistantConversation, AssistantRun, AssistantTurn, User
from src.main import app
from src.models.assistant import AssistantResponse
from src.services.assistant.agent import get_assistant_agent
from tests.test_api.test_cross_user_isolation import isolation_password_hash, login


@pytest_asyncio.fixture
async def assistant_accounts() -> AsyncIterator[tuple[AsyncClient, dict[str, dict[str, str]], dict[str, str]]]:
    ids = {key: uuid4().hex for key in ("a", "b")}
    with SessionLocal() as db:
        for key, user_id in ids.items():
            db.add(
                User(
                    id=user_id,
                    email=f"{user_id}@example.test",
                    full_name=f"Student {key}",
                    role="student",
                    password_hash=isolation_password_hash(),
                )
            )
        db.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {key: await login(client, f"{user_id}@example.test") for key, user_id in ids.items()}
        yield client, headers, ids


@pytest.fixture
def assistant_stub():
    class Agent:
        async def respond(self, *args, **kwargs):
            return AssistantResponse(message="Hello", intent="qa")

    agent = Agent()
    app.dependency_overrides[get_assistant_agent] = lambda: agent
    yield agent
    app.dependency_overrides.pop(get_assistant_agent, None)


def payload(conversation_id: str | None = None) -> dict:
    return {
        "message": "Hello",
        "conversation_id": conversation_id,
        "client_request_id": uuid4().hex,
        "context": {"current_url": "/student/cv", "route": "/student/cv", "user_role": "student"},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("cookie", [None, "invalid"])
async def test_assistant_rejects_demo_identity(assistant_accounts, assistant_stub, cookie):
    client, _, _ = assistant_accounts
    headers = {"X-Demo-Role": "student"}
    if cookie:
        from src.config import get_settings

        headers["Cookie"] = f"{get_settings().session_cookie_name}={cookie}"
    response = await client.post("/api/v1/assistant/chat", headers=headers, json=payload())
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_assistant_two_students_and_no_activity_write(assistant_accounts, assistant_stub):
    client, headers, ids = assistant_accounts
    for caller, other in (("a", "b"), ("b", "a")):
        with SessionLocal() as db:
            user = db.get(User, ids[caller])
            user.last_seen_at = None
            db.commit()
        response = await client.post(
            "/api/v1/assistant/chat", json=payload(), headers={**headers[caller], "X-Demo-Role": "advisor"}
        )
        assert response.status_code == 200, response.text
        body = response.json()
        with SessionLocal() as db:
            assert db.get(User, ids[caller]).last_seen_at is None
            assert db.get(AssistantConversation, body["conversation_id"]).user_id == ids[caller]
        foreign = await client.post(
            "/api/v1/assistant/chat", headers=headers[other], json=payload(body["conversation_id"])
        )
        missing = await client.post("/api/v1/assistant/chat", headers=headers[other], json=payload(uuid4().hex))
        assert foreign.status_code == missing.status_code == 404
        assert foreign.json() == missing.json()
        for method, path, data in (
            ("POST", "/feedback", {"rating": 1, "turn_id": body["turn_id"]}),
            ("DELETE", f"/feedback/{body['turn_id']}", None),
        ):
            denied = await client.request(method, f"/api/v1/assistant{path}", headers=headers[other], json=data)
            assert denied.status_code == 404
        with SessionLocal() as db:
            assert db.get(AssistantTurn, body["turn_id"]).assistant_message == "Hello"


@pytest.mark.asyncio
async def test_dedup_completed_and_first_message_without_conversation(assistant_accounts, assistant_stub):
    client, headers, _ = assistant_accounts
    body = payload()
    first = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)
    assert first.status_code == 200, first.text
    again = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)
    assert again.json()["id"] == first.json()["run_id"]
    assert again.json()["status"] == "done"
    body["conversation_id"] = first.json()["conversation_id"]
    assert (await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)).json() == again.json()
    with SessionLocal() as db:
        assert db.query(AssistantTurn).filter_by(run_id=first.json()["run_id"]).count() == 1


@pytest.mark.asyncio
async def test_running_duplicate_and_concurrent_guard_then_cancel(assistant_accounts, assistant_stub, monkeypatch):
    from src.services.assistant import runs

    client, headers, ids = assistant_accounts
    entered = asyncio.Event()
    cancelled = asyncio.Event()

    async def stalled(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    monkeypatch.setattr(assistant_stub, "respond", stalled)
    conversation_id = uuid4().hex
    with SessionLocal() as db:
        db.add(AssistantConversation(id=conversation_id, user_id=ids["a"], role="student"))
        db.commit()
    body = payload(conversation_id)
    first = asyncio.create_task(client.post("/api/v1/assistant/chat", headers=headers["a"], json=body))
    try:
        await asyncio.wait_for(entered.wait(), 5)
        again = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)
        assert again.status_code == 200 and again.json()["status"] == "running"
        conflict = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=payload(conversation_id))
        assert conflict.status_code == 409, conflict.text
        await runs.cancel(again.json()["id"])
        assert cancelled.is_set()
        result = await asyncio.wait_for(first, 5)
        assert result.json()["status"] == "cancelled"
        with SessionLocal() as db:
            run = db.get(AssistantRun, again.json()["id"])
            assert run.status == "cancelled"
            assert db.query(AssistantTurn).filter_by(run_id=run.id).one().interrupted
    finally:
        if not first.done():
            first.cancel()
            await asyncio.gather(first, return_exceptions=True)


@pytest.mark.asyncio
async def test_failure_is_persisted_and_sanitized(assistant_accounts, assistant_stub, monkeypatch):
    async def failing(*args, **kwargs):
        raise RuntimeError("upstream secret")

    monkeypatch.setattr(assistant_stub, "respond", failing)
    client, headers, _ = assistant_accounts
    body = payload()
    response = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)
    assert response.status_code == 503 and "upstream secret" not in response.text
    duplicate = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=body)
    assert duplicate.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_disconnect_cancels_upstream(assistant_accounts, assistant_stub, monkeypatch):
    from starlette.requests import Request

    entered = asyncio.Event()
    cancelled = asyncio.Event()

    async def stalled(*args, **kwargs):
        entered.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.set()

    async def disconnected(self):
        return entered.is_set()

    monkeypatch.setattr(assistant_stub, "respond", stalled)
    monkeypatch.setattr(Request, "is_disconnected", disconnected)
    client, headers, _ = assistant_accounts
    response = await client.post("/api/v1/assistant/chat", headers=headers["a"], json=payload())
    assert response.json()["status"] == "cancelled" and cancelled.is_set()


def test_startup_sweep_preserves_terminal_runs_and_text(assistant_accounts=None):
    from src.db.database import init_db

    user_id, conversation_id = uuid4().hex, uuid4().hex
    with SessionLocal() as db:
        db.add(User(id=user_id, email=f"{user_id}@example.test", full_name="Sweep", role="student"))
        db.add(AssistantConversation(id=conversation_id, user_id=user_id, role="student"))
        db.flush()
        for status in ("running", "done", "failed", "cancelled", "interrupted"):
            run_id = f"{conversation_id}-{status}"
            db.add(
                AssistantRun(
                    id=run_id,
                    conversation_id=conversation_id,
                    user_id=user_id,
                    client_request_id=status,
                    route="/student/cv",
                    status=status,
                )
            )
            db.add(
                AssistantTurn(
                    conversation_id=conversation_id,
                    run_id=run_id,
                    user_message="Hi",
                    assistant_message="partial",
                    intent="qa",
                )
            )
        db.commit()
    init_db()
    with SessionLocal() as db:
        for status in ("running", "done", "failed", "cancelled", "interrupted"):
            run = db.get(AssistantRun, f"{conversation_id}-{status}")
            assert run.status == ("interrupted" if status == "running" else status)
            turn = db.query(AssistantTurn).filter_by(run_id=run.id).one()
            assert turn.assistant_message == "partial"
            assert turn.interrupted == (status == "running")
