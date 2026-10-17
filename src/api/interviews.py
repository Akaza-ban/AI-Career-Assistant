"""Phỏng vấn thử có chấm điểm STAR (US-SV-04): S5 thiết lập → S6 phòng phỏng vấn → S7 kết quả."""

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from pydantic import BaseModel

from src.api.deps import CurrentStudent, DbSession
from src.api.errors import AppError
from src.db.models import InterviewSession, utcnow
from src.models.schemas import (
    CreateInterviewRequest,
    InterviewQuota,
    InterviewSessionResponse,
    InterviewSummary,
    StudentReportResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
)
from src.services import groq_stt, interview, sharing

router = APIRouter(prefix="/interviews", tags=["Mock Interview"])


class TranscribeResponse(BaseModel):
    text: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    user: CurrentStudent,
    db: DbSession,
    file: UploadFile = File(..., description="File âm thanh ghi âm từ microphone (webm/wav/mp3/m4a)"),
    session_id: str | None = Query(
        None, description="Buổi phỏng vấn của chính sinh viên, để gợi ý thuật ngữ của vị trí"
    ),
    previous: str | None = Form(
        None, max_length=2000, description="Chữ đã nhận diện của các đoạn ghi trước trong cùng lần nói (ngữ cảnh)"
    ),
) -> dict[str, str]:
    """Trả lời phỏng vấn bằng giọng nói: chuyển file ghi âm thành văn bản qua Groq Whisper."""
    if session_id is not None:
        # Chỉ lấy tên vị trí và kỹ năng của buổi phỏng vấn thuộc về chính sinh viên này
        session = db.get(InterviewSession, session_id)
        if session is None or session.owner_id != user.id:
            raise AppError(404, "Không tìm thấy buổi phỏng vấn.", "interview_not_found")
    audio_bytes = await file.read(groq_stt.MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > groq_stt.MAX_AUDIO_BYTES:
        raise AppError(413, "Đoạn ghi âm quá dài. Hãy nói từng phần ngắn hơn (dưới khoảng 5 phút).", "audio_too_large")
    text = await groq_stt.transcribe_with_groq(
        audio_bytes=audio_bytes,
        filename=file.filename or "recording.webm",
        content_type=file.content_type or "audio/webm",
        session_id=session_id,
        db=db,
        previous_text=previous,
    )
    return {"text": text}


@router.get("/quota", response_model=InterviewQuota)
def get_quota(user: CurrentStudent, db: DbSession, jd_id: str = Query(..., description="Vị trí (JD)")) -> dict:
    """Số buổi đã hoàn thành cho vị trí trong tuần (3 buổi / vị trí / tuần, tuần tính từ thứ Hai giờ Việt Nam)."""
    return interview.quota(db, user, jd_id, utcnow())


@router.get("", response_model=list[InterviewSummary])
def list_recent(user: CurrentStudent, db: DbSession, limit: int = Query(5, ge=1, le=50)) -> list[dict]:
    """Các buổi đã hoàn thành gần nhất (buổi bỏ dở không được lưu)."""
    return interview.recent(db, user, limit)


@router.post("", response_model=InterviewSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(body: CreateInterviewRequest, user: CurrentStudent, db: DbSession) -> dict:
    """Bắt đầu buổi mới (huỷ buổi đang dở nếu có). Lỗi 429 "quota_exceeded" khi đã hết 3 buổi của vị trí trong tuần."""
    now = utcnow()
    session = await interview.create_session(db, user, body.jd_id, body.cv_version_id, now, mode=body.interview_mode)
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
