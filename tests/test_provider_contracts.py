"""Section 11 contracts: protocol fixtures in CI, opt-in real API probes.

Fixtures are synthetic, provider-shaped protocol examples, not model evaluations.
Operation recovery and router fallback integration ship in M2/M3, not T1.5.
"""

import copy
import json
import os
import sqlite3

import pytest
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

from src.services.providers.gateway import GatewayError, GatewayTimeoutError, provider_scope
from src.services.providers.llm_client import Done, LlmClient, LlmProviderError
from tests.test_llm_client import FIXTURES, USER, completion, record, settings

TOOL = {
    "type": "function",
    "function": {
        "name": "get_stage",
        "description": "Read the requested stage and return its number.",
        "parameters": {"type": "object", "properties": {"stage": {"type": "integer"}}, "required": ["stage"]},
    },
}


@pytest.fixture(
    params=[
        "recorded",
        pytest.param("live", marks=pytest.mark.provider_live),
    ]
)
def mode(request):
    if request.param == "live" and os.getenv("RUN_PROVIDER_LIVE") != "1":
        pytest.skip("Set RUN_PROVIDER_LIVE=1 for paid nightly probes")
    if request.param == "live" and not os.getenv("LLM_API_KEY"):
        pytest.fail("Nightly contracts require LLM_API_KEY")
    return request.param


def client_for(mode, fixture):
    return LlmClient(settings=settings(llm_timeout_s=120), recorded=FIXTURES / fixture if mode == "recorded" else None)


def resolve(message, log):
    log.append(message)
    for call in message.get("tool_calls", []):
        args = LlmClient.parse_tool_arguments(message)[call["id"]]
        log.append(
            {"role": "tool", "tool_call_id": call["id"], "content": json.dumps({"stage": args["stage"], "ok": True})}
        )


