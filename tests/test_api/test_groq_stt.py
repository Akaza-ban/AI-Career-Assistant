from unittest.mock import AsyncMock, patch

import pytest

from tests.helpers import STUDENT


@pytest.mark.asyncio
async def test_transcribe_audio_success(client):
    fake_audio = b"RIFF" + b"\x00" * 200

    with patch("src.services.groq_stt.transcribe_with_groq", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = "Tôi có kinh nghiệm lập trình backend với Python và FastAPI."

        files = {"file": ("test.webm", fake_audio, "audio/webm")}
        response = await client.post(
            "/api/v1/interviews/transcribe",
            headers=STUDENT,
            files=files,
        )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert data["text"] == "Tôi có kinh nghiệm lập trình backend với Python và FastAPI."


@pytest.mark.asyncio
async def test_transcribe_audio_unauthenticated(client):
    fake_audio = b"RIFF" + b"\x00" * 200
    files = {"file": ("test.webm", fake_audio, "audio/webm")}
    response = await client.post(
        "/api/v1/interviews/transcribe",
        files=files,
    )
    assert response.status_code == 401
