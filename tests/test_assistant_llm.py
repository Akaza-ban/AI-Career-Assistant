import json

import pytest

from src.services.privacy.types import Identity, MaskingError
from src.services.providers.gateway import GatewayError, provider_scope
from src.services.providers.llm_client import ContentDelta, Done, LlmClient, ReasoningDelta, ToolCallDelta
from tests.test_llm_client import USER, chunk, completion, record, settings


@pytest.mark.asyncio
async def test_assistant_stream_neutralizes_split_placeholders_and_identifiers(tmp_path) -> None:
    client = LlmClient(
        settings=settings(llm_thinking_agent="enabled"),
        recorded=record(
            tmp_path,
            [
                {
                    "chunks": [
                        chunk({"role": "assistant", "reasoning_content": "private reasoning"}),
                        chunk({"content": "Hello ["}),
                        chunk({"content": "[arbitrary]] an@"}),
                        chunk({"content": "example.test"}),
                        chunk({}, "stop"),
                        chunk({}, usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}),
                    ]
                }
            ],
        ),
    )
    try:
        with provider_scope(mask_only=True):
            events = [event async for event in client.chat_stream(USER)]
        assert isinstance(events[-1], Done)
        text = "".join(event.text for event in events if isinstance(event, ContentDelta))
        assert text == events[-1].message["content"] == "Hello bạn bạn"
        assert not any(isinstance(event, ReasoningDelta) for event in events)
        assert "reasoning_content" not in events[-1].message
        assert client.recorded_requests[0]["thinking"] == {"type": "disabled"}
        assert client.recorded_requests[0]["temperature"] == 0
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_assistant_rejects_explicit_thinking_before_dispatch(tmp_path) -> None:
    client = LlmClient(settings=settings(), recorded=record(tmp_path, []))
    try:
        with provider_scope(mask_only=True), pytest.raises(GatewayError, match="Thinking mode"):
            await client.chat(USER, thinking=True)
        assert client.recorded_requests == []
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_assistant_stream_accumulates_interleaved_tools_without_leaking_arguments(tmp_path) -> None:
    chunks = [
        chunk(
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": "call-1",
                        "type": "function",
                        "function": {"name": "lookup", "arguments": '{"label":"Nguyễn '},
                    }
                ],
            }
        )
    ]
    chunks += [chunk({"tool_calls": [{"index": 0, "function": {"arguments": 'Minh An"}'}}]}), chunk({}, "tool_calls")]
    client = LlmClient(settings=settings(), recorded=record(tmp_path, [{"chunks": chunks}]))
    try:
        with provider_scope(mask_only=True, identities=(Identity(name="Nguyễn Minh An"),)):
            events = [event async for event in client.chat_stream(USER)]
        tool = next(event for event in events if isinstance(event, ToolCallDelta))
        assert json.loads(tool.arguments) == {"label": "bạn"}
        assert client.parse_tool_arguments(events[-1].message) == {"call-1": {"label": "bạn"}}
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_assistant_stream_nonstream_safe_output_parity(tmp_path) -> None:
    response = {"role": "assistant", "content": "Hello [[opaque]]"}
    client = LlmClient(
        settings=settings(),
        recorded=record(
            tmp_path,
            [
                {"response": completion(response)},
                {"chunks": [chunk(response), chunk({}, "stop")]},
            ],
        ),
    )
    try:
        with provider_scope(mask_only=True):
            plain = await client.chat(USER)
            events = [event async for event in client.chat_stream(USER)]
        assert plain == events[-1].message == {"role": "assistant", "content": "Hello bạn"}
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_assistant_health_uses_raw_client_and_shared_privacy_scope(tmp_path, monkeypatch) -> None:
    from src.services import llm
    from src.services.providers import gateway

    config = settings(llm_api_key="recorded-test-key", llm_base_url="https://api.deepseek.com")
    client = LlmClient(
        settings=config,
        recorded=record(tmp_path, [{"response": completion({"role": "assistant", "content": "Ready"})}]),
    )
    monkeypatch.setattr(llm, "get_settings", lambda: config)
    monkeypatch.setattr(llm, "LlmClient", lambda **kwargs: client)
    monkeypatch.setattr(llm, "_llm_health_cache", None)
    with provider_scope(mask_only=True):
        status = await llm.check_llm_health(assistant=True)
    assert status["is_live"] is True and status["provider"] == "deepseek"
    assert client.recorded_requests[0]["thinking"] == {"type": "disabled"}
    assert gateway._scope.get() is None


@pytest.mark.asyncio
async def test_provider_failure_discards_exception_context(tmp_path) -> None:
    from src.services.providers.llm_client import LlmProviderError

    client = LlmClient(
        settings=settings(),
        recorded=record(tmp_path, [{"status": 400, "response": {"error": {"message": "private@example.test"}}}]),
    )
    try:
        with provider_scope(mask_only=True), pytest.raises(LlmProviderError) as error:
            await client.chat(USER)
        assert error.value.__context__ is None
        assert "private@example.test" not in str(error.value)
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_client_settings_cannot_disable_masking_and_dispatch(tmp_path) -> None:
    client = LlmClient(settings=settings(pii_masking_enabled=False), recorded=record(tmp_path, []))
    try:
        with provider_scope(mask_only=True), pytest.raises(MaskingError):
            await client.chat(USER)
        assert client.recorded_requests == []
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_raw_tool_results_escape_literal_double_brackets(tmp_path) -> None:
    client = LlmClient(
        settings=settings(),
        recorded=record(tmp_path, [{"response": completion({"role": "assistant", "content": "Ready"})}]),
    )
    try:
        log = [
            *USER,
            {
                "role": "assistant",
                "tool_calls": [{"id": "call-1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}],
            },
            {"role": "tool", "tool_call_id": "call-1", "content": "CV [[forged]].pdf"},
        ]
        with provider_scope(mask_only=True):
            await client.chat(log)
        wire = client.recorded_requests[0]["messages"][-1]["content"]
        assert "[[forged]]" not in wire and "&#91;&#91;forged]]" in wire
    finally:
        await client.aclose()