@pytest.mark.asyncio
async def test_1_three_step_thinking_tool_chain_verbatim(mode):
    client = client_for(mode, "three_step.json")
    log = [
        {
            "role": "user",
            "content": "Call get_stage with stage 1, then stage 2, then stage 3 in separate requests. After stage 3 reply Complete. Do not skip any tool.",
        }
    ]
    saved = []
    try:
        for _ in range(3):
            message = await client.chat(log, tools=[TOOL], thinking=True)
            assert message.get("reasoning_content") is not None
            assert len(message.get("tool_calls", [])) == 1
            saved.append(copy.deepcopy(message))
            resolve(message, log)
        final = await client.chat(log, tools=[TOOL], thinking=True)
        assert not final.get("tool_calls")
        if mode == "recorded":
            client.assert_recording_consumed()
            replay = [message for message in client.recorded_requests[-1]["messages"] if message["role"] == "assistant"]
            assert replay == saved
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_2_non_tool_then_tool_turn_replays_reasoning(mode):
    client = client_for(mode, "non_tool_then_tool.json")
    log = [{"role": "user", "content": "Say Ready. Do not call tools yet."}]
    try:
        plain = await client.chat(log, tools=[TOOL], thinking=True)
        assert not plain.get("tool_calls") and "reasoning_content" in plain
        log.extend([plain, {"role": "user", "content": "Now call get_stage with stage 1."}])
        message = await client.chat(log, tools=[TOOL], thinking=True)
        assert message.get("tool_calls")
        resolve(message, log)
        await client.chat(log, tools=[TOOL], thinking=True)
        if mode == "recorded":
            client.assert_recording_consumed()
            assert client.recorded_requests[-1]["messages"][1] == plain
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_contract_2_non_thinking_three_step_tool_loop(mode):
    """Section 11 contract 2: non-thinking agent tool calls work over three steps."""
    client = client_for(mode, "three_step.json")
    log = [
        {
            "role": "user",
            "content": "Call get_stage with stage 1, then 2, then 3 in separate requests, then say Complete.",
        }
    ]
    try:
        with provider_scope(mask_only=True):
            for _ in range(3):
                message = await client.chat(log, tools=[TOOL], thinking=False, temperature=0)
                assert message.get("tool_calls") and not message.get("reasoning_content")
                resolve(message, log)
            final = await client.chat(log, tools=[TOOL], thinking=False, temperature=0)
        assert final.get("content") == "Complete" and not final.get("tool_calls")
        if mode == "recorded":
            assert len(client.recorded_requests) == 4
            assert all(request["thinking"] == {"type": "disabled"} for request in client.recorded_requests)
            assert all(request["temperature"] == 0 for request in client.recorded_requests)
            client.assert_recording_consumed()
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_3_missing_reasoning_returns_400_without_retry(mode, tmp_path):
    if mode == "recorded":
        message = json.loads((FIXTURES / "three_step.json").read_text())["exchanges"][0]["response"]["choices"][0][
            "message"
        ]
    else:
        initial = client_for(mode, "three_step.json")
        try:
            message = await initial.chat(
                [{"role": "user", "content": "Call get_stage with stage 1 now."}], tools=[TOOL], thinking=True
            )
            assert message.get("tool_calls")
        finally:
            await initial.aclose()
    log = copy.deepcopy(USER)
    resolve(message, log)
    del log[1]["reasoning_content"]
    client = client_for(mode, "missing_reasoning.json")
    try:
        try:
            await client.chat(log, tools=[TOOL], thinking=True)
        except LlmProviderError as error:
            assert error.status_code == 400 and error.reasoning_contract
        else:
            if mode == "live":
                pytest.skip("Provider relaxed reasoning replay enforcement; review the contract")
            pytest.fail("Recorded provider must reject missing reasoning")
        if mode == "recorded":
            assert len(client.recorded_requests) == 1
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_4_stream_and_non_stream_persist_identical_messages(mode, tmp_path):
    # Two independent live generations need not have identical reasoning. Capture
    # one stream and replay that SAME message through non-stream SDK decoding.
    client = client_for(mode, "parity.json")
    try:
        if mode == "recorded":
            expected = await client.chat(USER, tools=[TOOL])
        events = [event async for event in client.chat_stream(USER, tools=[TOOL])]
        assert isinstance(events[-1], Done)
        actual = events[-1].message
        if mode == "live":
            replay = LlmClient(settings=settings(), recorded=record(tmp_path, [{"response": completion(actual)}]))
            try:
                expected = await replay.chat(USER)
            finally:
                await replay.aclose()
        assert actual == expected
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_5_checkpoint_serializer_sqlite_roundtrip_preserves_reasoning(mode, tmp_path):
    client = client_for(mode, "parity.json")
    try:
        message = await client.chat(USER, thinking=True)
        assert "reasoning_content" in message
        serde = JsonPlusSerializer()
        kind, data = serde.dumps_typed({"agent_messages": [message]})
        with sqlite3.connect(tmp_path / "checkpoint.db") as db:
            db.execute("CREATE TABLE checkpoint (kind TEXT, payload BLOB)")
            db.execute("INSERT INTO checkpoint VALUES (?, ?)", (kind, data))
            db.commit()
        with sqlite3.connect(tmp_path / "checkpoint.db") as db:
            restored = serde.loads_typed(db.execute("SELECT kind, payload FROM checkpoint").fetchone())
        assert restored == {"agent_messages": [message]}
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_6_dangling_call_blocks_until_real_result_appended(mode):
    client = client_for(mode, "non_tool_then_tool.json")
    log = copy.deepcopy(USER)
    try:
        if mode == "recorded":
            await client.chat(log, tools=[TOOL])
        message = await client.chat(
            [{"role": "user", "content": "Call get_stage with stage 1."}], tools=[TOOL], thinking=True
        )
        assert message.get("tool_calls")
        with pytest.raises(GatewayError, match="Reconcile dangling"):
            await client.chat([*log, message], tools=[TOOL])
        resolve(message, log)
        await client.chat(log, tools=[TOOL], thinking=True)
        if mode == "recorded":
            assert len(client.recorded_requests) == 3
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_7_router_request_timeout_boundary(tmp_path):
    # Router implementation/fallback remains T2.1. Exercise its transport inputs.
    client = LlmClient(settings=settings(llm_timeout_s=0.1), recorded=FIXTURES / "router_timeout.json")
    try:
        with pytest.raises(GatewayTimeoutError):
            await client.chat(
                USER, thinking=False, model=client.settings.llm_model_router, temperature=0, max_tokens=150
            )
        request = client.recorded_requests[0]
        assert request["thinking"] == {"type": "disabled"}
        assert request["temperature"] == 0 and request["max_tokens"] == 150
    finally:
        await client.aclose()


@pytest.mark.skip(
    reason="M2/M3: real operation reconciliation, graph checkpointer, and router fallback are outside T1.5"
)
def test_contract_integration_gate_5_6_7():
    """Do not count transport stand-ins as the full section 11 integration gate."""
