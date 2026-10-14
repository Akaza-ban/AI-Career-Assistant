"""Trình tối ưu CV của một lượt phân tích (US-SV-03, US-SV-05): gợi ý, kiểm tra kỹ năng thiếu, tạo phiên bản mới."""

from typing import Any

from fastapi import APIRouter

from src.api import cv as cv_routes
from src.api.deps import CurrentStudent, DbSession
from src.db.models import User, utcnow
from src.models.schemas import (
    CapabilityAnswerRequest,
    OptimizerSessionResponse,
    SuggestionContextRequest,
    SuggestionDecisionRequest,
)
from src.services import cv_optimizer

router = APIRouter(prefix="/gap-analysis/{analysis_id}/optimizer", tags=["CV Optimizer"])


def _response(db: DbSession, user: User, analysis_id: str) -> dict[str, Any]:
    data = cv_optimizer.session(db, user, analysis_id)
    latest = cv_routes.latest_analyses(db, user.id)
    for key in ("cv", "result_cv"):
        if data[key] is not None:
            data[key] = cv_routes.to_response(data[key], latest.get(data[key].id))
    return data


@router.get("", response_model=OptimizerSessionResponse)
def get_optimizer(analysis_id: str, user: CurrentStudent, db: DbSession) -> dict[str, Any]:
    """
    Nội dung CV, các gợi ý diễn đạt lại (kèm quyết định hiện tại) và các kỹ năng thiếu cần SV tự xác nhận.
    Chỉ mở được khi lượt phân tích đã hoàn tất và phiên bản CV đó còn tồn tại.
    """
    return _response(db, user, analysis_id)


@router.post("/suggestions/{suggestion_id}", response_model=OptimizerSessionResponse)
def decide_suggestion(
    analysis_id: str, suggestion_id: str, body: SuggestionDecisionRequest, user: CurrentStudent, db: DbSession
) -> dict[str, Any]:
    """
    Chấp nhận / sửa tay / bỏ qua một gợi ý, hoặc hoàn tác (undo) về chờ duyệt. Quyết định chỉ nằm trong bản nháp,
    chưa tạo phiên bản CV mới; mỗi quyết định được ghi Audit Trail (PRD mục 6.5).
    """
    cv_optimizer.decide(db, user, analysis_id, suggestion_id, body.decision, body.edited_text, utcnow())
    return _response(db, user, analysis_id)


@router.post("/suggestions/{suggestion_id}/context", response_model=OptimizerSessionResponse)
async def provide_suggestion_context(
    analysis_id: str, suggestion_id: str, body: SuggestionContextRequest, user: CurrentStudent, db: DbSession
) -> dict[str, Any]:
    """
    US-SV-03 AC2: SV bổ sung số liệu thật cho gợi ý còn chỗ trống [ ]. Câu đề xuất được điền lại chỉ bằng thông tin
    SV cung cấp (LLM nếu có, kèm kiểm tra không thêm số mới; không có LLM thì điền theo quy tắc).
    """
    await cv_optimizer.provide_context(db, user, analysis_id, suggestion_id, body.answer, utcnow())
    return _response(db, user, analysis_id)


@router.post("/capability-checks/{requirement_id}", response_model=OptimizerSessionResponse)
def answer_capability_check(
    analysis_id: str, requirement_id: str, body: CapabilityAnswerRequest, user: CurrentStudent, db: DbSession
) -> dict[str, Any]:
    """
    SV xác nhận đã có hoặc chưa có kinh nghiệm với một kỹ năng JD yêu cầu mà CV chưa thể hiện. AI không tự thêm kỹ năng
    vào CV; ghi chú "đang học" (nếu có) chỉ vào mục Kỹ năng đang phát triển của phiên bản mới.
    """
    cv_optimizer.answer_check(
        db, user, analysis_id, requirement_id, body.has_experience, body.context, body.learning_note, utcnow()
    )
    return _response(db, user, analysis_id)


@router.post("/finalize", response_model=OptimizerSessionResponse)
def finalize_optimization(analysis_id: str, user: CurrentStudent, db: DbSession) -> dict[str, Any]:
    """
    Tạo đúng một phiên bản CV mới (version = bản lớn nhất + 1) từ bản nháp, kèm file DOCX bố cục đơn giản.
    Bản cũ giữ nguyên; phiên tối ưu bị khoá sau khi hoàn tất.
    """
    cv_optimizer.finalize(db, user, analysis_id, utcnow())
    return _response(db, user, analysis_id)
