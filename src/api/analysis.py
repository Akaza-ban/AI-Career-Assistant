"""Thư viện JD và phân tích khoảng cách CV–JD (US-SV-02, US-SV-05)."""

from fastapi import APIRouter, BackgroundTasks, status
from sqlalchemy import select

from src.api.deps import CurrentStudent, CurrentUser, DbSession
from src.api.errors import AppError
from src.db.models import GapAnalysis, JobDescription
from src.models.schemas import CreateGapAnalysisRequest, GapAnalysisResponse, JobDescriptionResponse
from src.services import gap_analysis

router = APIRouter()


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
