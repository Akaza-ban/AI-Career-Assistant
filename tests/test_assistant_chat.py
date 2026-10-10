"""Small-talk, accidental retrieval matches and cached LLM connectivity regressions."""

import asyncio
import unicodedata
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from src.main import app
from src.models.assistant import ClientPageContext
from src.services import llm as llm_service
from src.services.assistant.agent import AssistantAgent, get_assistant_agent
from src.services.assistant.guardrails import is_chitchat
from src.services.assistant.hybrid_search import AssistantHybridRetriever
from tests.helpers import ADVISOR, STUDENT

SMALL_TALK = [
    "hôm nay bạn cảm thấy thế nào?",
    "chào bạn",
    "Xin chào!",
    "bạn là ai",
    "bạn tên gì?",
    "hôm nay thế nào",
    "cảm thấy thế nào",
    "bạn khỏe không",
    "cảm ơn bạn",
    "tạm biệt",
    "hello",
    "hi",
    "CHAO BAN OI!",
    "Xin chào bạn ạ! Bạn là ai?",
    unicodedata.normalize("NFD", "Hôm nay bạn cảm thấy thế nào?"),
]


@pytest.fixture
def chat_agent() -> Iterator[tuple[AssistantAgent, MagicMock, MagicMock]]:
    retriever = MagicMock()
    # Reproduce the irrelevant FAQ that previously leaked into greetings.
    retriever.search.return_value = [
        {
            "chunk_id": "history-faq",
            "role": "student",
            "route": "/student/history",
            "title": "Lịch sử",
            "section": "FAQ",
            "score": 0.99,
            "content": "Q: Vì sao tôi chưa thấy mức tăng điểm? A: Xem lịch sử các phiên.",
        }
    ]
    llm = MagicMock()
    agent = AssistantAgent(retriever, llm)
    app.dependency_overrides[get_assistant_agent] = lambda: agent
    try:
        yield agent, retriever, llm
    finally:
        app.dependency_overrides.pop(get_assistant_agent, None)


