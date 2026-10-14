"""Raw Chat Completions boundary for v2; events are internal, never SSE.

Recorded files are ordered HTTP exchanges, exercised through the same SDK as live
calls. Assistant messages remain provider dictionaries, never LangChain messages.
"""

import asyncio
import copy
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from openai import APIStatusError, AsyncOpenAI
from openai.types.chat import ChatCompletionMessage

from src.config import Settings, get_settings
from src.services.privacy.types import MaskingError
from src.services.providers.gateway import (
    GatewayError,
    GatewayTimeoutError,
    PreparedPayload,
    _finish,
    _retryable,
    _start,
    egress_scan,
    provider_scope,
)


@dataclass(frozen=True)
class ContentDelta:
    text: str


@dataclass(frozen=True)
class ReasoningDelta:
    text: str = field(repr=False)


@dataclass(frozen=True)
class ToolCallDelta:
    index: int
    arguments: str = field(default="", repr=False)
    id: str | None = None
    name: str | None = None


@dataclass(frozen=True)
class Done:
    message: dict[str, Any] = field(repr=False)


class LlmProviderError(GatewayError):
    """Only status and a fixed diagnostic code survive provider exceptions."""

    def __init__(self, status_code: int | None, *, reasoning_contract: bool = False) -> None:
        super().__init__(
            "Provider reasoning replay contract failed" if reasoning_contract else "Provider request failed"
        )
        self.status_code = status_code
        self.reasoning_contract = reasoning_contract


