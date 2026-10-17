"""invoke_json thử lại một lần khi JSON hỏng hoặc hết hạn mức theo phút; trích yêu cầu chỉ dùng phần Yêu cầu của JD."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from openai import RateLimitError

from src.agents.gap_analysis.nodes.retrieve_context import requirements_text
from src.services import llm


def rate_limit(message: str, retry_after: str | None = None) -> RateLimitError:
    headers = {"retry-after": retry_after} if retry_after else {}
    response = httpx.Response(429, headers=headers, request=httpx.Request("POST", "https://api.groq.com"))
    return RateLimitError(message, response=response, body=None)


def fake_model(*replies):
    """Model giả: mỗi lần gọi trả lần lượt một câu trả lời (chuỗi) hoặc ném lỗi."""
    model = SimpleNamespace(
        ainvoke=AsyncMock(side_effect=[r if isinstance(r, Exception) else SimpleNamespace(content=r) for r in replies])
    )
    return patch.object(llm, "get_settings", return_value=SimpleNamespace(get_chat_model=lambda **_: model)), model


@pytest.mark.asyncio
async def test_retries_once_when_json_is_cut_off():
    patcher, model = fake_model('{"requirements": [{"id": "r1", "match": 1', '{"ok": true}')
    with patcher:
        assert await llm.invoke_json("p") == {"ok": True}
    assert model.ainvoke.await_count == 2


@pytest.mark.asyncio
async def test_retries_after_short_rate_limit_wait():
    patcher, model = fake_model(rate_limit("Rate limit reached... Please try again in 2.5s."), '{"ok": 1}')
    with patcher, patch.object(llm.asyncio, "sleep", new=AsyncMock()) as sleep:
        assert await llm.invoke_json("p") == {"ok": 1}
    sleep.assert_awaited_once_with(3.0)


@pytest.mark.asyncio
async def test_gives_up_on_long_rate_limit_wait():
    """Hạn mức theo ngày (chờ hàng phút) thì báo lỗi ngay để dùng phương án dự phòng."""
    patcher, model = fake_model(rate_limit("Please try again in 7m12s."), '{"ok": 1}')
    with patcher, pytest.raises(RateLimitError):
        await llm.invoke_json("p")
    assert model.ainvoke.await_count == 1


@pytest.mark.asyncio
async def test_second_failure_is_raised():
    patcher, _ = fake_model("không có JSON", "vẫn không có")
    with patcher, pytest.raises(ValueError):
        await llm.invoke_json("p")


def test_retry_after_reads_header_and_message():
    assert llm.retry_after_seconds(rate_limit("x", retry_after="4")) == 4.0
    assert llm.retry_after_seconds(rate_limit("Please try again in 1m30.5s")) == 90.5
    assert llm.retry_after_seconds(rate_limit("no hint")) is None


AI_JD = """Thực Tập Sinh AI Engineer
Mô tả công việc
- Viết tài liệu kỹ thuật cơ bản, mô tả luồng xử lý.
- Phối hợp với các bộ phận Business, Product, Backend, Frontend, Data và DevOps.
Yêu cầu ứng viên
- Có kiến thức cơ bản về lập trình, đặc biệt là Python.
- Ưu tiên có kiến thức về chatbot, LLM, automation hoặc pipeline dữ liệu.
Quyền lợi
- Truy cập công cụ AI cao cấp.
"""


def test_requirements_text_keeps_only_requirement_sections():
    text = requirements_text(AI_JD)
    assert "Python" in text and "chatbot, LLM" in text
    assert "Viết tài liệu" not in text and "DevOps" not in text and "công cụ AI cao cấp" not in text


def test_requirements_text_falls_back_to_whole_jd_without_headings():
    jd = "Công ty X tuyển thực tập sinh. Cần biết Python, SQL và Git, ưu tiên Docker."
    assert requirements_text(jd) == jd
