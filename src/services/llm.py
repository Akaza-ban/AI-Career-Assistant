import asyncio
import hashlib
import json
import re
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

from langchain_core.messages import HumanMessage

from src.config import get_settings
from src.services.providers.gateway import GatewayChat, GatewayError, PreparedPayload, provider_scope, wrap_chat
from src.services.providers.llm_client import LlmClient

# Tiền tố của key mẫu trong .env.example; key như vậy coi như chưa cấu hình LLM.
_PLACEHOLDER_PREFIXES = (
    "your-",
    "your_",
    "sk-dummy",
    "gsk_your",
    "sk-or-v1-your",
    "sk-your",
    "sk-placeholder",
    "gsk_placeholder",
)
LLM_HEALTH_TTL_SECONDS = 30.0
LLM_HEALTH_TIMEOUT_SECONDS = 3.0
_llm_health_cache: tuple[str, float, dict[str, Any]] | None = None
_llm_health_lock = asyncio.Lock()


def get_llm() -> GatewayChat:
    return get_settings().get_chat_model()


def get_assistant_llm() -> LlmClient:
    """The assistant uses the raw SDK through the shared outbound gateway."""
    return LlmClient(settings=get_settings())


def assistant_llm_configured() -> bool:
    key = get_settings().llm_api_key.get_secret_value().strip().casefold()
    return (
        bool(key)
        and not key.startswith(_PLACEHOLDER_PREFIXES)
        and key not in {"changeme", "placeholder", "none", "dummy"}
    )


def llm_configured() -> bool:
    """Có API key thật cho provider đang chọn hay không (key rỗng hoặc key mẫu → False)."""
    api_key, _ = get_settings().get_llm_credentials()
    api_key = api_key.strip().casefold()
    return (
        bool(api_key)
        and not api_key.startswith(_PLACEHOLDER_PREFIXES)
        and api_key
        not in {
            "changeme",
            "placeholder",
            "none",
            "dummy",
        }
    )


async def check_llm_health(*, assistant: bool = False) -> dict[str, Any]:
    """Probe the configured model once per TTL, sharing concurrent health checks."""
    global _llm_health_cache
    settings = get_settings()
    model_name = settings.llm_model_agent if assistant else settings.model_name
    if not (assistant_llm_configured() if assistant else llm_configured()):
        return {
            "status": "offline",
            "provider": "none",
            "model": model_name,
            "is_live": False,
            "message": "Chưa cấu hình API Key hoặc dùng key mẫu",
        }

    api_key, base_url = (
        (settings.llm_api_key.get_secret_value(), settings.llm_base_url or "https://api.deepseek.com")
        if assistant
        else settings.get_llm_credentials()
    )
    hostname = urlsplit(base_url).hostname
    provider = {
        "api.groq.com": "groq",
        "openrouter.ai": "openrouter",
        "api.openai.com": "openai",
        "api.deepseek.com": "deepseek",
    }.get(hostname, settings.llm_provider)
    # Invalidate immediately when credentials, endpoint or model change.
    signature = hashlib.sha256(
        json.dumps([api_key, base_url, model_name, provider, assistant]).encode("utf-8")
    ).hexdigest()
    async with _llm_health_lock:
        if (
            _llm_health_cache is not None
            and _llm_health_cache[0] == signature
            and monotonic() - _llm_health_cache[1] < LLM_HEALTH_TTL_SECONDS
        ):
            return dict(_llm_health_cache[2])
        result: dict[str, Any] = {
            "status": "offline",
            "provider": provider,
            "model": model_name,
            "is_live": False,
            "message": "",
        }
        try:
            if assistant:
                with provider_scope(mask_only=True):
                    client = LlmClient(
                        settings=settings.model_copy(
                            update={"llm_timeout_s": LLM_HEALTH_TIMEOUT_SECONDS, "llm_max_retries": 0}
                        )
                    )
                    try:
                        await client.chat([{"role": "user", "content": "ping"}], thinking=False, max_tokens=8)
                    finally:
                        await client.aclose()
            else:
                llm = settings.get_chat_model(timeout=LLM_HEALTH_TIMEOUT_SECONDS, max_retries=0, max_tokens=8)
                await asyncio.wait_for(
                    wrap_chat(llm, timeout=LLM_HEALTH_TIMEOUT_SECONDS).ainvoke([HumanMessage(content="ping")]),
                    timeout=LLM_HEALTH_TIMEOUT_SECONDS,
                )
            result.update(status="live", is_live=True)
        except TimeoutError:
            result["message"] = "LLM không phản hồi trong 3 giây. Đang dùng chế độ dự phòng."
        except Exception:
            # Provider error bodies can echo credentials; expose only the error class.
            result["message"] = "Không kết nối được LLM. Đang dùng chế độ dự phòng."
        _llm_health_cache = (signature, monotonic(), result)
        return dict(result)


async def invoke_json(
    prompt: str | PreparedPayload, *, temperature: float = 0.1, timeout: float = 60.0
) -> dict[str, Any]:
    """Gọi LLM một lần và trả về object JSON trong câu trả lời; báo lỗi nếu hết giờ hoặc không có JSON hợp lệ."""
    with provider_scope() as scope:
        llm = get_settings().get_chat_model(temperature=temperature, timeout=timeout)
        response = await wrap_chat(llm, timeout=timeout).ainvoke(prompt)
        data = None
        try:
            content = response.content if isinstance(response.content, str) else str(response.content)
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match is not None:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, dict):
                    # This helper's callers consume business records, never traces.
                    data = scope.restore_business(parsed)
        except Exception:
            pass
        if data is None:
            raise GatewayError("LLM không trả về JSON object hợp lệ")
        return data
