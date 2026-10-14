import asyncio
import json
from pathlib import Path

import httpx
import pytest

from src.config import Settings, get_settings
from src.services.privacy import ner
from src.services.privacy.detectors import Detector
from src.services.privacy.types import Identity, MaskingError
from src.services.providers import gateway
from src.services.providers.llm_client import (
    ContentDelta,
    Done,
    LlmClient,
    LlmProviderError,
    ReasoningDelta,
    ToolCallDelta,
)
from tests.test_privacy_detectors import EmptyNer
from tests.test_provider_gateway import usage_after, usage_ids

FIXTURES = Path(__file__).parent / "fixtures" / "providers"
USER = [{"role": "user", "content": "Check the next stage."}]


@pytest.fixture(autouse=True)
def local_detector(monkeypatch):
    monkeypatch.setattr(ner, "_detector", Detector(EmptyNer()))


def settings(**values):
    defaults = {"app_env": "test", "llm_max_retries": 0}
    defaults.update(values)
    return Settings(_env_file=None, **defaults)


def record(tmp_path, exchanges):
    path = tmp_path / "recorded.json"
    path.write_text(json.dumps({"exchanges": exchanges}), encoding="utf-8")
    return path


def completion(message):
    return {
        "id": "recorded-completion",
        "object": "chat.completion",
        "created": 0,
        "model": "deepseek-flash",
        "choices": [{"index": 0, "message": message, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120},
    }


def chunk(delta, finish=None, usage=None):
    return {
        "id": "recorded-completion",
        "object": "chat.completion.chunk",
        "created": 0,
        "model": "deepseek-flash",
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}] if delta or finish else [],
        "usage": usage,
    }


