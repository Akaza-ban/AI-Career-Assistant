import asyncio
import json
import re
from typing import Any

from langchain_openai import ChatOpenAI

from src.config import get_settings

# Tiền tố của key mẫu trong .env.example; key như vậy coi như chưa cấu hình LLM.
_PLACEHOLDER_PREFIXES = ("your-", "sk-dummy", "gsk_your", "sk-or-v1-your", "sk-your")


def get_llm() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.openai_api_key,
        temperature=settings.llm_temperature,
    )


def llm_configured() -> bool:
    """Có API key thật cho provider đang chọn hay không (key rỗng hoặc key mẫu → False)."""
    api_key, _ = get_settings().get_llm_credentials()
    return bool(api_key) and not api_key.startswith(_PLACEHOLDER_PREFIXES)


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
