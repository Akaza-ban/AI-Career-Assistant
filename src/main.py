import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings
from src.models.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Cấu hình biến môi trường LangSmith cho process nếu được kích hoạt
    if settings.langchain_tracing_v2:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        if settings.langchain_api_key:
            os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
        if settings.langchain_project:
            os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project
        if settings.langchain_endpoint:
            os.environ["LANGCHAIN_ENDPOINT"] = settings.langchain_endpoint

    tracing_status = (
        f"Enabled (Project: {settings.langchain_project})"
        if settings.langchain_tracing_v2 and settings.langchain_api_key
        else "Disabled / Missing Key"
    )

    print("=" * 60)
    print(f"🚀 {settings.app_name} starting in [{settings.app_env}] mode")
    print(f"🤖 LLM Provider: {settings.llm_provider.upper()} (Model: {settings.model_name})")
    print(f"🔍 LangSmith Tracing: {tracing_status}")
    print(f"📖 Swagger Docs: http://localhost:{settings.app_port}/docs")
    print("=" * 60)

    yield

    print(f"🛑 Shutting down {settings.app_name}...")


app = FastAPI(
    title="Trợ lý nghề nghiệp X (EDU-17) - API",
    description=(
        "API Backend cung cấp dịch vụ phân tích khoảng cách CV-JD (Gap Analysis), "
        "phỏng vấn thử theo Rubric STAR (Mock Interview), và Dashboard cố vấn (Advisor HITL)."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

settings = get_settings()

# Cấu hình CORS
cors_list = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký routes với tiền tố /api/v1
app.include_router(router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health() -> HealthResponse:
    """Kiểm tra sức khỏe dịch vụ."""
    return HealthResponse(
        status="ok",
        env=settings.app_env,
        version="1.0.0",
    )


@app.get("/", tags=["System"])
async def root():
    """Trang chủ API - Chuyển tiếp tới Swagger UI."""
    return {
        "app": settings.app_name,
        "status": "running",
        "docs_url": "/docs",
        "api_v1": "/api/v1",
    }
