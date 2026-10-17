import asyncio
import json
import logging
import re
import traceback
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage
from langchain_core.runnables.config import var_child_runnable_config
from langsmith import tracing_context
from langsmith.run_helpers import get_tracing_context
from sqlalchemy import select

from src.config import get_settings
from src.db.database import SessionLocal
from src.db.models import ProviderUsage
from src.services import llm
from src.services.privacy import ner
from src.services.privacy.detectors import Detector
from src.services.privacy.types import Identity, MaskingError, Span
from src.services.providers import gateway
from tests.test_privacy_detectors import EmptyNer


@pytest.fixture(autouse=True)
def local_detector(monkeypatch):
    monkeypatch.setattr(ner, "_detector", Detector(EmptyNer()))


class Recorder:
    def __init__(self, content: str = '{"summary": "ok"}', error: Exception | None = None):
        self.requests = []
        self.content = content
        self.error = error

    async def ainvoke(self, payload, **kwargs):
        self.requests.append({"payload": payload, **kwargs})
        assert get_tracing_context()["enabled"] is False
        assert kwargs["config"]["callbacks"] == []
        if self.error:
            logging.getLogger("openai.transport").exception(
                "Provider body: %s", self.error, extra={"model_output": str(self.error)}
            )
            raise self.error
        return AIMessage(
            content=self.content, usage_metadata={"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}
        )


def usage_after(ids):
    with SessionLocal() as db:
        return list(db.scalars(select(ProviderUsage).where(ProviderUsage.id.not_in(ids))))


def usage_ids():
    with SessionLocal() as db:
        return list(db.scalars(select(ProviderUsage.id)))


@pytest.mark.asyncio
async def test_masks_full_messages_reasoning_and_tool_results_and_restores_business(monkeypatch):
    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    raw = "Alice Morgan alice@example.test +84 912 345 678 ID: AB12345678"
    with gateway.provider_scope(identities=(Identity(name="Alice Morgan"),)) as scope:
        await gateway.GatewayChat().ainvoke(
            [
                {"role": "assistant", "content": "ok", "reasoning_content": raw},
                {"role": "tool", "content": raw, "tool_call_id": "call_1"},
            ]
        )
        masked = scope.mask_text(raw)
        assert scope.restore_business(masked) == raw
        assert scope.restore_business({"thought": masked, "reasoning_content": masked}) == {
            "thought": masked,
            "reasoning_content": masked,
        }
    serialized = json.dumps(fake.requests, default=str, ensure_ascii=False)
    for value in ("Alice Morgan", "alice@example.test", "912 345 678", "AB12345678"):
        assert value not in serialized


@pytest.mark.parametrize("field", ["reasoning_content", "tools", "metadata", "email@example.test"])
def test_egress_scans_entire_payload_including_keys(field):
    with gateway.provider_scope(identities=(Identity(name="Alice Morgan"),)) as scope:
        for raw in ("email@example.test", "+1 202 555 0142", "123456789012", "Morgan Alice", "Alice Morgan"):
            with pytest.raises(MaskingError):
                gateway.egress_scan({field: {"nested": raw}}, scope)


@pytest.mark.asyncio
async def test_privacy_failure_and_disabled_masking_never_dispatch(monkeypatch):
    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    for detector in (None, Detector()):
        monkeypatch.setattr(ner, "_detector", detector)
        with pytest.raises(gateway.GatewayError):
            await gateway.GatewayChat().ainvoke("secret@example.test")
    monkeypatch.setattr(ner, "_detector", Detector(EmptyNer()))
    monkeypatch.setattr(get_settings(), "pii_masking_enabled", False)
    with pytest.raises(gateway.GatewayError):
        await gateway.GatewayChat().ainvoke("hello")
    assert fake.requests == []


@pytest.mark.asyncio
async def test_egress_blocks_missed_identifier_before_dispatch(monkeypatch):
    class MissedDetector:
        def detect(self, text, **kwargs):
            return []

    monkeypatch.setattr(ner, "_detector", MissedDetector())
    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    with pytest.raises(gateway.GatewayError):
        await gateway.GatewayChat().ainvoke("missed@example.test")
    assert fake.requests == []


@pytest.mark.asyncio
@pytest.mark.parametrize("api", ["chat", "responses"])
async def test_sdk_final_payload_is_masked_and_scanned(monkeypatch, api):
    from langchain_openai import ChatOpenAI

    monkeypatch.setattr(get_settings(), "openai_api_key", "sk-test")
    with gateway.provider_scope(identities=(Identity(name="Alice Morgan"),)) as scope:
        model = gateway._chat_backend(get_settings(), {"max_retries": 9})
        assert model.max_retries == 0 and model.callbacks == []
        monkeypatch.setattr(
            ChatOpenAI,
            "_get_request_payload",
            lambda *a, **k: {
                "messages" if api == "chat" else "input": [
                    {"role": "assistant", "reasoning_content": "Alice Morgan mail@example.test"}
                ],
                "tools": [{"description": "+84 912 345 678", "parameters": {"default": "AB12345678"}}],
            },
        )
        payload = model._get_request_payload("hello")
        if api == "responses":
            assert "messages" not in payload and "instructions" in payload
        gateway.egress_scan(payload, scope)
        assert "mail@example.test" not in json.dumps(payload)
        assert "Alice Morgan" not in json.dumps(payload)


@pytest.mark.asyncio
async def test_provider_error_logs_and_exception_have_no_raw_body(monkeypatch, caplog):
    raw = "RAW MODEL OUTPUT mail@example.test +84 912 345 678 Alice Morgan"
    fake = Recorder(error=RuntimeError(raw))
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    with caplog.at_level(logging.DEBUG), pytest.raises(gateway.GatewayError) as caught:
        await gateway.GatewayChat().ainvoke("hello")
    assert caught.value.__context__ is None and caught.value.__cause__ is None
    assert raw not in "".join(traceback.format_exception(caught.value))
    assert all(value not in caplog.text for value in (raw, "mail@example.test", "Alice Morgan"))
    assert all(not hasattr(record, "model_output") for record in caplog.records)


@pytest.mark.asyncio
@pytest.mark.parametrize("output", ["RAW mail@example.test", '{"broken": mail@example.test}', "[]"])
async def test_invoke_json_does_not_put_model_output_in_errors(monkeypatch, output):
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: Recorder(content=output))
    with pytest.raises(gateway.GatewayError) as caught:
        await llm.invoke_json("hello")
    assert "mail@example.test" not in str(caught.value)
    assert caught.value.__context__ is None
    assert not hasattr(caught.value, "doc")


