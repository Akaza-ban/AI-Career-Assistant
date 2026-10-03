"""Thư viện JD và phân tích khoảng cách CV–JD (US-SV-02, US-SV-05)."""

from fastapi import APIRouter, BackgroundTasks, status
from sqlalchemy import select

from src.api.deps import CurrentStudent, CurrentUser, DbSession
from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, JobDescription
from src.models.schemas import (
    CareerAdvice,
    CreateGapAnalysisRequest,
    GapAnalysisResponse,
    JobDescriptionResponse,
    RecommendJDsRequest,
    RecommendJDsResponse,
)
from src.services import gap_analysis
from src.services.jd_recommendation import generate_career_advice_with_llm, recommend_top_jds_from_cv

router = APIRouter()


@router.post(
    "/jd/recommend",
    response_model=RecommendJDsResponse,
    tags=["Gap Analysis"],
)
async def recommend_jds(
    body: RecommendJDsRequest,
    user: CurrentStudent,
    db: DbSession,
) -> RecommendJDsResponse:
    """
    (Task A3) Gợi ý Top-N JD phù hợp nhất với CV đã chọn kèm Matching Score từng JD (Full RAG):
    - Stage 1: Dense Retrieval tìm ứng viên qua Chroma Vector Store.
    - Stage 2: ATS Rule Scorer chấm điểm và sắp xếp theo Matching Score (PRD 5.2).
    - Stage 3: LLM Generation sinh lời khuyên nghề nghiệp và kế hoạch hành động cá nhân hóa.
    Sinh viên có thể truyền cv_version_id hoặc cv_text trực tiếp.
    """
    cv_text = ""
    if body.cv_version_id:
        cv = db.get(CvVersion, body.cv_version_id)
        if cv is None or cv.owner_id != user.id:
            raise AppError(404, "Không tìm thấy CV.", "cv_not_found")
        cv_text = cv.content_text
    elif body.cv_text and body.cv_text.strip():
        cv_text = body.cv_text
    else:
        raise AppError(400, "Vui lòng cung cấp cv_version_id hoặc cv_text.", "cv_required")

    results = recommend_top_jds_from_cv(
        cv_text=cv_text,
        db=db,
        top_n=body.top_n,
    )

    advice = None
    if body.generate_advice:
        advice_data = await generate_career_advice_with_llm(
            cv_summary=cv_text[:800],
            recommendations=results,
        )
        advice = CareerAdvice(**advice_data)

    return RecommendJDsResponse(
        cv_version_id=body.cv_version_id,
        recommendations=results,
        advice=advice,
    )


@router.get("/jd/library", response_model=list[JobDescriptionResponse], tags=["Gap Analysis"])
def list_jd_library(user: CurrentUser, db: DbSession) -> list[JobDescription]:
    """Thư viện JD chuẩn hoá: nội dung đầy đủ và yêu cầu kỹ năng theo mức Required / Preferred / Additional."""
    return list(
        db.scalars(select(JobDescription).where(JobDescription.source == "library").order_by(JobDescription.title))
    )


@router.get("/jd", response_model=list[JobDescriptionResponse], tags=["Gap Analysis"])
def list_my_jds(user: CurrentStudent, db: DbSession) -> list[JobDescription]:
    """Các vị trí SV có thể chọn khi luyện phỏng vấn: thư viện JD và các JD SV đã tự dán khi phân tích."""
    library = db.scalars(
        select(JobDescription).where(JobDescription.source == "library").order_by(JobDescription.title)
    )
    pasted = db.scalars(
        select(JobDescription)
        .where(JobDescription.source == "pasted", JobDescription.owner_id == user.id)
        .order_by(JobDescription.created_at.desc())
    )
    return [*library, *pasted]


@router.post(
    "/gap-analysis",
    response_model=GapAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Gap Analysis"],
)
def create_gap_analysis(
    body: CreateGapAnalysisRequest,
    user: CurrentStudent,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> GapAnalysisResponse:
    """
    Tạo lượt phân tích CV–JD và chạy nền. Trả về ngay với status "processing";
    frontend hỏi lại GET /gap-analysis/{id} để theo dõi current_step cho tới khi xong.
    """
    analysis = gap_analysis.create_analysis(db, user, body)
    background_tasks.add_task(gap_analysis.run_analysis, analysis.id)
    return gap_analysis.to_response(analysis, db.get(JobDescription, analysis.jd_id))


@router.get("/gap-analysis/{analysis_id}", response_model=GapAnalysisResponse, tags=["Gap Analysis"])
def get_gap_analysis(analysis_id: str, user: CurrentStudent, db: DbSession) -> GapAnalysisResponse:
    """Tiến độ hoặc kết quả của một lượt phân tích (chỉ chủ sở hữu xem được)."""
    analysis = db.get(GapAnalysis, analysis_id)
    if analysis is None or analysis.owner_id != user.id:
        raise AppError(404, "Không tìm thấy kết quả phân tích.", "analysis_not_found")
    return gap_analysis.to_response(analysis, db.get(JobDescription, analysis.jd_id))
