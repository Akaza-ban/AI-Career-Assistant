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

    # LLM Provider Configuration (DeepSeek / Groq / OpenRouter / OpenAI)
    llm_provider: Literal["deepseek", "groq", "openrouter", "openai"] = Field(
        default="groq",
        description="LLM provider: deepseek, groq, openrouter, hoặc openai",
    )
    deepseek_api_key: str = Field(default="", description="API key cho DeepSeek")
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

    # Soniox Speech-to-Text (Voice Transcribe)
    soniox_api_key: str = Field(default="", description="API key cho Soniox Speech-to-Text")
    soniox_model: str = Field(default="stt-rt-v5", description="Model Soniox STT mặc định")
    soniox_ws_url: str = Field(
        default="wss://stt-rt.soniox.com/transcribe-websocket",
        description="Soniox WebSocket endpoint",
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

    # Thư mục lưu file CV gốc do sinh viên tải lên
    upload_dir: str = "./data/uploads"

    # Tạo nhóm SV giả định do cố vấn demo phụ trách (dữ liệu minh hoạ cho các trang Cố vấn)
    seed_demo_cohort: bool = True

    # Tài khoản: phiên đăng nhập lưu trong cookie HttpOnly
    session_cookie_name: str = "careerx_session"
    session_days: int = Field(default=30, ge=1, le=365)
    # Bật trên môi trường HTTPS (cookie chỉ gửi qua kết nối an toàn)
    session_cookie_secure: bool = False
    # Vào bằng header X-Demo-Role thay cho đăng nhập (chỉ dùng cho test tự động). Frontend luôn đăng nhập,
    # kể cả tài khoản demo, nên mặc định tắt.
    demo_login_enabled: bool = False
    # Mật khẩu đặt cho 2 tài khoản demo (để thử trang Đăng nhập). Để trống thì không đăng nhập được bằng mật khẩu.
    demo_account_password: str = "careerx123"
    # Nhập sai mật khẩu quá số lần này thì tạm khoá trong login_lock_minutes phút
    login_max_attempts: int = 5
    login_lock_minutes: int = 15
    password_reset_minutes: int = 30

    # Địa chỉ frontend, dùng để tạo link đặt lại mật khẩu trong email
    frontend_url: str = "http://localhost:3000"
    # SMTP gửi email. Để trống smtp_host thì không gửi, chỉ ghi link vào log (môi trường phát triển).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "CareerV <no-reply@careerx.vn>"
    smtp_starttls: bool = True

    # Dung lượng lưu CV cho mỗi sinh viên
    storage_limit_mb: int = 50

    # Vector Store
    chroma_persist_dir: str = "./data/chroma"

    # Assistant & Knowledge Base RAG
    assistant_chroma_collection: str = "assistant_knowledge"
    assistant_chroma_persist_dir: str = "./data/chroma_assistant"
    assistant_embedding_model: str = "intfloat/multilingual-e5-small"
    assistant_embedding_device: str = "cpu"
    assistant_docs_dir: str = "./docs/user-guide"
    assistant_top_k: int = 5
    assistant_similarity_threshold: float = Field(default=0.35, ge=0.0, le=1.0)
    assistant_llm_timeout_seconds: float = Field(default=30.0, gt=0.0, le=120.0)
    assistant_history_turns: int = Field(default=6, ge=0, le=20)

    def get_llm_credentials(self) -> tuple[str, str]:
        """
        Lấy (api_key, base_url) dựa theo provider đang được kích hoạt.
        Hỗ trợ fallback tự động nếu key của provider ưu tiên chưa được set.
        """
        provider = self.llm_provider.lower()
        if provider == "deepseek":
            api_key = self.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", "")
            base_url = self.llm_base_url or "https://api.deepseek.com"
            return api_key, base_url

        if provider == "groq":
            api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "")
            base_url = self.llm_base_url or "https://api.groq.com/openai/v1"
            if not api_key and (self.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")):
                api_key = self.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", "")
                base_url = self.llm_base_url or "https://api.deepseek.com"
            elif not api_key and (self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")):
                api_key = self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
                base_url = self.llm_base_url or "https://openrouter.ai/api/v1"
            elif not api_key and (self.openai_api_key or os.getenv("OPENAI_API_KEY")):
                api_key = self.openai_api_key or os.getenv("OPENAI_API_KEY", "")
                base_url = self.llm_base_url or "https://api.openai.com/v1"
            return api_key, base_url

        if provider == "openrouter":
            api_key = self.openrouter_api_key or os.getenv("OPENROUTER_API_KEY", "")
            base_url = self.llm_base_url or "https://openrouter.ai/api/v1"
            if not api_key and (self.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY")):
                api_key = self.deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", "")
                base_url = self.llm_base_url or "https://api.deepseek.com"
            elif not api_key and (self.groq_api_key or os.getenv("GROQ_API_KEY")):
                api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "")
                base_url = self.llm_base_url or "https://api.groq.com/openai/v1"
            return api_key, base_url

        # Mặc định OpenAI
        api_key = self.openai_api_key or os.getenv("OPENAI_API_KEY", "")
        base_url = self.llm_base_url or "https://api.openai.com/v1"
        return api_key, base_url

    def get_chat_model(self, **kwargs: Any):
        """Khởi tạo Chat Model tương thích OpenAI API (hỗ trợ DeepSeek, Groq, OpenRouter, OpenAI)."""
        import httpx
        from langchain_openai import ChatOpenAI

        api_key, base_url = self.get_llm_credentials()
        temperature = kwargs.pop("temperature", self.llm_temperature)
        default_model = "deepseek-chat" if self.llm_provider.lower() == "deepseek" else self.model_name
        model = kwargs.pop("model", default_model)

        return ChatOpenAI(
            model=model,
            api_key=api_key or "sk-dummy-key-for-init",
            base_url=base_url,
            temperature=temperature,
            http_async_client=httpx.AsyncClient(),
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
