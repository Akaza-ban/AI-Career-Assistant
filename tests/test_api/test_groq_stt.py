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


@pytest.mark.asyncio
async def test_transcribe_rejects_other_students_session(client):
    """session_id phải là buổi phỏng vấn của chính sinh viên (không đọc được JD của buổi người khác)."""
    from sqlalchemy import select

    from src.db.database import SessionLocal
    from src.db.models import InterviewSession, User
    from src.db.seed import DEMO_STUDENT_ID

    with SessionLocal() as db:
        other = db.scalars(
            select(InterviewSession).where(InterviewSession.owner_id != DEMO_STUDENT_ID).limit(1)
        ).first()
        other_id = other.id if other else None
        assert db.scalars(select(User).where(User.id == DEMO_STUDENT_ID)).first() is not None
    files = {"file": ("a.webm", b"RIFF" + b"\x00" * 200, "audio/webm")}
    with patch("src.services.groq_stt.transcribe_with_groq", new_callable=AsyncMock) as mock_stt:
        missing = await client.post("/api/v1/interviews/transcribe?session_id=khong-co", headers=STUDENT, files=files)
        assert missing.status_code == 404
        if other_id:
            res = await client.post(
                f"/api/v1/interviews/transcribe?session_id={other_id}", headers=STUDENT, files=files
            )
            assert res.status_code == 404
        mock_stt.assert_not_called()


@pytest.mark.asyncio
async def test_transcribe_rejects_oversized_audio(client, monkeypatch):
    from src.services import groq_stt

    monkeypatch.setattr(groq_stt, "MAX_AUDIO_BYTES", 1000)
    files = {"file": ("a.webm", b"\x00" * 2000, "audio/webm")}
    res = await client.post("/api/v1/interviews/transcribe", headers=STUDENT, files=files)
    assert (res.status_code, res.json()["code"]) == (413, "audio_too_large")


@pytest.mark.asyncio
async def test_transcribe_without_groq_key_is_unavailable(client, monkeypatch):
    from src.config import get_settings

    monkeypatch.setattr(get_settings(), "groq_api_key", "")
    files = {"file": ("a.webm", b"RIFF" + b"\x00" * 200, "audio/webm")}
    res = await client.post("/api/v1/interviews/transcribe", headers=STUDENT, files=files)
    assert (res.status_code, res.json()["code"]) == (503, "voice_unavailable")


@pytest.mark.asyncio
async def test_transcribe_hides_provider_error_body(client, monkeypatch):
    """Lỗi từ Groq chỉ ghi log máy chủ; trình duyệt nhận thông báo tiếng Việt, không có lời lỗi gốc."""
    import httpx

    from src.config import get_settings
    from src.services import groq_stt

    monkeypatch.setattr(get_settings(), "groq_api_key", "gsk-test")

    class FakeGroq:
        """Thay httpx.AsyncClient chỉ trong groq_stt (client của test vẫn là httpx thật)."""

        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, **kwargs):
            return httpx.Response(
                400, text='{"error": {"message": "secret internal detail"}}', request=httpx.Request("POST", url)
            )

    monkeypatch.setattr(groq_stt.httpx, "AsyncClient", FakeGroq)
    files = {"file": ("a.webm", b"RIFF" + b"\x00" * 200, "audio/webm")}
    res = await client.post("/api/v1/interviews/transcribe", headers=STUDENT, files=files)
    assert res.status_code == 502 and "secret" not in res.text
    assert groq_stt.voice_input_enabled() is True


def test_prompt_keeps_tail_of_previous_text():
    from src.services.groq_stt import PREVIOUS_TEXT_CHARS, build_prompt

    assert build_prompt("Phỏng vấn vị trí Backend.", None) == "Phỏng vấn vị trí Backend."
    previous = "đầu câu " + "x" * 500 + " cuối câu"
    prompt = build_prompt("Phỏng vấn vị trí Backend.", previous)
    assert prompt.startswith("Phỏng vấn vị trí Backend. ") and prompt.endswith("cuối câu")
    assert len(prompt) <= len("Phỏng vấn vị trí Backend. ") + PREVIOUS_TEXT_CHARS


@pytest.mark.asyncio
async def test_transcribe_passes_previous_segment_text(client):
    """Ghi âm theo đoạn: chữ của các đoạn trước được gửi kèm làm ngữ cảnh."""
    with patch("src.services.groq_stt.transcribe_with_groq", new_callable=AsyncMock) as mock_stt:
        mock_stt.return_value = "đoạn tiếp theo"
        res = await client.post(
            "/api/v1/interviews/transcribe",
            headers=STUDENT,
            files={"file": ("a.webm", b"RIFF" + bytes(200), "audio/webm")},
            data={"previous": "Ở kỳ thực tập vừa rồi"},
        )
    assert res.json() == {"text": "đoạn tiếp theo"}
    assert mock_stt.await_args.kwargs["previous_text"] == "Ở kỳ thực tập vừa rồi"


def test_clean_transcript_drops_whisper_hallucinations():
    from src.services.groq_stt import clean_transcript

    assert clean_transcript("Tạm biệt!") == ""
    assert clean_transcript("Hẹn gặp lại các bạn trong những video tiếp theo.") == ""
    assert clean_transcript(" Em đã tối ưu truy vấn SQL. ") == "Em đã tối ưu truy vấn SQL."
    assert (
        clean_transcript("Tạm biệt đội cũ, em chuyển sang dự án mới.") == "Tạm biệt đội cũ, em chuyển sang dự án mới."
    )