@pytest.mark.asyncio
async def test_tracing_disabled_even_under_enabled_parent_and_callbacks(monkeypatch):
    class TraceRecorder(BaseCallbackHandler):
        def __init__(self):
            self.events = []

        def on_chain_start(self, *args, **kwargs):
            self.events.append(args)

        def on_llm_start(self, *args, **kwargs):
            self.events.append(args)

    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    handler = TraceRecorder()
    token = var_child_runnable_config.set({"callbacks": [handler]})
    try:
        with tracing_context(enabled=True):
            await gateway.GatewayChat().ainvoke("email@example.test", config={"callbacks": [handler]})
            assert get_tracing_context()["enabled"] is True
    finally:
        var_child_runnable_config.reset(token)
    assert handler.events == []


@pytest.mark.asyncio
async def test_accounting_success_failure_cancellation_and_embedding(monkeypatch):
    before = usage_ids()
    monkeypatch.setattr(get_settings(), "provider_input_usd_per_million", 2.0)
    monkeypatch.setattr(get_settings(), "provider_output_usd_per_million", 4.0)
    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    with gateway.provider_scope(user_id="sv-0142"):
        await gateway.GatewayChat().ainvoke("hello")
        fake.error = RuntimeError("provider body")
        with pytest.raises(gateway.GatewayError):
            await gateway.GatewayChat().ainvoke("hello")

        async def cancelled(*args, **kwargs):
            raise asyncio.CancelledError("RAW cancelled model output mail@example.test")

        fake.ainvoke = cancelled
        with pytest.raises(asyncio.CancelledError) as caught:
            await gateway.GatewayChat().ainvoke("hello")
        assert str(caught.value) == "" and caught.value.__context__ is None
        assert gateway.embedding_call(["hello"], lambda masked: [[1.0]], local=True) == [[1.0]]
    rows = usage_after(before)
    assert len(rows) == 4 and all(row.user_id == "sv-0142" for row in rows)
    assert sorted(row.status for row in rows) == ["cancelled", "failed", "success", "success"]
    chat = next(row for row in rows if row.operation == "chat" and row.status == "success")
    assert chat.input_tokens == 100 and chat.output_tokens == 20
    assert chat.cost_usd == pytest.approx(0.00028) and chat.cost_known
    local = next(row for row in rows if row.operation == "embedding")
    assert local.cost_usd == 0 and local.cost_known


