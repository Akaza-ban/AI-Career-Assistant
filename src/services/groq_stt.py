"""Dịch vụ chuyển giọng nói thành văn bản (Speech-to-Text) qua Groq Whisper Turbo API.

Sử dụng mô hình whisper-large-v3-turbo siêu tốc với độ trễ thấp (~300ms),
hỗ trợ nhận diện tiếng Việt và thuật ngữ kỹ thuật IT chuyên sâu qua cơ chế Prompt Biasing.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.models import InterviewSession, JobDescription

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def get_interview_context_prompt(session_id: str | None, db: Session | None) -> str:
    """Tạo chuỗi prompt gợi ý từ khóa kỹ thuật cho Whisper dựa trên JD phỏng vấn."""
    if not session_id or not db:
        return "Phỏng vấn xin việc, thuật ngữ IT, phần mềm, lập trình, tiếng Việt."

    try:
        session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
        if session and session.jd_id:
            jd = db.query(JobDescription).filter(JobDescription.id == session.jd_id).first()
            if jd:
                title = jd.title or ""
                skills: list[str] = []
                raw_skills: Any = getattr(jd, "skills", None) or []
                if isinstance(raw_skills, list):
                    for item in raw_skills:
                        if isinstance(item, dict) and "name" in item:
                            skills.append(str(item["name"]))
                        elif isinstance(item, str):
                            skills.append(item)

                top_skills = skills[:25]
                keywords = ", ".join(top_skills)
                return f"Phỏng vấn vị trí {title}. Các kỹ năng và công nghệ: {keywords}. Tiếng Việt tự nhiên."
    except Exception as e:
        logger.warning(f"Không thể đọc ngữ cảnh JD cho Groq Whisper: {e}")

    return "Phỏng vấn xin việc, thuật ngữ công nghệ thông tin, lập trình viên, tiếng Việt."


async def transcribe_with_groq(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    session_id: str | None = None,
    db: Session | None = None,
    model: str = "whisper-large-v3-turbo",
) -> str:
    """Gửi file âm thanh lên Groq Whisper API để nhận diện thành văn bản.

    Args:
        audio_bytes: Dữ liệu nhị phân của file âm thanh ghi âm từ microphone.
        filename: Tên file kèm phần mở rộng (webm/wav/mp3/m4a/ogg).
        content_type: MIME type của audio.
        session_id: ID buổi phỏng vấn (dùng để trích xuất từ khóa chuyên ngành).
        db: SQLAlchemy session.
        model: Tên model Whisper trên Groq (mặc định whisper-large-v3-turbo).

    Returns:
        Văn bản đã được nhận dạng (transcribed text).
    """
    settings = get_settings()
    api_key = (settings.groq_api_key or "").strip()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chưa cấu hình GROQ_API_KEY trong hệ thống. Vui lòng thêm GROQ_API_KEY để sử dụng Groq Whisper STT.",
        )

    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File âm thanh không hợp lệ hoặc quá ngắn.",
        )

    prompt = get_interview_context_prompt(session_id, db)

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    files = {
        "file": (filename, audio_bytes, content_type),
    }

    data = {
        "model": model,
        "language": "vi",
        "response_format": "json",
        "prompt": prompt,
        "temperature": "0.0",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_TRANSCRIPTIONS_URL,
                headers=headers,
                files=files,
                data=data,
            )

            if response.status_code == 200:
                result = response.json()
                text = (result.get("text") or "").strip()
                return text

            # Nếu model whisper-large-v3-turbo tạm thời quá tải hoặc không khả dụng, thử fallback sang whisper-large-v3
            if response.status_code != 200 and model == "whisper-large-v3-turbo":
                logger.warning(
                    f"Groq Whisper Turbo trả về status {response.status_code}: {response.text}. Đang thử fallback sang whisper-large-v3..."
                )
                data["model"] = "whisper-large-v3"
                files = {"file": (filename, audio_bytes, content_type)}
                fallback_resp = await client.post(
                    GROQ_TRANSCRIPTIONS_URL,
                    headers=headers,
                    files=files,
                    data=data,
                )
                if fallback_resp.status_code == 200:
                    result = fallback_resp.json()
                    return (result.get("text") or "").strip()

            error_body = response.text
            logger.error(f"Groq Whisper API lỗi ({response.status_code}): {error_body}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Lỗi từ dịch vụ Groq Whisper ({response.status_code}): {error_body}",
            )

    except httpx.TimeoutException:
        logger.error("Groq Whisper API timeout sau 30 giây")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Quá thời gian kết nối tới Groq Whisper API (Timeout).",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lỗi không xác định khi gọi Groq Whisper API: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi xử lý âm thanh: {str(e)}",
        )
