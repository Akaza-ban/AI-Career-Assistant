"""Rev 4.1 contracts (1), (4), (5), using offline provider-shaped recordings.

These fixtures test our transport contract, not live model quality.
"""

import asyncio

import pytest

from src.services.privacy.types import Identity, MaskingError
from src.services.providers.gateway import provider_scope
from src.services.providers.llm_client import ContentDelta, Done, LlmClient
from tests.test_llm_client import FIXTURES, USER, settings
from tests.test_provider_gateway import usage_after, usage_ids


@pytest.mark.asyncio
async def test_rev41_contract_1_non_thinking_stream_with_system_prompt() -> None:
    before = usage_ids()
    client = LlmClient(settings=settings(), recorded=FIXTURES / "v41_stream.json")
    try:
        with provider_scope(mask_only=True):
            events = [
                event
                async for event in client.chat_stream(
                    [
                        {"role": "system", "content": "You are an in-app usage guide."},
                        {"role": "user", "content": "How do I upload a CV?"},
                    ]
                )
            ]
        assert isinstance(events[-1], Done)
        assert "".join(event.text for event in events if isinstance(event, ContentDelta)) == "Open the CV page."
        client.assert_recording_consumed()
        (row,) = usage_after(before)
        assert (row.status, row.input_tokens, row.output_tokens) == ("success", 14, 6)
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_rev41_contract_4_timeout_retry_backoff_and_usage(monkeypatch) -> None:
    before = usage_ids()
    delays = []
    sleep = asyncio.sleep

    async def observe(delay: float) -> None:
        delays.append(delay)
        await sleep(delay)

    monkeypatch.setattr(asyncio, "sleep", observe)
    client = LlmClient(settings=settings(llm_timeout_s=0.04, llm_max_retries=2), recorded=FIXTURES / "v41_retry.json")
    try:
        with provider_scope(mask_only=True):
            assert await client.chat(USER) == {"role": "assistant", "content": "Ready"}
        assert len(client.recorded_requests) == 3
        assert delays == [0.08, 0.5, 1.0]
        assert sorted(row.status for row in usage_after(before)) == ["failed", "success", "timeout"]
        client.assert_recording_consumed()
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_rev41_contract_5_planted_identifier_blocks_before_provider() -> None:
    client = LlmClient(settings=settings(), recorded=FIXTURES / "v41_blocked.json")
    before = usage_ids()
    try:
        with provider_scope(mask_only=True, identities=(Identity(name="Nguyễn Minh An"),)) as scope:
            for payload in (
                [{"role": "user", "content": "person@example.test"}],
                [{"role": "user", "content": "Nguyen_Minh_An.pdf"}],
                [{"role": "user", "content": "0912345678"}],
            ):
                with pytest.raises(MaskingError, match="egress"):
                    await client.chat(scope.prepared(payload))
        assert client.recorded_requests == [] and usage_after(before) == []
        client.assert_recording_consumed()
    finally:
        await client.aclose()
