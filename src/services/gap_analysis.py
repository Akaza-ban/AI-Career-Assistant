"""Tạo, chạy nền và trả kết quả lượt phân tích khoảng cách CV–JD (US-SV-02, US-SV-05, PRD mục 5.2)."""

import asyncio
import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from src.agents.gap_analysis.graph import gap_analysis_agent
from src.api.errors import AppError
from src.db.database import SessionLocal
from src.db.models import CvVersion, GapAnalysis, JobDescription, User, utcnow
from src.models.schemas import CreateGapAnalysisRequest, GapAnalysisResponse
from src.services import cv_versions, notifications
from src.services.skill_matching import match_label

logger = logging.getLogger(__name__)

# Thứ tự các node của gap_analysis_agent; frontend hiển thị tiến độ theo đúng các bước này.
STEPS = ["parse", "retrieve", "compare", "generate", "verify_grounding"]
ANALYSIS_TIMEOUT_SECONDS = 150
# Khớp JD_MIN_WORDS ở frontend/lib/types.ts (US-SV-02 AC2)
JD_MIN_WORDS = 50


def create_analysis(db: Session, user: User, request: CreateGapAnalysisRequest) -> GapAnalysis:
    """Kiểm tra đầu vào, lưu JD tự dán (nếu có) và tạo bản ghi lượt phân tích ở trạng thái 'processing'."""
    cv = db.get(CvVersion, request.cv_version_id)
    if cv is None or cv.owner_id != user.id:
        raise AppError(404, "Không tìm thấy phiên bản CV đã chọn.", "cv_not_found")

    has_text = bool(request.jd_text and request.jd_text.strip())
    if request.jd_id and has_text:
        raise AppError(422, "Chỉ chọn JD trong thư viện hoặc dán nội dung JD, không gửi cả hai.", "jd_source_conflict")

    if request.jd_id:
        jd = db.get(JobDescription, request.jd_id)
        if jd is None or (jd.source == "pasted" and jd.owner_id != user.id):
            raise AppError(404, "Không tìm thấy JD đã chọn.", "jd_not_found")
    elif has_text:
        words = len(request.jd_text.split())
        if words < JD_MIN_WORDS:
            raise AppError(
                422,
                f"Nội dung JD quá ngắn ({words} từ). Hãy bổ sung tối thiểu {JD_MIN_WORDS} từ.",
                "jd_too_short",
            )
        if not (request.jd_title and request.jd_title.strip()):
            raise AppError(422, "Hãy nhập tiêu đề vị trí tuyển dụng.", "jd_title_required")
        jd = JobDescription(
            id=f"jd_{uuid.uuid4().hex[:12]}",
            source="pasted",
            owner_id=user.id,
            title=request.jd_title.strip(),
            company=(request.jd_company or "").strip() or None,
            content=request.jd_text.strip(),
            skills=[],
        )
        db.add(jd)
    else:
        raise AppError(422, "Hãy chọn một JD trong thư viện hoặc dán nội dung JD.", "jd_required")

    analysis = GapAnalysis(
        id=f"ga_{uuid.uuid4().hex[:12]}",
        owner_id=user.id,
        cv_version_id=cv.id,
        cv_file_name=cv.file_name,
        cv_label=cv_versions.label(cv),
        jd_id=jd.id,
        status="processing",
        current_step=STEPS[0],
    )
    db.add(analysis)
    db.commit()
    return analysis


def _update(analysis_id: str, **values: Any) -> None:
    with SessionLocal() as db:
        analysis = db.get(GapAnalysis, analysis_id)
        if analysis is None:
            return
        for key, value in values.items():
            setattr(analysis, key, value)
        db.commit()


def _fail(analysis_id: str, message: str) -> None:
    _update(analysis_id, status="failed", current_step=None, error_message=message, completed_at=utcnow())


def _build_result(final: dict[str, Any]) -> dict[str, Any]:
    requirements = [{k: v for k, v in a.items() if k != "source"} for a in final.get("assessments", [])]
    suggestions = [
        {
            "id": s["id"],
            "skill": s["skill"],
            # Dòng CV mà gợi ý thay thế; Trình tối ưu CV dùng để áp gợi ý vào đúng chỗ
            "line_no": s.get("line_no"),
            "section_label": s.get("section_label"),
            "original_text": s["original_text"],
            "suggested_text": s["suggested_revision"],
            "reason": s.get("rationale", ""),
        }
        for s in final.get("suggestions", [])
    ]
    return {
        "requirements": requirements,
        "suggestions": suggestions,
        "pending_review_count": len(final.get("manual_review_items", [])),
        "breakdown": final.get("score_breakdown", []),
        "summary": final.get("gap_summary"),
        "llm_used": bool(final.get("llm_used")),
    }