class LlmClient:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        recorded: str | Path | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.recorded = recorded is not None
        self.recorded_requests: list[dict[str, Any]] = []
        self._exchanges: list[dict[str, Any]] = []
        if recorded is not None:
            if http_client is not None:
                raise ValueError("Recorded mode cannot use a live transport")
            self._exchanges = json.loads(Path(recorded).read_text(encoding="utf-8"))["exchanges"]
            http_client = httpx.AsyncClient(transport=httpx.MockTransport(self._recorded_response))
        self._client = AsyncOpenAI(
            api_key="recorded" if self.recorded else self.settings.llm_api_key.get_secret_value() or "unconfigured",
            base_url=self.settings.llm_base_url or "https://api.deepseek.com",
            timeout=self.settings.llm_timeout_s,
            max_retries=0,
            http_client=http_client,
        )

    async def _recorded_response(self, request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        self.recorded_requests.append(copy.deepcopy(payload))
        if not self._exchanges:
            raise GatewayError("Recorded response exhausted")
        exchange = self._exchanges.pop(0)
        if "request" in exchange and payload != exchange["request"]:
            raise GatewayError("Recorded request mismatch")
        if exchange.get("delay_s"):
            await asyncio.sleep(exchange["delay_s"])
        if "chunks" in exchange:
            body = "".join("data: " + json.dumps(chunk) + "\n\n" for chunk in exchange["chunks"])
            return httpx.Response(200, text=body + "data: [DONE]\n\n", headers={"content-type": "text/event-stream"})
        return httpx.Response(exchange.get("status", 200), json=exchange["response"])

    async def aclose(self) -> None:
        await self._client.close()

    def assert_recording_consumed(self) -> None:
        if self._exchanges:
            raise AssertionError("Unused recorded exchanges")

    @staticmethod
    def parse_tool_arguments(message: dict[str, Any]) -> dict[str, dict[str, Any]]:
        """Call only on Done/chat results. Keep original argument strings intact."""
        parsed: dict[str, dict[str, Any]] = {}
        try:
            for call in message.get("tool_calls", []):
                arguments = json.loads(call["function"]["arguments"])
                if not isinstance(arguments, dict):
                    raise ValueError
                parsed[call["id"]] = arguments
        except (ValueError, KeyError, TypeError):
            raise GatewayError("Invalid tool arguments", stage="validation") from None
        return parsed

    @staticmethod
    def _check_tool_results(messages: list[dict[str, Any]]) -> None:
        pending: set[str] = set()
        for message in messages:
            if pending:
                if message.get("role") != "tool" or message.get("tool_call_id") not in pending:
                    raise GatewayError("Reconcile dangling tool calls before dispatch", stage="validation")
                pending.remove(message["tool_call_id"])
            elif message.get("role") == "tool":
                raise GatewayError("Tool result has no provider-issued call", stage="validation")
            for call in message.get("tool_calls", []):
                call_id = call.get("id")
                if not call_id or call_id in pending:
                    raise GatewayError("Invalid provider tool call ids", stage="validation")
                pending.add(call_id)
        if pending:
            raise GatewayError("Reconcile dangling tool calls before dispatch", stage="validation")

    def _payload(
        self,
        messages: list[dict[str, Any]] | PreparedPayload,
        *,
        tools: list[dict[str, Any]] | None,
        thinking: bool | None,
        model: str | None,
        stream: bool,
        max_tokens: int | None,
        temperature: float | None,
    ) -> dict[str, Any]:
        with provider_scope() as scope:
            if isinstance(messages, PreparedPayload):
                if messages.scope is not scope:
                    raise MaskingError("Prepared messages belong to another scope")
                log = copy.deepcopy(messages.value)
                scope._detector()  # Fail closed even for caller-masked messages.
            else:
                log = [
                    scope.mask_payload(copy.deepcopy(message), wire=message.get("role") in {"assistant", "tool"})
                    for message in messages
                ]
                log = scope._mask_dictionary(log)
                # Rewriting reasoning invalidates the replay contract. Callers
                # must checkpoint masked messages; unsafe replay fails closed.
                for original, masked in zip(messages, log, strict=True):
                    if original.get("role") == "assistant" and original != masked:
                        raise MaskingError("Assistant replay must already be masked")
            self._check_tool_results(log)
            enabled = self.settings.llm_thinking_agent == "enabled" if thinking is None else thinking
            payload: dict[str, Any] = {
                "model": model or self.settings.llm_model_agent,
                "messages": log,
                "stream": stream,
                "extra_body": {"thinking": {"type": "enabled" if enabled else "disabled"}},
            }
            if enabled:
                payload["reasoning_effort"] = self.settings.llm_reasoning_effort
            elif temperature is not None:
                payload["temperature"] = temperature
            if tools is not None:
                payload["tools"] = scope.mask_payload(tools)
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens
            if stream:
                payload["stream_options"] = {"include_usage": True}
            egress_scan(payload, scope)
            return payload

    async def chat(
        self,
        messages: list[dict[str, Any]] | PreparedPayload,
        *,
        tools: list[dict[str, Any]] | None = None,
        thinking: bool | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        iterator = self._run(
            messages,
            tools=tools,
            thinking=thinking,
            model=model,
            stream=False,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        try:
            async for event in iterator:
                if isinstance(event, Done):
                    return event.message
        finally:
            await iterator.aclose()
        raise GatewayError("Provider returned no message")

    async def chat_stream(
        self,
        messages: list[dict[str, Any]] | PreparedPayload,
        *,
        tools: list[dict[str, Any]] | None = None,
        thinking: bool | None = None,
        model: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> AsyncIterator[ContentDelta | ReasoningDelta | ToolCallDelta | Done]:
        iterator = self._run(
            messages,
            tools=tools,
            thinking=thinking,
            model=model,
            stream=True,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        try:
            async for event in iterator:
                yield event
        finally:
            await iterator.aclose()

    async def _run(
        self, messages: list[dict[str, Any]] | PreparedPayload, **options: Any
    ) -> AsyncIterator[ContentDelta | ReasoningDelta | ToolCallDelta | Done]:
        with provider_scope() as scope:
            payload = self._payload(messages, **options)
            if not self.recorded and not self.settings.llm_api_key.get_secret_value():
                raise GatewayError("LLM_API_KEY is required")
            for attempt in range(self.settings.llm_max_retries + 1):
                egress_scan(payload, scope)
                call_id = _start("recorded_chat" if self.recorded else "chat", scope)
                status, usage, emitted, upstream = "failed", None, False, None
                retry = False
                try:
                    async with asyncio.timeout(self.settings.llm_timeout_s):
                        upstream = await self._client.chat.completions.create(**payload)
                        if not options["stream"]:
                            usage = upstream.usage.model_dump(exclude_none=True) if upstream.usage else None
                            message = upstream.choices[0].message.model_dump(exclude_none=True)
                        else:
                            accumulated: dict[str, Any] = {}
                            calls: dict[int, dict[str, Any]] = {}
                            finished = False
                            async for chunk in upstream:
                                if chunk.usage:
                                    usage = chunk.usage.model_dump(exclude_none=True)
                                for choice in chunk.choices:
                                    if choice.index != 0:
                                        raise GatewayError("Only one completion is supported")
                                    delta = choice.delta.model_dump(exclude_none=True)
                                    for key, value in delta.items():
                                        if key == "tool_calls":
                                            for fragment in value:
                                                index = fragment["index"]
                                                call = calls.setdefault(index, {})
                                                for call_key, call_value in fragment.items():
                                                    if call_key == "index":
                                                        continue
                                                    if call_key == "function":
                                                        function = call.setdefault("function", {})
                                                        for name, part in call_value.items():
                                                            function[name] = function.get(name, "") + part
                                                    else:
                                                        call[call_key] = call.get(call_key, "") + call_value
                                                function = fragment.get("function", {})
                                                emitted = True
                                                yield ToolCallDelta(
                                                    index,
                                                    function.get("arguments", ""),
                                                    fragment.get("id"),
                                                    function.get("name"),
                                                )
                                        elif key in {"content", "reasoning_content", "refusal"}:
                                            accumulated[key] = accumulated.get(key, "") + value
                                            if value and key != "refusal":
                                                emitted = True
                                                yield ContentDelta(value) if key == "content" else ReasoningDelta(value)
                                        else:
                                            accumulated[key] = value
                                    if choice.finish_reason is not None:
                                        finished = True
                            if not finished:
                                raise GatewayError("Provider stream ended without a finish marker")
                            if calls:
                                accumulated["tool_calls"] = [calls[index] for index in sorted(calls)]
                            message = ChatCompletionMessage.model_validate(accumulated).model_dump(exclude_none=True)
                        egress_scan(message, scope)
                        status = "success"
                    # Finish accounting and close transport BEFORE publishing Done.
                except (asyncio.CancelledError, GeneratorExit):
                    status = "cancelled"
                    raise
                except TimeoutError:
                    status = "timeout"
                    retry = not emitted and attempt < self.settings.llm_max_retries
                    if not retry:
                        raise GatewayTimeoutError("Provider request timed out") from None
                except (GatewayError, MaskingError):
                    raise
                except Exception as error:
                    retry = (
                        not emitted
                        and (_retryable(error) or isinstance(error, httpx.TransportError))
                        and attempt < self.settings.llm_max_retries
                    )
                    if not retry:
                        code = error.status_code if isinstance(error, APIStatusError) else None
                        reasoning = code == 400 and "reasoning" in str(error).lower()
                        raise LlmProviderError(code, reasoning_contract=reasoning) from None
                finally:
                    try:
                        if options["stream"] and upstream is not None:
                            await upstream.close()
                    finally:
                        _finish(
                            call_id, status, {"usage": usage or {}}, local=self.recorded, model_name=payload["model"]
                        )
                if retry:
                    await asyncio.sleep(min(0.5 * 2**attempt, 8.0))
                    continue
                yield Done(message)
                return
