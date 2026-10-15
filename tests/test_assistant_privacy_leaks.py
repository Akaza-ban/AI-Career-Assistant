"""Actual assistant graph + raw SDK recording + local CPU NER; no paid calls."""

import json
import logging
from html import unescape
from unittest.mock import Mock

import pytest
from langchain_core.runnables.config import var_child_runnable_config
from langsmith import tracing_context
from langsmith.run_helpers import get_tracing_context

from eval.pii.dataset import load_messages
from eval.pii.run import gate_failures, measure
from src.services.assistant.agent import AssistantAgent
from src.services.privacy import ner
from src.services.privacy.detectors import Detector
from src.services.privacy.types import Identity
from src.services.providers import gateway
from src.services.providers.llm_client import LlmClient
from tests.test_assistant_guardrails import fake_retriever, page_context
from tests.test_llm_client import completion, record, settings
from tests.test_provider_leaks import TraceRecorder


@pytest.fixture(scope="module")
def real_detector() -> Detector:
    return Detector(ner.load_ner("underthesea"))


def test_message_style_targets_and_actual_masker(real_detector, monkeypatch) -> None:
    samples = load_messages()
    assert len(samples) >= 600
    assert {sample.language for sample in samples} == {"vi", "en", "mixed"}
    assert gate_failures(measure(samples, real_detector, assistant=True)) == []
    monkeypatch.setattr(ner, "_detector", real_detector)
    for sample in samples:
        with gateway.provider_scope(mask_only=True, identities=sample.identities) as scope:
            wire = scope.mask_text(sample.text)
            gateway.egress_scan({"messages": [{"role": "user", "content": wire}]}, scope)
            assert all(sample.text[span.start : span.end] not in wire for span in sample.entities), sample.id
            assert all(sample.text[start:end] in wire for start, end, _ in sample.keep), sample.id


@pytest.mark.asyncio
async def test_assistant_recording_has_zero_request_log_trace_identifiers(
    real_detector, monkeypatch, tmp_path, caplog
) -> None:
    monkeypatch.setattr(ner, "_detector", real_detector)
    vault = Mock(side_effect=AssertionError("No assistant vault"))
    monkeypatch.setattr(gateway, "TransientVault", vault)
    identity = Identity(name="Nguyễn Minh An", email="first_last@example.test", phone="0912345678")
    source = fake_retriever().search.return_value
    embeddings = []

    class Retriever:
        def search(self, query: str, *args: object, **kwargs: object) -> list:
            def embed(texts: list[str]) -> list:
                assert get_tracing_context()["enabled"] is False
                embeddings.extend(texts)
                logging.getLogger("local.embedder").debug("Body %s", texts)
                return [[0.0] for _ in texts]

            gateway.embedding_call([query], embed, local=True)
            return source

    output = {"message": "Bạn có thể tải CV PDF hoặc DOCX. [[unknown]]", "intent": "qa", "actions": [], "thought": ""}
    client = LlmClient(
        settings=settings(),
        recorded=record(
            tmp_path,
            [
                {
                    "response": completion(
                        {
                            "role": "assistant",
                            "tool_calls": [
                                {
                                    "id": "reply",
                                    "type": "function",
                                    "function": {
                                        "name": "assistant_response",
                                        "arguments": json.dumps(output, ensure_ascii=False),
                                    },
                                }
                            ],
                        }
                    )
                }
            ],
        ),
    )
    trace = TraceRecorder()
    token = var_child_runnable_config.set({"callbacks": [trace], "metadata": {"email": identity.email}})
    try:
        with (
            caplog.at_level(logging.DEBUG),
            tracing_context(enabled=True),
            gateway.provider_scope(mask_only=True, identities=(identity,)),
        ):
            response = await AssistantAgent(retriever=Retriever(), llm=client).respond(
                f"Nút tải CV PDF DOCX ở đâu? Tôi là {identity.name}; {identity.email}; {identity.phone}; [[injected]]",
                page_context(
                    page_state={
                        "label": "Nguyen_Minh_An.pdf",
                        "handle": "@first_last",
                        "cv_body": "PRIVATE_CV_BODY",
                        "jd_body": "PRIVATE_JD_BODY",
                        "transcript": "PRIVATE_TRANSCRIPT",
                    }
                ),
                history=[{"role": "user", "content": "Họ tên: An Minh Nguyen; CCCD: 099800000000"}],
            )
        assert len(client.recorded_requests) == 1
        assert response.message.endswith("bạn") and "[[" not in response.message
        wire = (
            json.dumps(client.recorded_requests, ensure_ascii=False)
            + json.dumps(embeddings, ensure_ascii=False)
            + caplog.text
            + str(trace.events)
        )
        for identifier in (
            identity.name,
            identity.email,
            identity.phone,
            "Nguyen_Minh_An",
            "An Minh Nguyen",
            "@first_last",
            "099800000000",
            "PRIVATE_CV_BODY",
            "PRIVATE_JD_BODY",
            "PRIVATE_TRANSCRIPT",
        ):
            assert identifier not in wire
        assert trace.events == [] and not vault.called
        assert "&#91;&#91;injected]]" in unescape(str(client.recorded_requests))
        client.assert_recording_consumed()
    finally:
        var_child_runnable_config.reset(token)
        await client.aclose()


@pytest.mark.asyncio
async def test_assistant_masker_failure_returns_friendly_error_without_provider(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(ner, "_detector", None)
    client = LlmClient(settings=settings(), recorded=record(tmp_path, []))
    try:
        response = await AssistantAgent(retriever=fake_retriever(), llm=client).respond(
            "Nút tải CV PDF DOCX ở đâu?",
            page_context(),
        )
        assert "thử lại sau" in response.message
        assert response.actions == [] and client.recorded_requests == []
    finally:
        await client.aclose()