@pytest.mark.asyncio
async def test_verbatim_thinking_and_non_thinking(tmp_path):
    message = {
        "role": "assistant",
        "content": "Ready",
        "reasoning_content": "Check stage",
        "provider_extension": {"a": 1},
    }
    client = LlmClient(
        settings=settings(llm_reasoning_effort="max"),
        recorded=record(
            tmp_path,
            [
                {"response": completion(message)},
                {"response": completion(message)},
            ],
        ),
    )
    try:
        assert await client.chat(USER, temperature=0.9) == message
        assert await client.chat(USER, thinking=False, model="router-model", temperature=0) == message
        first, second = client.recorded_requests
        assert first["thinking"] == {"type": "enabled"}
        assert first["reasoning_effort"] == "max" and "temperature" not in first
        assert second["thinking"] == {"type": "disabled"}
        assert second["model"] == "router-model" and second["temperature"] == 0
        assert "reasoning_effort" not in second
        client.assert_recording_consumed()
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_interleaved_tool_arguments_by_index_and_usage(tmp_path):
    before = usage_ids()
    chunks = [
        chunk({"role": "assistant", "reasoning_content": "Check "}),
        chunk({"reasoning_content": "stages", "content": "Working"}),
        chunk(
            {
                "tool_calls": [
                    {
                        "index": 1,
                        "id": "call-b",
                        "type": "function",
                        "function": {"name": "stage", "arguments": '{"value":'},
                    },
                    {
                        "index": 0,
                        "id": "call-a",
                        "type": "function",
                        "function": {"name": "stage", "arguments": '{"value":"'},
                    },
                ]
            }
        ),
        chunk(
            {
                "tool_calls": [
                    {"index": 0, "function": {"arguments": 'first"}'}},
                    {"index": 1, "function": {"arguments": "2}"}},
                ]
            }
        ),
        chunk({}, "tool_calls"),
        chunk({}, usage={"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}),
    ]
    client = LlmClient(settings=settings(), recorded=record(tmp_path, [{"chunks": chunks}]))
    try:
        events = [event async for event in client.chat_stream(USER)]
        assert [event.text for event in events if isinstance(event, ReasoningDelta)] == ["Check ", "stages"]
        assert [event.text for event in events if isinstance(event, ContentDelta)] == ["Working"]
        assert [event.index for event in events if isinstance(event, ToolCallDelta)] == [1, 0, 0, 1]
        assert isinstance(events[-1], Done)
        message = events[-1].message
        assert message["reasoning_content"] == "Check stages"
        assert LlmClient.parse_tool_arguments(message) == {"call-a": {"value": "first"}, "call-b": {"value": 2}}
        assert isinstance(message["tool_calls"][0]["function"]["arguments"], str)
        (row,) = usage_after(before)
        assert (row.status, row.input_tokens, row.output_tokens) == ("success", 100, 20)
        assert row.operation == "recorded_chat" and row.cost_known and row.cost_usd == 0
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_egress_full_payload_and_replayed_reasoning(tmp_path):
    client = LlmClient(settings=settings(), recorded=record(tmp_path, []))
    try:
        with gateway.provider_scope(identities=(Identity(name="Known Candidate"),)) as scope:
            for payload in (
                [{"role": "assistant", "content": "ok", "reasoning_content": "mail person@example.org"}],
                [{"role": "assistant", "content": "ok", "reasoning_content": "Known Candidate"}],
            ):
                with pytest.raises(MaskingError):
                    await client.chat(scope.prepared(payload))
            with pytest.raises(MaskingError):
                await client.chat(USER, tools=[{"person@example.org": "unsafe schema key"}])
        assert client.recorded_requests == []
        monkey = ner._detector
        ner._detector = None
        try:
            with pytest.raises(MaskingError):
                await client.chat(USER)
        finally:
            ner._detector = monkey
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_retry_each_physical_attempt_and_cost(tmp_path, monkeypatch):
    before = usage_ids()
    sleeps = []
    real_sleep = asyncio.sleep

    async def backoff(delay):
        sleeps.append(delay)
        await real_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", backoff)
    monkeypatch.setattr(get_settings(), "provider_input_usd_per_million", 2)
    monkeypatch.setattr(get_settings(), "provider_output_usd_per_million", 4)
    requests = []

    async def transport(request):
        requests.append(json.loads(request.content))
        if len(requests) == 1:
            return httpx.Response(429, json={"error": {"message": "unsafe person@example.org"}})
        return httpx.Response(200, json=completion({"role": "assistant", "content": "ok"}))

    client = LlmClient(
        settings=Settings(_env_file=None, llm_api_key="fake", llm_max_retries=2),
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(transport)),
    )
    try:
        assert await client.chat(USER) == {"role": "assistant", "content": "ok"}
        assert len(requests) == 2 and sleeps == [0.5]
        rows = usage_after(before)
        assert sorted(row.status for row in rows) == ["failed", "success"]
        row = next(row for row in rows if row.status == "success")
        assert row.usage_known and row.cost_known
        assert row.cost_usd == pytest.approx(0.00028)
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_reasoning_400_is_sanitized_and_never_retried(tmp_path):
    client = LlmClient(
        settings=Settings(_env_file=None, llm_max_retries=3),
        recorded=record(
            tmp_path,
            [
                {"status": 400, "response": {"error": {"message": "reasoning_content missing person@example.org"}}},
            ],
        ),
    )
    try:
        with pytest.raises(LlmProviderError) as error:
            await client.chat(USER)
        assert error.value.status_code == 400 and error.value.reasoning_contract
        assert "person@example.org" not in str(error.value)
        assert len(client.recorded_requests) == 1
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_timeout_has_safe_accounted_status(tmp_path):
    before = usage_ids()
    client = LlmClient(
        settings=settings(llm_timeout_s=0.1),
        recorded=record(tmp_path, [{"delay_s": 1, "response": completion({"role": "assistant", "content": "ok"})}]),
    )
    try:
        with pytest.raises(gateway.GatewayTimeoutError):
            await client.chat(USER, thinking=False)
        (row,) = usage_after(before)
        assert row.status == "timeout"
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_incomplete_stream_and_invalid_arguments_fail_safely(tmp_path):
    client = LlmClient(
        settings=settings(),
        recorded=record(tmp_path, [{"chunks": [chunk({"role": "assistant", "content": "partial"})]}]),
    )
    try:
        with pytest.raises(gateway.GatewayError, match="finish marker"):
            _ = [event async for event in client.chat_stream(USER)]
        with pytest.raises(gateway.GatewayError, match="Invalid tool arguments"):
            LlmClient.parse_tool_arguments({"tool_calls": [{"id": "x", "function": {"arguments": "[1]"}}]})
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_close_stream_accounts_cancellation(tmp_path):
    before = usage_ids()
    client = LlmClient(
        settings=settings(),
        recorded=record(
            tmp_path, [{"chunks": [chunk({"role": "assistant", "content": "partial"}), chunk({}, "stop")]}]
        ),
    )
    stream = client.chat_stream(USER)
    try:
        assert isinstance(await anext(stream), ContentDelta)
        await stream.aclose()
        (row,) = usage_after(before)
        assert row.status == "cancelled"
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_raw_literal_token_is_escaped_and_assistant_replay_is_verbatim(tmp_path):
    with gateway.provider_scope(identities=(Identity(email="person@example.org"),)) as scope:
        token = scope.mask_text("person@example.org")
        message = {"role": "assistant", "content": token, "reasoning_content": "Preserve the token."}
        original = [{"role": "user", "content": f"Literal {token}. Email person@example.org"}]
        client = LlmClient(
            settings=settings(),
            recorded=record(
                tmp_path,
                [
                    {"response": completion(message)},
                    {"response": completion({"role": "assistant", "content": "ok"})},
                ],
            ),
        )
        try:
            assert await client.chat(original) == message
            assert original[0]["content"] == f"Literal {token}. Email person@example.org"
            wire = client.recorded_requests[0]["messages"][0]["content"]
            assert "person@example.org" not in wire
            assert not wire.startswith(f"Literal {token}")
            await client.chat([*original, message, {"role": "user", "content": "Continue"}])
            assert client.recorded_requests[1]["messages"][1] == message
        finally:
            await client.aclose()
    assert gateway._scope.get() is None


@pytest.mark.asyncio
@pytest.mark.parametrize("emit_first", [False, True])
async def test_stream_transport_retry_stops_after_delivery(emit_first, monkeypatch):
    before = usage_ids()
    requests = []
    actual_sleep = asyncio.sleep

    async def fast_sleep(_):
        await actual_sleep(0)

    monkeypatch.setattr(asyncio, "sleep", fast_sleep)

    class BrokenStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            if emit_first:
                yield ("data: " + json.dumps(chunk({"role": "assistant", "content": "partial"})) + "\n\n").encode()
            raise httpx.ReadError("unsafe body person@example.org")

    async def transport(request):
        requests.append(request)
        if len(requests) == 1:
            return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=BrokenStream())
        body = "data: " + json.dumps(chunk({"role": "assistant", "content": "ok"})) + "\n\n"
        body += "data: " + json.dumps(chunk({}, "stop")) + "\n\ndata: [DONE]\n\n"
        return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})

    client = LlmClient(
        settings=Settings(_env_file=None, llm_api_key="fake", llm_max_retries=1),
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(transport)),
    )
    try:
        if emit_first:
            with pytest.raises(LlmProviderError) as error:
                _ = [event async for event in client.chat_stream(USER)]
            assert "person@example.org" not in str(error.value)
            assert len(requests) == 1
        else:
            events = [event async for event in client.chat_stream(USER)]
            assert events[-1].message == {"role": "assistant", "content": "ok"}
            assert len(requests) == 2
        assert len(usage_after(before)) == len(requests)
    finally:
        await client.aclose()
