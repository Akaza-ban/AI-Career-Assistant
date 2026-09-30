import os
from functools import lru_cache
from typing import Any, Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file explicitly so os.environ is populated early
load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    app_name: str = "Trợ lý nghề nghiệp X (EDU-17)"
    app_env: Literal["development", "production", "test"] = "development"
    app_port: int = Field(default=8000, ge=1, le=65535)
    app_host: str = "0.0.0.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # LLM Provider Configuration (Groq / OpenRouter / OpenAI)
    llm_provider: Literal["groq", "openrouter", "openai"] = Field(
        default="groq",
        description="LLM provider: groq, openrouter, hoặc openai",
    )
    groq_api_key: str = Field(default="", description="API key cho Groq")
    openrouter_api_key: str = Field(default="", description="API key cho OpenRouter")
    openai_api_key: str = Field(default="", description="API key cho OpenAI")

    model_name: str = Field(
        default="openai/gpt-oss-120b",
        description="Tên model LLM mặc định",
    )
    llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    llm_base_url: str | None = Field(
        default=None,
        description="Tùy chỉnh base URL nếu có proxy hoặc endpoint riêng",
    )

    # LangSmith Tracing (AI Logs - Deliverable #4)
    langchain_tracing_v2: bool = Field(default=True, description="Bật tracing LangSmith")
    langchain_api_key: str = Field(default="", description="LangSmith API Key")
    langchain_project: str = Field(default="ai20k-p131", description="Tên project trên LangSmith")
    langchain_endpoint: str = Field(
        default="https://api.smith.langchain.com",
        description="LangSmith API Endpoint",
    )

    # Database
    database_url: str = "sqlite:///./data/app.db"

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"

    def get_llm_credentials(self) -> tuple[str, str]:
        """
        Lấy (api_key, base_url) dựa theo provider đang được kích hoạt.
        Hỗ trợ fallback tự động nếu key của provider ưu tiên chưa được set.
        """
        provider = self.llm_provider.lower()
        if provider == "groq":
            api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "")
            base_url = self.llm_base_url or "https://api.groq.com/openai/v1"
            if not api_key and (self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")):
                api_key = self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
                base_url = self.llm_base_url or "https://openrouter.ai/api/v1"
            elif not api_key and (self.openai_api_key or os.getenv("OPENAI_API_KEY")):
                api_key = self.openai_api_key or os.getenv("OPENAI_API_KEY", "")
                base_url = self.llm_base_url or "https://api.openai.com/v1"
            return api_key, base_url

        if provider == "openrouter":
            api_key = self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
            base_url = self.llm_base_url or "https://openrouter.ai/api/v1"
            if not api_key and (self.groq_api_key or os.getenv("GROQ_API_KEY")):
                api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "")
                base_url = self.llm_base_url or "https://api.groq.com/openai/v1"
            return api_key, base_url

        # Mặc định OpenAI
        api_key = self.openai_api_key or os.getenv("OPENAI_API_KEY", "")
        base_url = self.llm_base_url or "https://api.openai.com/v1"
        return api_key, base_url

    def get_chat_model(self, **kwargs: Any):
        """Khởi tạo Chat Model tương thích OpenAI API (hỗ trợ Groq, OpenRouter, OpenAI)."""
        from langchain_openai import ChatOpenAI

        api_key, base_url = self.get_llm_credentials()
        temperature = kwargs.pop("temperature", self.llm_temperature)
        model = kwargs.pop("model", self.model_name)

        return ChatOpenAI(
            model=model,
            api_key=api_key or "sk-dummy-key-for-init",
            base_url=base_url,
            temperature=temperature,
            **kwargs,
        )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Đồng bộ hóa biến môi trường cho LangSmith
    has_valid_key = bool(settings.langchain_api_key and not settings.langchain_api_key.startswith("your-"))
    if settings.langchain_tracing_v2 and has_valid_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
        if settings.langchain_project:
            os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project
        if settings.langchain_endpoint:
            os.environ["LANGCHAIN_ENDPOINT"] = settings.langchain_endpoint
    elif not has_valid_key and os.getenv("LANGCHAIN_API_KEY", "").startswith("your-"):
        os.environ["LANGCHAIN_TRACING_V2"] = "false"

    return settings
