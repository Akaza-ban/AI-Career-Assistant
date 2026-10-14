"""Single outbound model boundary: privacy, tracing, errors and accounting.

Hosted provider objects never leave this module. SDK retries are disabled so each
physical request has its own durable ledger row. Callers explicitly restore
business fields inside an authorized provider_scope; telemetry stays masked.
"""

import asyncio
import json
import logging
import math
import re
import time
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from langchain_core.embeddings import Embeddings
from langchain_core.messages import BaseMessage
from pydantic import BaseModel

from src.config import Settings, get_settings
from src.services.privacy.detectors import Detector, identity_spans, merge_spans, regex_spans
from src.services.privacy.masker import mask, unmask
from src.services.privacy.transient import TransientVault
from src.services.privacy.types import KINDS, PLACEHOLDER_RE, Identity, MaskingError, Span


class GatewayError(RuntimeError):
    """Safe to expose or log: never wraps a provider's error body."""

    def __init__(self, message: str, *, stage: str = "dispatch") -> None:
        super().__init__(message)
        self.stage = stage


class GatewayTimeoutError(GatewayError, TimeoutError):
    pass


def initialize_gateway_runtime() -> None:
    """CLI bootstrap without seeding users or failing unrelated running jobs."""
    from src.db.database import engine
    from src.db.models import ProviderUsage
    from src.services.privacy.ner import initialize_privacy

    install_telemetry_policy()
    initialize_privacy()
    ProviderUsage.__table__.create(bind=engine, checkfirst=True)


_scope: ContextVar["ProviderScope | None"] = ContextVar("provider_scope", default=None)
_sensitive: ContextVar[bool] = ContextVar("sensitive_provider_operation", default=False)


def _private_log(name: str) -> bool:
    # SDK worker threads may not inherit contextvars. SQL/Chroma debug records
    # can contain unmasked BUSINESS storage values, outside provider dispatch.
    prefixes = (
        "openai",
        "httpx",
        "httpcore",
        "langchain",
        "langsmith",
        "sqlalchemy",
        "chromadb",
        "sentence_transformers",
        "transformers",
        "huggingface_hub",
        "fastembed",
        "onnxruntime",
    )
    return _sensitive.get() or name.startswith(prefixes)


def install_telemetry_policy() -> None:
    """Strip scoped diagnostic bodies, including third-party debug/error logs.

    This is context-local (concurrent requests do not toggle logger levels).
    Logging factories execute before handlers, queues or exporters see text.
    """
    current = logging.getLogRecordFactory()
    if getattr(current, "_provider_policy", False):
        return

    def safe_record(*args: Any, **kwargs: Any) -> logging.LogRecord:
        record = current(*args, **kwargs)
        if _private_log(record.name):
            record.msg = "Sensitive operation diagnostic suppressed"
            record.args = ()
            record.exc_info = None
            record.exc_text = None
            record.stack_info = None
        return record

    safe_record._provider_policy = True
    logging.setLogRecordFactory(safe_record)

    # Logger merges `extra` AFTER its record factory runs. Drop scoped extras
    # before that merge so error-reporting/export handlers cannot capture them.
    make_record = logging.Logger.makeRecord
    if not getattr(make_record, "_provider_policy", False):

        def safe_make_record(
            self: logging.Logger,
            name: str,
            level: int,
            fn: str,
            lno: int,
            msg: Any,
            args: Any,
            exc_info: Any,
            func: Any = None,
            extra: Any = None,
            sinfo: Any = None,
        ) -> logging.LogRecord:
            if _private_log(name):
                msg, args, exc_info, extra, sinfo = "Sensitive operation diagnostic suppressed", (), None, None, None
            return make_record(self, name, level, fn, lno, msg, args, exc_info, func, extra, sinfo)

        safe_make_record._provider_policy = True
        logging.Logger.makeRecord = safe_make_record


