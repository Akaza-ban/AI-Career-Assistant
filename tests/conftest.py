import os
import tempfile
from pathlib import Path

# Test dùng file SQLite và thư mục upload tạm, không đụng data/.
# Phải đặt trước khi import app vì engine được tạo lúc import src.db.database.
_TMP = Path(tempfile.mkdtemp())
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_TMP / "uploads")
# Test tự tạo dữ liệu cần dùng; không nạp nhóm SV giả định của bản demo.
os.environ["SEED_DEMO_COHORT"] = "false"

# Không gọi LLM thật khi chạy test (chậm, tốn credit): key rỗng → agent dùng quy tắc dự phòng.
# Biến môi trường được ưu tiên hơn file .env nên ghi đè được key thật trong .env.
for _key in ("GROQ_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "LANGCHAIN_API_KEY"):
    os.environ[_key] = ""
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from unittest.mock import AsyncMock  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from src.db.database import init_db  # noqa: E402
from src.main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing API endpoints."""
    # ASGITransport không chạy lifespan của app nên tự tạo bảng và dữ liệu demo ở đây.
    init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_llm():
    """Mock LLM to avoid calling OpenAI during tests.

    Usage in test:
        def test_something(mock_llm):
            # LLM calls will return mock response instead of hitting OpenAI
            ...
    """
    mock = AsyncMock()
    mock.ainvoke.return_value = AsyncMock(content="Mocked LLM response")
    return mock
