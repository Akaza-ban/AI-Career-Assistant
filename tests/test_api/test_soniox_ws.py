from starlette.testclient import TestClient

from src.main import app
from src.services.soniox_stt import build_soniox_config


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
    with client.websocket_connect("/api/v1/interviews/ws/transcribe") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "SONIOX_API_KEY" in data["message"]
