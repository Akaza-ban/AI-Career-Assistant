import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from src.agents.graph import agent
from src.api import advisor as advisor_routes
from src.api import analysis as analysis_routes
from src.api import assistant as assistant_routes
from src.api import auth as auth_routes
from src.api import cv as cv_routes
from src.api import feedback as feedback_routes
from src.api import interviews as interview_routes
from src.api import messages as message_routes
from src.api import optimizer as optimizer_routes
from src.api import sharing as sharing_routes
from src.api import students as student_routes
from src.api.deps import CurrentUser
from src.config import get_settings
from src.db.models import User
from src.models.schemas import AgentStatusResponse, ChatRequest, ChatResponse, UserProfile

router = APIRouter()
router.include_router(auth_routes.router)
router.include_router(cv_routes.router)
router.include_router(analysis_routes.router)
router.include_router(feedback_routes.router)
router.include_router(interview_routes.router)
router.include_router(optimizer_routes.router)
router.include_router(student_routes.router)
router.include_router(sharing_routes.router)
router.include_router(advisor_routes.router)
router.include_router(message_routes.router)
router.include_router(assistant_routes.router)


# ============================================================================
# 1. System & Health Routes
# ============================================================================


@router.get("/status", response_model=AgentStatusResponse, tags=["System"])
async def agent_status() -> AgentStatusResponse:
    """Kiểm tra trạng thái agent, LLM provider và cấu hình LangSmith."""
    settings = get_settings()
    return AgentStatusResponse(
        status="ready",
        agent="Trợ lý nghề nghiệp X - LangGraph Agent",
        llm_provider=settings.llm_provider,
        model_name=settings.model_name,
        langsmith_tracing=bool(settings.langchain_tracing_v2 and settings.langchain_api_key),
    )


@router.get("/me", response_model=UserProfile, tags=["Auth"])
def get_me(user: CurrentUser) -> User:
    """Hồ sơ người dùng được xác thực bằng phiên đăng nhập."""
    return user


# ============================================================================
# 2. General Chat Route
# ============================================================================


@router.post("/chat", response_model=ChatResponse, tags=["General Chat"])
async def chat(request: ChatRequest, user: CurrentUser) -> ChatResponse:
    """Chat với AI agent hỗ trợ định hướng chung."""
    try:
        result = await agent.ainvoke({"query": request.message})
        return ChatResponse(
            response=result.get("response", ""),
            conversation_id=request.conversation_id or str(uuid.uuid4()),
            analysis=result.get("analysis", ""),
            sources=[],
            timestamp=datetime.now(),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xử lý hội thoại: {e!s}",
        )
