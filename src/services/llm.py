import asyncio
import hashlib
import json
import re
from time import monotonic
from typing import Any
from urllib.parse import urlsplit

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from src.config import get_settings

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


def get_llm() -> ChatOpenAI:
    return get_settings().get_chat_model()


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


async def check_llm_health() -> dict[str, Any]:
    """Probe the configured model once per TTL, sharing concurrent health checks."""
    global _llm_health_cache
    settings = get_settings()
    if not llm_configured():
        return {
            "status": "offline",
            "provider": "none",
            "model": settings.model_name,
            "is_live": False,
            "message": "Chưa cấu hình API Key hoặc dùng key mẫu",
        }

    api_key, base_url = settings.get_llm_credentials()
    hostname = urlsplit(base_url).hostname
    provider = {
        "api.groq.com": "groq",
        "openrouter.ai": "openrouter",
        "api.openai.com": "openai",
    }.get(hostname, settings.llm_provider)
    # Invalidate immediately when credentials, endpoint or model change.
    signature = hashlib.sha256(
        json.dumps([api_key, base_url, settings.model_name, provider]).encode("utf-8")
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
            "model": settings.model_name,
            "is_live": False,
            "message": "",
        }
        try:
            llm = settings.get_chat_model(
                timeout=LLM_HEALTH_TIMEOUT_SECONDS,
                max_retries=0,
                max_tokens=8,
            )
            await asyncio.wait_for(
                llm.ainvoke([HumanMessage(content="ping")]),
                timeout=LLM_HEALTH_TIMEOUT_SECONDS,
            )
            result.update(status="live", is_live=True)
        except TimeoutError:
            result["message"] = "LLM không phản hồi trong 3 giây. Đang dùng chế độ dự phòng."
        except Exception as exc:
            # Provider error bodies can echo credentials; expose only the error class.
            result["message"] = f"Không kết nối được LLM ({type(exc).__name__}). Đang dùng chế độ dự phòng."
        _llm_health_cache = (signature, monotonic(), result)
        return dict(result)


async def invoke_json(prompt: str, *, temperature: float = 0.1, timeout: float = 60.0) -> dict[str, Any]:
    """Gọi LLM một lần và trả về object JSON trong câu trả lời; báo lỗi nếu hết giờ hoặc không có JSON hợp lệ."""
    llm = get_settings().get_chat_model(temperature=temperature)
    response = await asyncio.wait_for(llm.ainvoke(prompt), timeout=timeout)
    content = response.content if isinstance(response.content, str) else str(response.content)
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError(f"LLM không trả về JSON: {content[:200]}")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("JSON trả về không phải object")
    return data
