"""
Các trang Cố vấn (US-ADV-01, 02, 03). Mọi endpoint chỉ trả dữ liệu SV thuộc danh sách phụ trách (403 nếu không);
nội dung (CV, báo cáo phỏng vấn) chỉ mở được khi SV đã bật chia sẻ.
"""

from typing import Any

from fastapi import APIRouter, Response, status
from fastapi.responses import FileResponse

from src.api import cv as cv_routes
from src.api.deps import CurrentAdvisor, DbSession
from src.api.errors import AppError
from src.db.models import utcnow
from src.models.schemas import (
    AdvisorNoteResponse,
    AdvisorOverviewResponse,
    AdvisorReportResponse,
    AdvisorReviewResponse,
    AdvisorStudentDetail,
    AdvisorStudentProgress,
    AssignedStudentResponse,
    CvTextResponse,
    NoteRequest,
    NoteUpdateRequest,
    ReviewRequest,
)
from src.services import advisor, cv_files, cv_optimizer

router = APIRouter(prefix="/advisor", tags=["Advisor"])


@router.get("/overview", response_model=AdvisorOverviewResponse)
def get_overview(user: CurrentAdvisor, db: DbSession) -> dict[str, Any]:
    """
    Tổng quan cả nhóm: số SV, tỷ lệ hoạt động 30 ngày, điểm TB và chênh lệch so với buổi đầu, CSAT, điểm TB theo tuần,
    phân bố trạng thái, S/T/A/R của nhóm, SV cần chú ý, SV tiến bộ nhiều nhất và nhận xét đã gửi gần đây.
    """
    return advisor.overview(db, user, utcnow())


@router.get("/students", response_model=list[AssignedStudentResponse])
def list_students(user: CurrentAdvisor, db: DbSession) -> list[dict[str, Any]]:
    """
    SV được phân công: điểm buổi đầu / gần nhất và chênh lệch ở vị trí đang luyện ("Chưa đủ dữ liệu" khi < 2 buổi),
    cờ "Cần chú ý" (2 vòng liên tiếp không tăng), số tài liệu đang chia sẻ, số báo cáo chờ nhận xét.
    """
    return advisor.student_list(db, user)


@router.get("/students/{student_id}", response_model=AdvisorStudentDetail)
def get_student(student_id: str, user: CurrentAdvisor, db: DbSession) -> dict[str, Any]:
    """Hồ sơ SV: các phiên bản CV, JD mục tiêu, phân tích gần nhất, các buổi phỏng vấn, tiến bộ và ghi chú nội bộ."""
    data = advisor.student_detail(db, user, student_id, utcnow())
    latest = cv_routes.latest_analyses(db, student_id)
    data["cvs"] = [
        {**cv_routes.to_response(cv, latest.get(cv.id)).model_dump(), "shared": shared} for cv, shared in data["cvs"]
    ]
    return data


@router.get("/students/{student_id}/progress", response_model=AdvisorStudentProgress)
def get_student_progress(student_id: str, user: CurrentAdvisor, db: DbSession) -> dict[str, Any]:
    """Dòng mở rộng ở danh sách: điểm 0–5 theo vị trí, S/T/A/R, tiến bộ CV và gợi ý cho buổi tư vấn tới."""
    return advisor.student_progress(db, user, student_id, utcnow())


@router.get("/students/{student_id}/interviews/{session_id}", response_model=AdvisorReportResponse)
def get_interview_report(student_id: str, session_id: str, user: CurrentAdvisor, db: DbSession) -> dict[str, Any]:
    """Báo cáo đầy đủ của buổi SV đã chia sẻ (403 "not_shared" nếu chưa); SV thấy "Cố vấn đã xem"."""
    return advisor.interview_report(db, user, student_id, session_id, utcnow())


@router.put("/students/{student_id}/interviews/{session_id}/review", response_model=AdvisorReviewResponse)
def review_interview(
    student_id: str, session_id: str, body: ReviewRequest, user: CurrentAdvisor, db: DbSession
) -> dict[str, Any]:
    """Viết / sửa nhận xét cho báo cáo đã chia sẻ. Điểm AI giữ nguyên."""
    return advisor.save_review(db, user, student_id, session_id, body.comment, utcnow())


@router.get("/students/{student_id}/cvs/{cv_id}/file")
def get_cv_file(student_id: str, cv_id: str, user: CurrentAdvisor, db: DbSession) -> FileResponse:
    """File phiên bản CV SV đã chia sẻ."""
    cv = advisor.shared_cv(db, user, student_id, cv_id, utcnow())
    path = cv_files.stored_path(cv.owner_id, cv.id, cv.file_type)
    if not path.exists():
        raise AppError(404, "Không tìm thấy file gốc của CV này.", "cv_file_missing")
    return FileResponse(
        path, media_type=cv_files.CV_MEDIA_TYPES[cv.file_type], filename=cv.file_name, content_disposition_type="inline"
    )


@router.get("/students/{student_id}/cvs/{cv_id}/text", response_model=CvTextResponse)
def get_cv_text(student_id: str, cv_id: str, user: CurrentAdvisor, db: DbSession) -> CvTextResponse:
    """Văn bản của phiên bản CV SV đã chia sẻ (xem nhanh)."""
    cv = advisor.shared_cv(db, user, student_id, cv_id, utcnow())
    return CvTextResponse(text=cv_optimizer.display_text(cv))


@router.post("/students/{student_id}/notes", response_model=AdvisorNoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(student_id: str, body: NoteRequest, user: CurrentAdvisor, db: DbSession) -> dict[str, Any]:
    """Ghi chú nội bộ về SV (SV không thấy)."""
    return advisor.create_note(db, user, student_id, body.body, body.tags, utcnow())


@router.patch("/students/{student_id}/notes/{note_id}", response_model=AdvisorNoteResponse)
def update_note(
    student_id: str, note_id: str, body: NoteUpdateRequest, user: CurrentAdvisor, db: DbSession
) -> dict[str, Any]:
    return advisor.update_note(db, user, student_id, note_id, body.body, body.tags, body.pinned, utcnow())


@router.delete("/students/{student_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(student_id: str, note_id: str, user: CurrentAdvisor, db: DbSession) -> Response:
    advisor.delete_note(db, user, student_id, note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