async def run_analysis(analysis_id: str) -> None:
    """Chạy gap_analysis_agent cho một lượt phân tích, ghi lại bước đang chạy để frontend hiển thị tiến độ."""
    with SessionLocal() as db:
        analysis = db.get(GapAnalysis, analysis_id)
        if analysis is None:
            return
        cv = db.get(CvVersion, analysis.cv_version_id)
        jd = db.get(JobDescription, analysis.jd_id)
        if cv is None or jd is None:
            _fail(analysis_id, "Không tìm thấy CV hoặc JD của lượt phân tích này.")
            return
        state: dict[str, Any] = {
            "cv_raw": cv.content_text,
            "jd_raw": jd.content,
            # JD thư viện có sẵn yêu cầu đã chuẩn hoá; JD tự dán sẽ được trích ở bước retrieve
            "requirements": jd.skills if jd.source == "library" else [],
            "llm_calls": 0,
        }
        jd_source, jd_id = jd.source, jd.id

    final = dict(state)
    try:
        async with asyncio.timeout(ANALYSIS_TIMEOUT_SECONDS):
            async for update in gap_analysis_agent.astream(state, stream_mode="updates"):
                for node, delta in update.items():
                    final.update(delta or {})
                    index = STEPS.index(node) if node in STEPS else -1
                    if 0 <= index < len(STEPS) - 1:
                        _update(analysis_id, current_step=STEPS[index + 1])
    except TimeoutError:
        _fail(analysis_id, "Phân tích mất quá nhiều thời gian. Hãy thử lại sau ít phút.")
        return
    except Exception:
        logger.exception("Phân tích %s thất bại", analysis_id)
        _fail(analysis_id, "Có lỗi xảy ra trong lúc phân tích. Hãy thử lại.")
        return

    if not final.get("requirements"):
        _fail(
            analysis_id,
            "Không trích xuất được yêu cầu kỹ năng từ JD. Hãy dán JD có phần yêu cầu ứng viên rõ ràng hơn.",
        )
        return

    with SessionLocal() as db:
        if jd_source == "pasted":
            # Lưu yêu cầu đã trích để hiển thị lại thông tin JD và dùng cho các lượt sau
            jd = db.get(JobDescription, jd_id)
            if jd is not None:
                jd.skills = [
                    {"name": r["name"], "importance": r["importance"], "aliases": r.get("aliases", [])}
                    for r in final["requirements"]
                ]
        analysis = db.get(GapAnalysis, analysis_id)
        if analysis is not None:
            analysis.status = "completed"
            analysis.current_step = None
            analysis.match_score = final.get("match_score")
            analysis.result = _build_result(final)
            analysis.llm_calls = final.get("llm_calls", 0)
            analysis.completed_at = utcnow()
            _notify_completed(db, analysis)
        db.commit()


def _notify_completed(db: Session, analysis: GapAnalysis) -> None:
    owner = db.get(User, analysis.owner_id)
    jd = db.get(JobDescription, analysis.jd_id)
    if owner is None or jd is None:
        return
    score = analysis.match_score
    label = "" if score is None else (" · Cao" if score >= 75 else " · Khá" if score >= 50 else " · Trung bình")
    notifications.notify(
        db,
        owner,
        "gap_analysis",
        f"Phân tích CV với {jd.title} đã xong",
        f"{analysis.cv_file_name} · Mức phù hợp {round(score) if score is not None else '—'}%{label}",
        action_label="Xem kết quả",
        action_href=f"/student/analysis/{analysis.id}",
    )


def to_response(analysis: GapAnalysis, jd: JobDescription) -> GapAnalysisResponse:
    result = analysis.result or {}
    requirements = result.get("requirements", [])
    return GapAnalysisResponse(
        id=analysis.id,
        response_id=analysis.id,
        status=analysis.status,
        current_step=analysis.current_step,
        error_message=analysis.error_message,
        cv_version_id=analysis.cv_version_id,
        cv_file_name=analysis.cv_file_name,
        cv_label=analysis.cv_label,
        jd={
            "id": jd.id,
            "title": jd.title,
            "company": jd.company,
            "industry": jd.industry,
            "level": jd.level,
            "source": jd.source,
        },
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
        match_score=analysis.match_score,
        match_label=match_label(analysis.match_score),
        counts={
            status: sum(1 for r in requirements if r["status"] == status)
            for status in ("matched", "partial", "missing")
        },
        breakdown=result.get("breakdown", []),
        requirements=requirements,
        suggestions=result.get("suggestions", []),
        pending_review_count=result.get("pending_review_count", 0),
        summary=result.get("summary"),
        llm_used=result.get("llm_used", False),
    )
