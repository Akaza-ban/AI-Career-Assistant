"""reasoning_effort chỉ gửi cho model có suy luận; model khác giữ nguyên để không bị lỗi 400."""

import pytest

from src.config import Settings, is_reasoning_model


@pytest.mark.parametrize(
    ("model", "expected"),
    [
        ("openai/gpt-oss-120b", True),
        ("gpt-oss-20b", True),
        ("o3-mini", True),
        ("gpt-5-mini", True),
        ("llama-3.3-70b-versatile", False),
        ("deepseek-chat", False),
        ("gemini-2.5-flash", False),
    ],
)
def test_is_reasoning_model(model, expected):
    assert is_reasoning_model(model) is expected


def test_chat_model_sets_low_reasoning_only_for_reasoning_models():
    settings = Settings(llm_provider="groq", groq_api_key="gsk-test", llm_reasoning_effort="low")
    assert settings.get_chat_model(model="openai/gpt-oss-120b").reasoning_effort == "low"
    assert settings.get_chat_model(model="llama-3.3-70b-versatile").reasoning_effort is None
    assert Settings(llm_reasoning_effort="").get_chat_model(model="openai/gpt-oss-120b").reasoning_effort is None
