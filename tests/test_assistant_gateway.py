import json
import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langsmith.run_helpers import get_tracing_context

from src.services.privacy import ner
from src.services.privacy.types import Identity, MaskingError
from src.services.providers import gateway


@pytest.mark.asyncio
async def test_assistant_gateway_masks_without_constructing_vault(monkeypatch, caplog) -> None:
    vault = Mock(side_effect=AssertionError("assistant must not construct vaults"))
    monkeypatch.setattr(gateway, "TransientVault", vault)
    recorded = []

    class Provider:
        async def ainvoke(self, messages: list, **kwargs: object) -> AIMessage:
            assert get_tracing_context()["enabled"] is False
            recorded.append(str(messages))
            logging.getLogger("fake.provider").warning("raw an@example.test")
            return AIMessage(content="Hello [[unknown value]]")

    with gateway.provider_scope(mask_only=True, identities=(Identity(name="Nguyễn Minh An"),)) as scope:
        assert scope.vault is None
        result = await gateway.GatewayChat(backend=Provider()).ainvoke(
            [HumanMessage(content="Nguyen_Minh_An_CV.pdf an@example.test 0912345678")]
        )
        assert result.content == "Hello bạn"
        assert gateway.embedding_call(["Nguyễn Minh An"], lambda texts: texts, local=True) == ["[[PERSON]]"]
        with pytest.raises(MaskingError, match="do not support restoration"):
            scope.restore_business("[[PERSON]]")
    assert not vault.called
    wire = json.dumps(recorded, ensure_ascii=False) + caplog.text
    assert all(value not in wire for value in ("Nguyen_Minh_An", "an@example.test", "0912345678"))


def test_full_payload_egress_blocks_keys_nested_facts_and_identity_variants() -> None:
    with gateway.provider_scope(mask_only=True, identities=(Identity(name="Nguyễn Minh An"),)) as scope:
        for payload in (
            {"tools": [{"an@example.test": "description"}]},
            {"metadata": {"phone": "0912345678"}},
            {"messages": [{"content": "An Minh Nguyen"}]},
            {"options": {"passport": "B1234567"}},
        ):
            with pytest.raises(MaskingError, match="egress"):
                gateway.egress_scan(payload, scope)


@pytest.mark.asyncio
async def test_masking_failure_never_calls_chat_or_embedding_provider(monkeypatch) -> None:
    backend = Mock()
    monkeypatch.setattr(ner, "_detector", None)
    with gateway.provider_scope(mask_only=True):
        with pytest.raises(gateway.GatewayError, match="please try again later"):
            await gateway.GatewayChat(backend=backend).ainvoke("How do I upload a CV?")
        with pytest.raises(gateway.GatewayError, match="please try again later"):
            gateway.embedding_call(["How do I upload a CV?"], backend)
    backend.assert_not_called()
    backend.ainvoke.assert_not_called()


def test_nested_assistant_scope_keeps_authenticated_identity() -> None:
    identity = Identity(name="Alice Morgan", phone="0912345678")
    with gateway.provider_scope(identities=(identity,)):
        with gateway.provider_scope(mask_only=True) as assistant:
            assert assistant.identities == (identity,)
            assert assistant.vault is None
            with gateway.provider_scope() as nested:
                assert nested is assistant


@pytest.mark.asyncio
async def test_transport_cleanup_errors_have_no_raw_exception_context() -> None:
    stream = SimpleNamespace(close=AsyncMock(side_effect=RuntimeError("private@example.test")))
    with pytest.raises(gateway.GatewayError) as error:
        await gateway.close_model_stream(stream)
    assert error.value.__context__ is None
    assert "private@example.test" not in str(error.value)
