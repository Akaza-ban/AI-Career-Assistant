import pytest
from pydantic import ValidationError

from src.config import Settings


def test_llm_environment_configuration_and_bounds(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-secret")
    monkeypatch.setenv("LLM_MODEL_AGENT", "agent-model")
    monkeypatch.setenv("LLM_REASONING_EFFORT", "max")
    monkeypatch.setenv("LLM_MAX_RETRIES", "3")
    configured = Settings(_env_file=None)
    assert configured.llm_api_key.get_secret_value() == "test-secret"
    assert "test-secret" not in repr(configured)
    assert (configured.llm_model_agent, configured.llm_reasoning_effort, configured.llm_max_retries) == (
        "agent-model",
        "max",
        3,
    )
    for values in ({"llm_timeout_s": 0}, {"llm_max_retries": -1}, {"workers": 2}, {"agent_max_steps": 0}):
        with pytest.raises(ValidationError):
            Settings(_env_file=None, app_env="test", **values)


def test_section_14_defaults(monkeypatch):
    for env_var in (
        "LLM_MODEL_AGENT",
        "LLM_MODEL_ROUTER",
        "LLM_THINKING_AGENT",
        "LLM_REASONING_EFFORT",
        "AGENT_MAX_STEPS",
        "AGENT_MAX_TOOL_CALLS",
        "AGENT_CONFIRM_TTL_MIN",
        "UI_ACK_TIMEOUT_S",
        "WORKERS",
        "TRACE_BACKEND",
    ):
        monkeypatch.delenv(env_var, raising=False)
    config = Settings(_env_file=None)
    assert (config.llm_model_agent, config.llm_model_router) == ("deepseek-flash", "deepseek-flash")
    assert (config.llm_thinking_agent, config.llm_reasoning_effort) == ("disabled", "high")
    assert (config.agent_max_steps, config.agent_max_tool_calls, config.agent_confirm_ttl_min) == (8, 12, 30)
    assert config.ui_ack_timeout_s == 5 and config.workers == 1
    assert config.trace_backend == "none"