@contextmanager
def telemetry_policy() -> Iterator[None]:
    """Disable automatic/inherited LangChain and LangSmith capture, locally."""
    from langchain_core.globals import set_debug, set_verbose
    from langchain_core.runnables.config import var_child_runnable_config
    from langchain_core.tracers.context import _configure_hooks, tracing_v2_callback_var
    from langsmith import tracing_context

    install_telemetry_policy()
    set_debug(False)
    set_verbose(False)
    sensitive = _sensitive.set(True)
    config = var_child_runnable_config.set({"callbacks": [], "metadata": {}, "tags": []})
    tracer = tracing_v2_callback_var.set(None)
    hooks = [(var, var.set(None)) for var, _, _, _ in _configure_hooks]
    try:
        with tracing_context(enabled=False, parent=False, tags=[], metadata={}):
            yield
    finally:
        for var, token in reversed(hooks):
            var.reset(token)
        tracing_v2_callback_var.reset(tracer)
        var_child_runnable_config.reset(config)
        _sensitive.reset(sensitive)


@dataclass(frozen=True)
class PreparedPayload:
    """Trusted caller rendering of already-masked fields, bound to one scope."""

    value: Any
    scope: "ProviderScope" = field(repr=False)


class ProviderScope:
    def __init__(
        self, user_id: str = "system", identities: tuple[Identity, ...] = (), origins: tuple[str, ...] = ("message",)
    ) -> None:
        self.user_id = user_id
        self.identities = identities
        self.origins = frozenset(("message", *origins))
        self.vault = TransientVault(get_settings().pii_vault_ttl_hours * 3600)
        self._detection_cache: dict[tuple[str, str], list[Span]] | None = None

    def _detector(self) -> Detector:
        from src.services.privacy.ner import get_detector

        if not get_settings().pii_masking_enabled:
            raise MaskingError("Local privacy protection unavailable; please try again later")
        active = get_detector()
        vault = self.vault
        scope = self

        class DictionaryDetector(Detector):
            def detect(self, text: str, **kwargs: Any) -> list[Span]:
                key = (text, str(kwargs.get("document_type", "message")))
                cache = scope._detection_cache
                if cache is None:
                    spans = active.detect(text, **kwargs)
                else:
                    if key not in cache:
                        cache[key] = active.detect(text, **kwargs)
                    spans = cache[key]
                return merge_spans([*spans, *vault.dictionary_spans(text)], len(text))

        return DictionaryDetector()

    def prime(self, text: str, origin: str, *, document_type: str | None = None) -> None:
        """Detect a document before prompt decoration/truncation loses its header."""
        if origin not in self.origins:
            raise MaskingError("Document outside the authorized privacy scope")
        detector = self._detector()
        spans = detector.detect(
            text, identities=self.identities, document_type=document_type or origin.split(":", 1)[0]
        )
        # Preserve narrower explicit name/contact detections too. A merged NER
        # span can include "Applicant" plus a name; that broader original alone
        # would not catch the bare name later in the document/prompt.
        for span in [*spans, *regex_spans(text), *identity_spans(text, self.identities)]:
            self.vault.store(text[span.start : span.end], span.kind, origin)

    def mask_text(self, text: str, *, origin: str = "message", wire: bool = False, detect_names: bool = True) -> str:
        if origin not in self.origins:
            raise MaskingError("Document outside the authorized privacy scope")
        detector = self._detector()
        if not wire:
            return mask(text, self.vault, origin=origin, detector=detector, identities=self.identities)
        # Only gateway-produced wire data may preserve a token. Raw inbound data
        # always escapes literal brackets, including an existing-looking token.
        # Offset-preserving probe excludes trusted tokens. Wire values are already
        # escaped: escaping them again would corrupt &, URLs and model quotes.
        for match in PLACEHOLDER_RE.finditer(text):
            self.vault.resolve_placeholder(match.group(), KINDS, self.origins)
        probe = PLACEHOLDER_RE.sub(lambda m: " " * len(m.group()), text)
        chunks, cursor = [], 0
        spans = (
            detector.detect(probe, identities=self.identities)
            if detect_names
            else merge_spans(
                [*regex_spans(probe), *identity_spans(probe, self.identities), *self.vault.dictionary_spans(probe)],
                len(probe),
            )
        )
        for span in spans:
            chunks.append(text[cursor : span.start])
            chunks.append(self.vault.store(text[span.start : span.end], span.kind, origin))
            cursor = span.end
        chunks.append(text[cursor:])
        return "".join(chunks)

    def mask_payload(self, value: Any, *, wire: bool = False, detect_names: bool = True) -> Any:
        # NER may recognize an identity only at one occurrence. Once a payload's
        # fields have populated the dictionary, mask ALL other occurrences,
        # including fields visited earlier, before the final egress scan.
        # Cache identical field detections only DURING this one masking pass.
        # Later calls always consult NER again and fail closed on unavailability.
        previous_cache = self._detection_cache
        self._detection_cache = {}
        try:
            return self._mask_dictionary(self._mask_payload(value, wire=wire, detect_names=detect_names))
        finally:
            self._detection_cache = previous_cache

    def _mask_dictionary(self, value: Any) -> Any:
        if isinstance(value, str):
            probe = PLACEHOLDER_RE.sub(lambda m: " " * len(m.group()), value)
            chunks, cursor = [], 0
            for span in self.vault.dictionary_spans(probe):
                chunks.append(value[cursor : span.start])
                chunks.append(self.vault.store(value[span.start : span.end], span.kind, "message"))
                cursor = span.end
            chunks.append(value[cursor:])
            return "".join(chunks)
        if isinstance(value, BaseModel):
            return type(value).model_validate(self._mask_dictionary(value.model_dump()))
        if isinstance(value, Mapping):
            return {key: self._mask_dictionary(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._mask_dictionary(item) for item in value]
        return value

    def _mask_payload(self, value: Any, *, wire: bool = False, detect_names: bool = True) -> Any:
        if isinstance(value, str):
            return self.mask_text(value, wire=wire, detect_names=detect_names)
        if isinstance(value, BaseMessage):
            # All message fields, including tool calls and replayed reasoning.
            return type(value).model_validate(
                self._mask_payload(value.model_dump(), wire=wire, detect_names=detect_names)
            )
        if isinstance(value, BaseModel):
            return type(value).model_validate(
                self._mask_payload(value.model_dump(), wire=wire, detect_names=detect_names)
            )
        if isinstance(value, Mapping):
            if value.get("type") in {"image_url", "input_image", "image", "input_audio", "file"}:
                raise MaskingError("Only locally extracted text may enter model requests")
            # Key names are part of the outbound payload too; egress rejects
            # unsafe schema/parameter keys instead of silently renaming them.
            return {key: self._mask_payload(item, wire=wire, detect_names=detect_names) for key, item in value.items()}
        if isinstance(value, (tuple, list)):
            return [self._mask_payload(item, wire=wire, detect_names=detect_names) for item in value]
        if value is None or isinstance(value, (bool, int, float)):
            return value
        raise MaskingError("Unsupported provider payload; dispatch forbidden")

    def prepared(self, value: Any) -> PreparedPayload:
        """Used after caller-side HTML/XML rendering of masked raw fields."""
        return PreparedPayload(value, self)

    def mask_response_content(self, value: Any) -> Any:
        if isinstance(value, str):
            # Detect JSON VALUE fields, never serialized JSON punctuation. NER
            # spans can otherwise swallow quotes/braces and break legacy parsers.
            match = re.search(r"\{.*\}", value, re.DOTALL)
            parsed = None
            if match is not None:
                try:
                    parsed = json.loads(match.group())
                except (ValueError, TypeError):
                    pass
            if isinstance(parsed, dict):
                return (
                    self.mask_text(value[: match.start()], wire=True)
                    + json.dumps(self.mask_payload(parsed, wire=True), ensure_ascii=False)
                    + self.mask_text(value[match.end() :], wire=True)
                )
        return self.mask_payload(value, wire=True)

    def restore_business(self, value: Any, *, allowed_origins: tuple[str, ...] | None = None) -> Any:
        """Caller-only restoration of business records/user-visible fields.

        Never restore reasoning_content, thought, telemetry, or checkpoints.
        """
        origins = frozenset(allowed_origins) if allowed_origins is not None else self.origins
        if not origins.issubset(self.origins):
            raise MaskingError("Resolution outside the authorized privacy scope")
        if isinstance(value, str):
            return unmask(value, self.vault, allowed_kinds=KINDS, allowed_origins=origins)
        if isinstance(value, list):
            return [self.restore_business(item, allowed_origins=tuple(origins)) for item in value]
        if isinstance(value, dict):
            return {
                key: item
                if key in {"reasoning_content", "thought"}
                else self.restore_business(item, allowed_origins=tuple(origins))
                for key, item in value.items()
            }
        return value


@contextmanager
def provider_scope(
    *, user_id: str | None = None, identities: tuple[Identity, ...] = (), origins: tuple[str, ...] = ()
) -> Iterator[ProviderScope]:
    existing = _scope.get()
    if existing is not None and user_id is None and not origins and not identities:
        with telemetry_policy():
            yield existing
        return
    if user_id is not None and not identities:
        from src.db.database import SessionLocal
        from src.db.models import User

        with SessionLocal() as db:
            user = db.get(User, user_id)
            if user is None:
                raise GatewayError("Provider user scope unavailable")
            identities = (Identity(name=user.full_name, email=user.email),)
    scope = ProviderScope(user_id or "system", identities, origins)
    token = _scope.set(scope)
    try:
        with telemetry_policy():
            yield scope
    finally:
        _scope.reset(token)
        scope.vault.clear()


def egress_scan(payload: Any, scope: ProviderScope) -> None:
    """Scan the entire final body, not only user messages or prompt text."""

    def serialize(value: Any) -> Any:
        if isinstance(value, BaseModel):
            return value.model_dump()
        raise MaskingError("Unsupported outbound payload")

    text = json.dumps(payload, ensure_ascii=False, default=serialize)
    # Nonces/counters are opaque; do not mistake their digits for IDs/phones.
    text = PLACEHOLDER_RE.sub("", text)
    if (
        any(span.kind in {"EMAIL", "PHONE", "ID"} for span in regex_spans(text))
        or identity_spans(text, scope.identities)
        or scope.vault.dictionary_spans(text)
    ):
        raise MaskingError("Privacy egress guard blocked provider dispatch")


def _start(operation: str, scope: ProviderScope) -> str:
    from src.db.database import SessionLocal
    from src.db.models import ProviderUsage

    try:
        with SessionLocal() as db:
            row = ProviderUsage(user_id=scope.user_id, operation=operation)
            db.add(row)
            db.commit()
            return row.id
    except Exception:
        raise GatewayError("Usage accounting unavailable; dispatch forbidden") from None


def _finish(
    call_id: str, status: str, result: Any = None, *, local: bool = False, model_name: str | None = None
) -> None:
    from src.db.database import SessionLocal
    from src.db.models import ProviderUsage

    try:
        usage = getattr(result, "usage_metadata", None)
        metadata = getattr(result, "response_metadata", {}) or {}
        usage = usage or metadata.get("token_usage") or {}
        if isinstance(result, dict):
            usage = result.get("usage", usage)
        if hasattr(usage, "model_dump"):
            usage = usage.model_dump()
        input_tokens = max(0, int(usage.get("input_tokens", usage.get("prompt_tokens", usage.get("total_tokens", 0)))))
        output_tokens = max(0, int(usage.get("output_tokens", usage.get("completion_tokens", 0))))
        settings = get_settings()
        with SessionLocal() as db:
            row = db.get(ProviderUsage, call_id)
            row.status = status
            row.input_tokens, row.output_tokens = input_tokens, output_tokens
            row.usage_known = bool(usage) or local
            input_rate = (
                settings.provider_embedding_usd_per_million
                if row.operation == "embedding"
                else settings.provider_input_usd_per_million
            )
            output_rate = 0 if row.operation == "embedding" else settings.provider_output_usd_per_million
            if row.operation == "chat" and model_name is not None and model_name != settings.model_name:
                input_rate, output_rate = None, None
            row.cost_known = local or (bool(usage) and input_rate is not None and output_rate is not None)
            row.cost_usd = (
                0 if local else (input_tokens * (input_rate or 0) + output_tokens * (output_rate or 0)) / 1_000_000
            )
            # OpenRouter-compatible providers may report the actual charge.
            # Prefer a finite, nonnegative numeric charge over configured tariffs.
            reported_cost = (metadata.get("token_usage") or {}).get("cost", usage.get("cost"))
            if (
                not local
                and type(reported_cost) in (int, float)
                and math.isfinite(reported_cost)
                and reported_cost >= 0
            ):
                row.cost_usd, row.cost_known = float(reported_cost), True
            db.commit()
    except Exception:
        raise GatewayError("Usage accounting update failed") from None


def _chat_backend(settings: Settings, options: dict[str, Any]) -> Any:
    from langchain_openai import ChatOpenAI

    class GuardedChat(ChatOpenAI):
        def _get_request_payload(self, input_: Any, *, stop: list[str] | None = None, **kwargs: Any) -> dict:
            payload = super()._get_request_payload(input_, stop=stop, **kwargs)
            scope = _scope.get()
            if scope is None:
                raise GatewayError("Provider dispatch requires privacy scope")
            instruction = "Double-bracket privacy placeholders are opaque values. Copy them verbatim; never infer or expand identities."
            if "messages" in payload:
                role = "developer" if re.match(r"^o\d", self.model_name or "") else "system"
                payload["messages"] = [{"role": role, "content": instruction}, *payload["messages"]]
            else:
                # LangChain may select the Responses API for a configured model.
                # Keep its native body shape; never add a Chat Completions field.
                payload["instructions"] = instruction + "\n" + (payload.get("instructions") or "")
            payload = scope.mask_payload(payload, wire=True, detect_names=False)
            egress_scan(payload, scope)
            return payload

    from langchain_core.globals import set_debug, set_verbose

    set_debug(False)
    set_verbose(False)
    api_key, base_url = settings.get_llm_credentials()
    options = dict(options)
    options.pop("max_retries", None)
    options.update(max_retries=0, callbacks=[], verbose=False, cache=False)
    return GuardedChat(
        model=options.pop("model", settings.model_name),
        temperature=options.pop("temperature", settings.llm_temperature),
        api_key=api_key or "sk-dummy-key-for-init",
        base_url=base_url,
        **options,
    )


def _retryable(error: Exception) -> bool:
    from openai import APIConnectionError, APIStatusError

    return isinstance(error, APIConnectionError) or (
        isinstance(error, APIStatusError) and (error.status_code in {408, 409, 429} or error.status_code >= 500)
    )


async def _chat_attempts(
    backend: Any,
    payload: Any,
    kwargs: dict[str, Any],
    scope: ProviderScope,
    timeout: float,
    retries: int,
    model_name: str,
) -> Any:
    """Preserve SDK retry behavior, accounting for EACH physical request."""
    async with asyncio.timeout(timeout):
        for attempt in range(retries + 1):
            call_id = _start("chat", scope)
            response = None
            status = "failed"
            try:
                response = await backend.ainvoke(
                    payload, config={"callbacks": [], "metadata": {}, "tags": []}, **kwargs
                )
                status = "success"
                return response
            except asyncio.CancelledError:
                status = "cancelled"
                raise
            except Exception as error:
                if not _retryable(error) or attempt == retries:
                    raise
            finally:
                raw = response.get("raw") if isinstance(response, dict) and "raw" in response else response
                _finish(call_id, status, raw, model_name=model_name)
            await asyncio.sleep(min(0.5 * 2**attempt, 8.0))


class GatewayChat:
    """Compatibility facade for existing LangChain callers; not T1.5 LlmClient."""

    def __init__(self, *, settings: Settings | None = None, backend: Any = None, **options: Any) -> None:
        self.settings = settings or get_settings()
        self._backend = backend
        self.options = options
        self._schema: type[BaseModel] | None = None

    def with_structured_output(self, schema: type[BaseModel], *, method: str = "function_calling") -> "GatewayChat":
        if method != "function_calling":
            raise GatewayError("Unsupported structured-output method")
        wrapped = GatewayChat(settings=self.settings, backend=self._backend, **self.options)
        wrapped._schema = schema
        return wrapped

    async def ainvoke(self, payload: Any, *, config: Any = None, **kwargs: Any) -> Any:
        with provider_scope() as scope:
            response = None
            timed_out = False
            failed = False
            cancelled = False
            stage = "mask"
            try:
                if isinstance(payload, PreparedPayload):
                    if payload.scope is not scope:
                        raise MaskingError("Prepared payload belongs to another privacy scope")
                    masked = scope.mask_payload(payload.value, wire=True, detect_names=False)
                else:
                    masked = scope.mask_payload(payload)
                masked_kwargs = scope.mask_payload(kwargs)
                masked_options = scope.mask_payload({"model": self.settings.model_name, **self.options})
                schema = scope.mask_payload(self._schema.model_json_schema()) if self._schema else None
                stage = "egress"
                egress_scan(
                    {
                        "input": masked,
                        "options": masked_options,
                        "kwargs": masked_kwargs,
                        "schema": schema,
                    },
                    scope,
                )
                stage = "construct"
                backend = self._backend or _chat_backend(self.settings, masked_options)
                if self._schema is not None:
                    # Keep raw usage for real providers; injected recording fakes
                    # may return a schema directly (usage then explicitly unknown).
                    options = {"include_raw": True} if self._backend is None else {}
                    backend = backend.with_structured_output(
                        schema if self._backend is None else self._schema, method="function_calling", **options
                    )
                stage = "dispatch"
                timeout = self.options.get("timeout", 60.0)
                response = await _chat_attempts(
                    backend,
                    masked,
                    masked_kwargs,
                    scope,
                    timeout,
                    int(self.options.get("max_retries", 2)),
                    str(masked_options["model"]),
                )
                stage = "response_mask"
                if isinstance(response, dict) and "raw" in response:
                    if response.get("parsing_error") is not None or response.get("parsed") is None:
                        raise GatewayError("Provider returned invalid structured data")
                    response = response["parsed"]
                    response = self._schema.model_validate(response)
                if isinstance(response, BaseMessage):
                    # Provider diagnostics cannot escape as response metadata.
                    return response.model_copy(
                        update={
                            "content": scope.mask_response_content(response.content),
                            "additional_kwargs": scope.mask_payload(response.additional_kwargs, wire=True),
                            "tool_calls": scope.mask_payload(response.tool_calls, wire=True),
                            "invalid_tool_calls": scope.mask_payload(response.invalid_tool_calls, wire=True),
                            "response_metadata": {},
                        }
                    )
                return scope.mask_payload(response, wire=True)
            except TimeoutError:
                timed_out = True
            except asyncio.CancelledError:
                cancelled = True
            except Exception:
                failed = True
            # Raise outside the handler: no provider exception chain/body retained.
            if timed_out:
                raise GatewayTimeoutError("Provider request timed out; please try again later")
            if cancelled:
                raise asyncio.CancelledError()
            if failed:
                raise GatewayError("Provider request unavailable; please try again later", stage=stage)


def wrap_chat(backend: Any, **options: Any) -> GatewayChat:
    if isinstance(backend, GatewayChat):
        wrapped = GatewayChat(settings=backend.settings, backend=backend._backend, **(backend.options | options))
        wrapped._schema = backend._schema
        return wrapped
    return GatewayChat(backend=backend, **options)


class UntracedGraph:
    """Protect whole legacy graphs, including demo/CLI entry points.

    These graphs have no checkpointer. A future persistent graph must mask its
    state before checkpointing; disabling tracing does not satisfy that rule.
    """

    def __init__(self, graph: Any) -> None:
        self._graph = graph

    async def ainvoke(self, *args: Any, **kwargs: Any) -> Any:
        with telemetry_policy():
            kwargs["config"] = {"callbacks": []}
            return await self._graph.ainvoke(*args, **kwargs)

    async def astream(self, *args: Any, **kwargs: Any) -> Any:
        with telemetry_policy():
            kwargs["config"] = {"callbacks": []}
            async for update in self._graph.astream(*args, **kwargs):
                yield update


def embedding_call(
    payload: list[str], dispatch: Callable[[list[str]], Any], *, local: bool = False, retries: int = 0
) -> Any:
    with provider_scope() as scope:
        call_id = None
        result = None
        status = "failed"
        failed = False
        try:
            masked = scope.mask_payload(payload)
            egress_scan({"input": masked}, scope)
            for attempt in range(retries + 1):
                call_id = _start("embedding", scope)
                try:
                    result = dispatch(masked)
                    status = "success"
                    break
                except Exception as error:
                    if attempt == retries or not _retryable(error):
                        raise
                    _finish(call_id, "failed", local=local)
                    call_id = None
                time.sleep(min(0.5 * 2**attempt, 8.0))
        except Exception:
            failed = True
        finally:
            if call_id is not None:
                _finish(call_id, status, result, local=local)
        if failed:
            raise GatewayError("Embedding request unavailable; please try again later")
        return result


class GatewayEmbeddings(Embeddings):
    """Only masked inputs reach injected embeddings or the raw OpenAI SDK."""

    def __init__(self, backend: Embeddings | None = None) -> None:
        self._backend = backend

    def _dispatch(self, texts: list[str], query: bool = False) -> Any:
        if self._backend is not None:
            return self._backend.embed_query(texts[0]) if query else self._backend.embed_documents(texts)
        from openai import OpenAI

        settings = get_settings()
        kwargs = {"model": "text-embedding-3-small", "input": texts}
        scope = _scope.get()
        egress_scan(kwargs, scope)
        client = OpenAI(
            api_key=settings.openai_api_key,
            max_retries=0,
            base_url=settings.llm_base_url if "openai.com" in (settings.llm_base_url or "") else None,
        )
        try:
            result = client.embeddings.create(**kwargs)
            return {"vectors": [item.embedding for item in result.data], "usage": result.usage}
        finally:
            client.close()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        result = embedding_call(texts, self._dispatch, retries=2)
        return result["vectors"] if isinstance(result, dict) else result

    def embed_query(self, text: str) -> list[float]:
        result = embedding_call([text], lambda texts: self._dispatch(texts, query=True), retries=2)
        return result["vectors"][0] if isinstance(result, dict) else result


def load_e5_model(model_name: str, device: str) -> Any:
    """Weight downloads contain model config only, never document/query text."""
    from sentence_transformers import SentenceTransformer

    with telemetry_policy():
        try:
            return SentenceTransformer(model_name, device=device, local_files_only=True)
        except Exception:
            return SentenceTransformer(model_name, device=device)


def encode_e5(model: Any, texts: list[str], prefix: str) -> list[list[float]]:
    return embedding_call(
        texts,
        lambda masked: model.encode(
            [prefix + text for text in masked],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        ).tolist(),
        local=True,
    )


class LocalChromaEmbeddings(Embeddings):
    def __init__(self) -> None:
        with telemetry_policy():
            try:
                from fastembed import TextEmbedding

                self._model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
                self._is_fastembed = True
            except Exception:
                from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

                self._ef = DefaultEmbeddingFunction()
                self._is_fastembed = False

    def _dispatch(self, texts: list[str]) -> list[list[float]]:
        if self._is_fastembed:
            return [vec.tolist() for vec in self._model.embed(texts)]
        return self._ef(texts)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return embedding_call(texts, self._dispatch, local=True) if texts else []

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