@pytest.mark.asyncio
async def test_unknown_tariff_is_explicit_and_accounting_failure_blocks_dispatch(monkeypatch):
    fake = Recorder()
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    before = usage_ids()
    monkeypatch.setattr(get_settings(), "provider_input_usd_per_million", None)
    await gateway.GatewayChat().ainvoke("hello")
    assert usage_after(before)[0].cost_known is False
    monkeypatch.setattr(gateway, "_start", lambda *args: (_ for _ in ()).throw(RuntimeError("db body")))
    with pytest.raises(gateway.GatewayError):
        await gateway.GatewayChat().ainvoke("hello")
    assert len(fake.requests) == 1


@pytest.mark.asyncio
async def test_model_override_does_not_use_another_models_tariff(monkeypatch):
    before = usage_ids()
    monkeypatch.setattr(get_settings(), "provider_input_usd_per_million", 2.0)
    monkeypatch.setattr(get_settings(), "provider_output_usd_per_million", 4.0)
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: Recorder())
    await gateway.GatewayChat(model="other/deployment").ainvoke("hello")
    row = usage_after(before)[0]
    assert row.input_tokens == 100 and row.output_tokens == 20
    assert row.cost_known is False and row.cost_usd == 0


def test_literal_placeholder_and_scope_round_trip():
    with gateway.provider_scope(origins=("cv:own", "jd:own")) as scope:
        raw = "Name: Alice Morgan\nmail@example.test & [[PERSON_1]]"
        masked = scope.mask_text(raw, origin="cv:own")
        assert scope.restore_business(masked, allowed_origins=("cv:own",)) == raw
        with pytest.raises(Exception):
            scope.restore_business(masked, allowed_origins=("jd:own",))
        assert scope.mask_text(masked) != masked  # Raw input cannot inject wire tokens.


def test_newly_detected_names_are_masked_in_earlier_fields():
    with gateway.provider_scope() as scope:
        payload = scope.mask_payload({"earlier": "Ask Alice Morgan", "later": "Recruiter: Alice Morgan"})
        assert "Alice Morgan" not in json.dumps(payload)
        gateway.egress_scan(payload, scope)


def test_narrow_name_survives_broader_ner_span_in_dictionary(monkeypatch):
    class BroadNer:
        def detect(self, text):
            if "Applicant Alice Morgan" in text:
                start = text.index("Applicant")
                return [Span(start, start + len("Applicant Alice Morgan"), "PERSON")]
            return []

    monkeypatch.setattr(ner, "_detector", Detector(BroadNer()))
    with gateway.provider_scope(origins=("cv:own",)) as scope:
        scope.prime("Applicant Alice Morgan - Backend Developer", "cv:own")
        wire = scope.mask_payload("Viết Python API cùng Alice Morgan")
        assert "Alice Morgan" not in wire
        gateway.egress_scan(wire, scope)


