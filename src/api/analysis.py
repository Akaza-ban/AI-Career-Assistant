"""Thư viện JD và phân tích khoảng cách CV–JD (US-SV-02, US-SV-05)."""

from fastapi import APIRouter, BackgroundTasks, Query, status
from sqlalchemy import select

from src.api.deps import CurrentStudent, CurrentUser, DbSession
from src.api.errors import AppError
from src.db.models import CvVersion, GapAnalysis, JobDescription
from src.models.schemas import (
    CareerAdvice,
    CompareJDsRequest,
    CompareJDsResponse,
    CreateGapAnalysisRequest,
    GapAnalysisResponse,
    JobDescriptionResponse,
    RecommendJDsRequest,
    RecommendJDsResponse,
    SkillRoadmapResponse,
)
from src.services import gap_analysis
from src.services.jd_recommendation import (
    compare_selected_jds_with_llm,
    generate_career_advice_with_llm,
    recommend_top_jds_from_cv,
)
from src.services.roadmap import get_roadmap_info

router = APIRouter()


@router.post(
    "/jd/compare",
    response_model=CompareJDsResponse,
    tags=["Gap Analysis"],
)
@router.post(
    "/gap-analysis/compare",
    response_model=CompareJDsResponse,
    tags=["Gap Analysis"],
    include_in_schema=False,
)
async def compare_jds(
    body: CompareJDsRequest,
    user: CurrentStudent,
    db: DbSession,
) -> CompareJDsResponse:
    """
    So sánh các JD được chọn (2-3 JD) với CV của sinh viên bằng LLM:
    - Sinh viên chọn 2-3 vị trí JD mục tiêu.
    - Gọi LLM phân tích ngữ nghĩa sâu từng JD đối chiếu với CV theo bảng rubric PRD 5.2.
    - Sắp xếp kết quả theo điểm match_score (%) giảm dần.
    - Hiển thị bảng so sánh chi tiết: kỹ năng đã đáp ứng, kỹ năng chỉ mới liệt kê, kỹ năng còn thiếu, nhận xét của LLM.
    - Tổng hợp danh sách kỹ năng còn thiếu chung (common missing skills) ở tất cả các JD.
    """
    cv_text = ""
    cv_label = None
    cv_name = None
    if body.cv_version_id:
        cv = db.get(CvVersion, body.cv_version_id)
        if cv is None or cv.owner_id != user.id:
            raise AppError(404, "Không tìm thấy CV.", "cv_not_found")
        cv_text = cv.content_text
        cv_label = f"v{cv.major}.{cv.minor}" if cv.major is not None and cv.minor is not None else None
        cv_name = cv.file_name
    elif body.cv_text and body.cv_text.strip():
        cv_text = body.cv_text
    else:
        raise AppError(400, "Vui lòng cung cấp cv_version_id hoặc cv_text.", "cv_required")

    unique_jd_ids = list(dict.fromkeys(body.jd_ids))
    if len(unique_jd_ids) < 2 or len(unique_jd_ids) > 3:
        raise AppError(400, "Vui lòng chọn từ 2 đến 3 vị trí JD khác nhau để so sánh.", "invalid_jd_selection")

    # Kiểm tra bảo mật: nếu là JD tự dán, phải thuộc quyền sở hữu của chính sinh viên
    pasted_jds = db.scalars(
        select(JobDescription).where(
            JobDescription.id.in_(unique_jd_ids),
            JobDescription.source == "pasted",
        )
    ).all()
    for pjd in pasted_jds:
        if pjd.owner_id != user.id:
            raise AppError(403, "Bạn không có quyền truy cập vị trí JD này.", "jd_forbidden")

    result = await compare_selected_jds_with_llm(
        cv_text=cv_text,
        jd_ids=unique_jd_ids,
        db=db,
    )

    found_ids = {c["jd_id"] for c in result.get("comparisons", [])}
    missing_ids = [jid for jid in unique_jd_ids if jid not in found_ids]
    if missing_ids:
        raise AppError(404, f"Không tìm thấy thông tin JD: {', '.join(missing_ids)}.", "jd_not_found")

    return CompareJDsResponse(
        cv_version_id=body.cv_version_id,
        cv_label=cv_label,
        cv_name=cv_name,
        total_compared=len(result["comparisons"]),
        comparisons=result["comparisons"],
        common_missing_skills=result["common_missing_skills"],
    )


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


@router.get("/skills/roadmap", response_model=SkillRoadmapResponse, tags=["Gap Analysis"])
def get_skill_roadmap(
    skill: str = Query(..., min_length=1, description="Tên kỹ năng cần tra cứu lộ trình học trên roadmap.sh"),
) -> SkillRoadmapResponse:
    """Tra cứu đường dẫn lộ trình học tập roadmap.sh cho một kỹ năng bất kỳ."""
    info = get_roadmap_info(skill)
    return SkillRoadmapResponse(**info)
