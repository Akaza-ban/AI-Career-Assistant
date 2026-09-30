"""Phỏng vấn thử có chấm điểm STAR (US-SV-04): S5 thiết lập → S6 phòng phỏng vấn → S7 kết quả."""

from fastapi import APIRouter, Query, Response, status

from src.api.deps import CurrentStudent, DbSession
from src.db.models import utcnow
from src.models.schemas import (
    CreateInterviewRequest,
    InterviewQuota,
    InterviewSessionResponse,
    InterviewSummary,
    StudentReportResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from src.services import interview, sharing

router = APIRouter(prefix="/interviews", tags=["Mock Interview"])


@router.get("/quota", response_model=InterviewQuota)
def get_quota(user: CurrentStudent, db: DbSession, jd_id: str = Query(..., description="Vị trí (JD)")) -> dict:
    """Số buổi đã hoàn thành cho vị trí trong tuần (3 buổi / vị trí / tuần, tuần tính từ thứ Hai giờ Việt Nam)."""
    return interview.quota(db, user, jd_id, utcnow())


@router.get("", response_model=list[InterviewSummary])
def list_recent(user: CurrentStudent, db: DbSession, limit: int = Query(5, ge=1, le=50)) -> list[dict]:
    """Các buổi đã hoàn thành gần nhất (buổi bỏ dở không được lưu)."""
    return interview.recent(db, user, limit)


@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
def create_interview(body: CreateInterviewRequest, user: CurrentStudent, db: DbSession) -> dict:
    """Bắt đầu buổi mới (huỷ buổi đang dở nếu có). Lỗi 429 "quota_exceeded" khi đã hết 3 buổi của vị trí trong tuần."""
    now = utcnow()
    session = interview.create_session(db, user, body.jd_id, body.cv_version_id, now)
    return interview.session_out(db, session, now)


@router.get("/{session_id}", response_model=InterviewSessionResponse)
def get_interview(session_id: str, user: CurrentStudent, db: DbSession) -> dict:
    """Trạng thái buổi (khôi phục phòng khi tải lại trang). Lỗi 410 "interview_expired" nếu SV đã rời phòng quá lâu."""
    now = utcnow()
    return interview.session_out(db, interview.load_session(db, user, session_id, now), now)


@router.post("/{session_id}/answers", response_model=SubmitAnswerResponse)
async def submit_answer(session_id: str, body: SubmitAnswerRequest, user: CurrentStudent, db: DbSession) -> dict:
    """
    Nộp câu trả lời cho câu hiện tại và nhận điểm S/T/A/R (0–5) cùng câu tiếp theo.
    Câu bị guardrail chặn trả về allowed = false và không tính câu. Nộp câu cuối thì buổi hoàn thành (finished).
    """
    return await interview.submit_answer(db, user, session_id, body.question_index, body.text, body.timed_out, utcnow)


@router.post("/{session_id}/pause", response_model=InterviewSessionResponse)
def pause_interview(session_id: str, user: CurrentStudent, db: DbSession) -> dict:
    """Tạm dừng đồng hồ (1 lần mỗi buổi, tối đa 1 phút rồi tự chạy lại)."""
    now = utcnow()
    return interview.session_out(db, interview.pause(db, user, session_id, now), now)


@router.post("/{session_id}/resume", response_model=InterviewSessionResponse)
def resume_interview(session_id: str, user: CurrentStudent, db: DbSession) -> dict:
    now = utcnow()
    return interview.session_out(db, interview.resume(db, user, session_id, now), now)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def abandon_interview(session_id: str, user: CurrentStudent, db: DbSession) -> Response:
    """Kết thúc sớm: buổi bị xoá hẳn và không tính lượt."""
    interview.abandon(db, user, session_id, utcnow())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{session_id}/report", response_model=StudentReportResponse)
def get_report(session_id: str, user: CurrentStudent, db: DbSession) -> dict:
    """
    Kết quả buổi đã hoàn thành: điểm STAR, chi tiết từng câu, hướng dẫn cải thiện, so sánh với buổi đầu,
    kèm nhận xét của cố vấn (nếu có).
    """
    report = interview.build_report(db, user, session_id, utcnow())
    return {**report, "advisor_review": sharing.review_for_student(db, session_id)}