def test_sdk_and_storage_logs_are_sanitized_outside_dispatch(caplog):
    gateway.install_telemetry_policy()
    with caplog.at_level(logging.DEBUG):
        logging.getLogger("sqlalchemy.engine.Engine").error(
            "Model output: Alice Morgan", extra={"bindings": "mail@example.test"}
        )
        logging.getLogger("openai.transport").error("Raw mail@example.test")
    assert "Alice Morgan" not in caplog.text and "mail@example.test" not in caplog.text
    assert all(not hasattr(record, "bindings") for record in caplog.records)


@pytest.mark.asyncio
async def test_real_langchain_structured_transport_masking_tracing_and_reported_cost(monkeypatch):
    from pydantic import BaseModel

    class Reply(BaseModel):
        message: str
        thought: str

    backend_factory = gateway._chat_backend
    requests = []
    before = usage_ids()

    async def create(**payload):
        assert get_tracing_context()["enabled"] is False
        gateway.egress_scan(payload, gateway._scope.get())
        requests.append(payload)
        token = re.search(r"\[\[EMAIL_[^\]]+\]\]", json.dumps(payload)).group()
        result = {
            "choices": [
                {
                    "index": 0,
                    "finish_reason": "tool_calls",
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_1",
                                "type": "function",
                                "function": {
                                    "name": payload["tools"][0]["function"]["name"],
                                    "arguments": json.dumps(
                                        {"message": f"Contact {token}", "thought": "mail@example.test"}
                                    ),
                                },
                            }
                        ],
                    },
                }
            ],
            "model": "test-model",
            "id": "response_1",
            "object": "chat.completion",
            "created": 1,
            "usage": {"prompt_tokens": 50, "completion_tokens": 10, "total_tokens": 60, "cost": 0.005},
        }
        return SimpleNamespace(parse=lambda: result, headers={})

    def factory(settings, options):
        backend = backend_factory(settings, options)
        backend.async_client = SimpleNamespace(with_raw_response=SimpleNamespace(create=create))
        assert backend.max_retries == 0 and backend.cache is False
        return backend

    monkeypatch.setattr(gateway, "_chat_backend", factory)
    with tracing_context(enabled=True), gateway.provider_scope(identities=(Identity(name="Alice Morgan"),)) as scope:
        reply = (
            await gateway.GatewayChat().with_structured_output(Reply).ainvoke("Ask Alice Morgan at mail@example.test")
        )
        assert isinstance(reply, Reply)
        assert "mail@example.test" not in reply.thought
        assert scope.restore_business(reply.message) == "Contact mail@example.test"
    assert len(requests) == 1
    assert "mail@example.test" not in json.dumps(requests) and "Alice Morgan" not in json.dumps(requests)
    row = usage_after(before)[0]
    assert row.input_tokens == 50 and row.output_tokens == 10
    assert row.cost_usd == 0.005 and row.cost_known


@pytest.mark.asyncio
async def test_transient_sdk_retries_account_each_attempt(monkeypatch):
    import httpx
    from openai import RateLimitError

    before = usage_ids()
    fake = Recorder()
    error = RateLimitError(
        "RAW mail@example.test",
        response=httpx.Response(429, request=httpx.Request("POST", "https://provider.test")),
        body={},
    )
    responses = [error, AIMessage(content="ok")]

    async def invoke(*args, **kwargs):
        response = responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    fake.ainvoke = invoke
    monkeypatch.setattr(gateway, "_chat_backend", lambda *args: fake)
    monkeypatch.setattr(gateway.asyncio, "sleep", AsyncMock())
    await gateway.GatewayChat().ainvoke("hello")
    rows = usage_after(before)
    assert len(rows) == 2 and {row.status for row in rows} == {"failed", "success"}
