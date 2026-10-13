import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from src.main import app
from src.services.soniox_stt import build_soniox_config
from tests.helpers import ADVISOR, STUDENT


def test_build_soniox_config_defaults():
    config = build_soniox_config(None, None)
    assert config["model"] == "stt-rt-v5"
    assert config["audio_format"] == "pcm_s16le"
    assert config["sample_rate"] == 16000
    assert config["num_channels"] == 1
    assert "vi" in config["language_hints"]
    assert config["enable_language_identification"] is True


def test_ws_transcribe_missing_key_returns_error(monkeypatch):
    from src.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "soniox_api_key", "")

    client = TestClient(app)
    with client.websocket_connect("/api/v1/interviews/ws/transcribe", headers=STUDENT) as websocket:
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "SONIOX_API_KEY" in data["message"]


@pytest.mark.parametrize("headers", [{}, ADVISOR])
def test_ws_transcribe_requires_signed_in_student(headers):
    """Key Soniox của máy chủ chỉ dành cho sinh viên đã đăng nhập."""
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect("/api/v1/interviews/ws/transcribe", headers=headers) as websocket:
            websocket.receive_json()
    assert closed.value.code == 4401


def test_ws_transcribe_rejects_other_students_session():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect(
            "/api/v1/interviews/ws/transcribe?session_id=iv_not_mine", headers=STUDENT
        ) as websocket:
            websocket.receive_json()
    assert closed.value.code == 4401


def test_build_soniox_config_with_session_and_jd():
    from src.db.database import SessionLocal, init_db
    from src.db.models import InterviewSession, JobDescription

    init_db()
    db = SessionLocal()
    try:
        jd = JobDescription(
            id="jd_test_soniox",
            source="library",
            title="Backend Python Developer",
            content="Tuyển lập trình viên Backend Python",
            skills=[
                {"name": "Python", "importance": "required"},
                {"name": "FastAPI", "importance": "required"},
                {"name": "Docker", "importance": "preferred"},
            ],
        )
        db.merge(jd)

        session = InterviewSession(
            id="iv_test_soniox",
            owner_id="user_test",
            jd_id="jd_test_soniox",
            cv_version_id="cv_test",
            cv_file_name="cv.pdf",
            interview_mode="with_cv",
            status="in_progress",
        )
        db.merge(session)
        db.commit()

        config = build_soniox_config("iv_test_soniox", db)
        assert "context" in config
        assert "general" in config["context"]
        items = config["context"]["general"]
        assert any("Backend Python Developer" in it["value"] for it in items)
        assert any("Python, FastAPI, Docker" in it["value"] for it in items)
    finally:
        db.close()