@pytest.mark.asyncio
@pytest.mark.parametrize("message", SMALL_TALK)
@pytest.mark.parametrize("role", ["student", "advisor"])
async def test_chat_chitchat_never_retrieves_or_generates_citations(
    client: AsyncClient,
    chat_agent: tuple[AssistantAgent, MagicMock, MagicMock],
    message: str,
    role: str,
) -> None:
    _, retriever, llm = chat_agent
    route = "/student/cv" if role == "student" else "/advisor/dashboard"
    response = await client.post(
        "/api/v1/assistant/chat",
        headers=STUDENT if role == "student" else ADVISOR,
        json={"message": message, "context": {"current_url": route, "route": route, "user_role": role}},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert "CareerX" in body["message"]
    assert "Theo tài liệu" not in body["message"] and "FAQ" not in body["message"]
    assert body["sources"] == [] and body["actions"] == []
    retriever.search.assert_not_called()
    llm.with_structured_output.assert_not_called()


@pytest.mark.parametrize(
    "message",
    [
        "Chào bạn, làm sao tải CV?",
        "Hi, mở trang lịch sử",
        "Cảm ơn bạn, cách tính điểm STAR thế nào?",
        "Bạn thấy điểm CV như thế nào?",
        "highlight",
        "this",
        "Xin chào, thời tiết thế nào?",
    ],
)
def test_small_talk_does_not_swallow_other_requests(message: str) -> None:
    assert is_chitchat(message) == (False, "")


@pytest.mark.asyncio
async def test_greeting_with_cv_question_still_retrieves(
    chat_agent: tuple[AssistantAgent, MagicMock, MagicMock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    agent, retriever, _ = chat_agent
    monkeypatch.setattr(agent, "_llm", None)
    context = ClientPageContext(current_url="/student/cv", route="/student/cv", user_role="student")
    await agent.respond("Chào bạn, làm sao tải CV?", context)
    retriever.search.assert_called_once()


@pytest.mark.parametrize("query", ["thấy", "cảm thấy", "vui buồn", "chào bạn", "tăng", "hom nay thay"])
def test_single_generic_match_cannot_become_citation(query: str) -> None:
    retriever = object.__new__(AssistantHybridRetriever)
    retriever.vector_store = MagicMock()
    retriever.chunks = []
    retriever._indexes = {}
    retriever.vector_store.search_vector.return_value = [
        {
            "chunk_id": "faq",
            "content": "Vì sao tôi chưa thấy mức tăng điểm?",
            "title": "Lịch sử",
            "section": "FAQ",
            "tags": [],
            "role": "student",
            "route": "/student/history",
            "distance": 0.0,
        }
    ]
    assert retriever.search(query, "student", route="/student/history") == []


@pytest.mark.asyncio
async def test_generic_query_cannot_echo_even_high_scoring_irrelevant_faq(
    chat_agent: tuple[AssistantAgent, MagicMock, MagicMock],
) -> None:
    agent, _, llm = chat_agent
    context = ClientPageContext(current_url="/student/cv", route="/student/cv", user_role="student")
    response = await agent.respond("Vì sao tôi cảm thấy mức tăng cảm xúc?", context)
    assert "chưa tìm thấy tài liệu phù hợp" in response.message
    assert response.sources == [] and response.actions == []
    llm.with_structured_output.assert_not_called()


@pytest.fixture
def health_model(monkeypatch: pytest.MonkeyPatch) -> tuple[SimpleNamespace, AsyncMock]:
    model = AsyncMock()
    settings = SimpleNamespace(
        llm_provider="groq",
        model_name="test-model",
        get_llm_credentials=MagicMock(return_value=("test-key", "https://api.groq.com/openai/v1")),
        get_chat_model=MagicMock(return_value=model),
    )
    monkeypatch.setattr(llm_service, "get_settings", lambda: settings)
    monkeypatch.setattr(llm_service, "_llm_health_cache", None)
    monkeypatch.setattr(llm_service, "_llm_health_lock", asyncio.Lock())
    return settings, model


@pytest.mark.asyncio
@pytest.mark.parametrize("key", ["", "your-key", "gsk_your_key", "sk-dummy-key-for-init", " YOUR_API_KEY "])
async def test_unconfigured_health_is_offline_without_ping(
    health_model: tuple[SimpleNamespace, AsyncMock],
    key: str,
) -> None:
    settings, model = health_model
    settings.get_llm_credentials.return_value = (key, "https://api.groq.com/openai/v1")
    status = await llm_service.check_llm_health()
    assert status["status"] == "offline" and status["is_live"] is False
    assert status["provider"] == "none" and status["message"]
    model.ainvoke.assert_not_called()
    settings.get_chat_model.assert_not_called()


@pytest.mark.asyncio
async def test_successful_health_ping_is_live_and_cached(health_model: tuple[SimpleNamespace, AsyncMock]) -> None:
    settings, model = health_model
    first = await llm_service.check_llm_health()
    assert first == {"status": "live", "is_live": True, "provider": "groq", "model": "test-model", "message": ""}
    first["is_live"] = False
    assert (await llm_service.check_llm_health())["is_live"] is True
    model.ainvoke.assert_awaited_once()
    assert model.ainvoke.call_args.args[0][0].content == "ping"
    settings.get_chat_model.assert_called_once_with(timeout=3.0, max_retries=0, max_tokens=8)


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [RuntimeError("quota exhausted test-key"), TimeoutError("timeout")])
async def test_failed_health_is_offline_sanitized_and_cached(
    health_model: tuple[SimpleNamespace, AsyncMock],
    error: Exception,
) -> None:
    _, model = health_model
    model.ainvoke.side_effect = error
    status = await llm_service.check_llm_health()
    assert status["status"] == "offline" and status["is_live"] is False
    assert status["message"] and "test-key" not in status["message"]
    assert await llm_service.check_llm_health() == status
    model.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
async def test_health_really_times_out(
    health_model: tuple[SimpleNamespace, AsyncMock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, model = health_model

    async def stalled(*args: Any, **kwargs: Any) -> None:
        await asyncio.Event().wait()

    model.ainvoke.side_effect = stalled
    monkeypatch.setattr(llm_service, "LLM_HEALTH_TIMEOUT_SECONDS", 0.01)
    status = await llm_service.check_llm_health()
    assert status["is_live"] is False and "3 giây" in status["message"]


@pytest.mark.asyncio
async def test_health_cache_expires_and_recovers(
    health_model: tuple[SimpleNamespace, AsyncMock],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _, model = health_model
    time = [100.0]
    monkeypatch.setattr(llm_service, "monotonic", lambda: time[0])
    model.ainvoke.side_effect = RuntimeError("network down")
    assert (await llm_service.check_llm_health())["is_live"] is False
    model.ainvoke.side_effect = None
    time[0] += 29
    assert (await llm_service.check_llm_health())["is_live"] is False
    time[0] += 1
    assert (await llm_service.check_llm_health())["is_live"] is True
    assert model.ainvoke.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("changed", ["model", "credentials", "endpoint"])
async def test_health_cache_is_invalidated_by_configuration(
    health_model: tuple[SimpleNamespace, AsyncMock],
    changed: str,
) -> None:
    settings, model = health_model
    await llm_service.check_llm_health()
    if changed == "model":
        settings.model_name = "new-model"
    else:
        settings.get_llm_credentials.return_value = (
            "new-key" if changed == "credentials" else "test-key",
            "https://openrouter.ai/api/v1",
        )
    status = await llm_service.check_llm_health()
    assert model.ainvoke.await_count == 2
    assert status["model"] == settings.model_name
    if changed != "model":
        assert status["provider"] == "openrouter"


@pytest.mark.asyncio
async def test_concurrent_health_checks_share_one_ping(health_model: tuple[SimpleNamespace, AsyncMock]) -> None:
    _, model = health_model

    async def ping(*args: Any, **kwargs: Any) -> str:
        await asyncio.sleep(0)
        return "pong"

    model.ainvoke.side_effect = ping
    results = await asyncio.gather(*(llm_service.check_llm_health() for _ in range(8)))
    assert all(result["is_live"] for result in results)
    model.ainvoke.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("live", [True, False])
async def test_status_endpoint_returns_live_or_offline(
    client: AsyncClient,
    health_model: tuple[SimpleNamespace, AsyncMock],
    live: bool,
) -> None:
    _, model = health_model
    if not live:
        model.ainvoke.side_effect = RuntimeError("unavailable")
    response = await client.get("/api/v1/assistant/status", headers=STUDENT)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_live"] is live
    assert body["status"] == ("live" if live else "offline")
    assert body["provider"] == "groq" and body["model"] == "test-model"


@pytest.mark.asyncio
async def test_status_endpoint_requires_auth(
    client: AsyncClient, health_model: tuple[SimpleNamespace, AsyncMock]
) -> None:
    response = await client.get("/api/v1/assistant/status")
    assert response.status_code == 401
    health_model[1].ainvoke.assert_not_called()
