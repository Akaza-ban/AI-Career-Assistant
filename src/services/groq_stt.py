"""Dịch vụ chuyển giọng nói thành văn bản (Speech-to-Text) qua Groq Whisper Turbo API.

Sử dụng mô hình whisper-large-v3-turbo siêu tốc với độ trễ thấp (~300ms),
hỗ trợ nhận diện tiếng Việt và thuật ngữ kỹ thuật IT chuyên sâu qua cơ chế Prompt Biasing.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlalchemy.orm import Session

from src.api.errors import AppError
from src.config import get_settings
from src.db.models import InterviewSession, JobDescription

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
# Khoảng 5 phút giọng nói webm/opus; Groq nhận tối đa 25 MB mỗi file
MAX_AUDIO_BYTES = 10 * 1024 * 1024
# Key mẫu trong .env.example coi như chưa cấu hình
_PLACEHOLDER_PREFIXES = ("gsk_your", "gsk_placeholder", "your-", "your_")


def groq_api_key() -> str | None:
    """Key Groq dùng được cho nhận diện giọng nói (kể cả khi LLM chạy bằng nhà cung cấp khác)."""
    key = (get_settings().groq_api_key or "").strip()
    return key if key and not key.startswith(_PLACEHOLDER_PREFIXES) else None


def voice_input_enabled() -> bool:
    return groq_api_key() is not None


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
        logger.warning("Không thể đọc ngữ cảnh JD cho Groq Whisper: %s", e)

    return "Phỏng vấn xin việc, thuật ngữ công nghệ thông tin, lập trình viên, tiếng Việt."


# Câu Whisper hay "nghe ra" từ im lặng / tiếng ồn (học từ phụ đề video); đứng một mình thì bỏ
_HALLUCINATIONS = {
    "tam biet",
    "cam on cac ban da theo doi",
    "cam on cac ban da xem video",
    "hen gap lai cac ban trong nhung video tiep theo",
    "hay subscribe cho kenh de ung ho",
    "hay dang ky kenh de ung ho",
    "thank you",
    "thanks for watching",
}


def clean_transcript(text: str) -> str:
    """Bỏ chữ "ảo" khi cả đoạn chỉ là một câu quen thuộc của phụ đề video, không phải lời người dùng."""
    from src.services.jd_parser import fold

    key = " ".join(fold(text).replace("!", " ").replace(".", " ").replace(",", " ").split())
    return "" if key in _HALLUCINATIONS else text.strip()


# Whisper chỉ đọc khoảng 224 token cuối của prompt: giữ phần chữ vừa nói ngắn để vẫn còn chỗ cho thuật ngữ của vị trí
PREVIOUS_TEXT_CHARS = 200


def build_prompt(context: str, previous_text: str | None) -> str:
    """
    Ghi âm theo từng đoạn (cắt ở khoảng ngừng): đưa phần cuối của chữ đã nhận diện vào prompt để Whisper nối câu
    liền mạch và viết thuật ngữ nhất quán giữa các đoạn.
    """
    tail = " ".join((previous_text or "").split())[-PREVIOUS_TEXT_CHARS:]
    return f"{context} {tail}".strip() if tail else context


async def transcribe_with_groq(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    content_type: str = "audio/webm",
    session_id: str | None = None,
    db: Session | None = None,
    model: str = "whisper-large-v3-turbo",
    previous_text: str | None = None,
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
    api_key = groq_api_key()
    if not api_key:
        raise AppError(503, "Máy chủ chưa bật nhận diện giọng nói (thiếu GROQ_API_KEY).", "voice_unavailable")

    if not audio_bytes or len(audio_bytes) < 100:
        raise AppError(400, "Đoạn ghi âm quá ngắn hoặc không có âm thanh.", "audio_too_short")

    prompt = build_prompt(get_interview_context_prompt(session_id, db), previous_text)

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
                return clean_transcript(result.get("text") or "")

            # Nếu model whisper-large-v3-turbo tạm thời quá tải hoặc không khả dụng, thử fallback sang whisper-large-v3
            if response.status_code != 200 and model == "whisper-large-v3-turbo":
                logger.warning(
                    "Groq Whisper Turbo trả về %s: %s. Thử lại với whisper-large-v3...",
                    response.status_code,
                    response.text[:300],
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
                    return clean_transcript(result.get("text") or "")

            # Ghi chi tiết vào log máy chủ, không gửi lời lỗi của Groq về trình duyệt
            logger.error("Groq Whisper API lỗi (%s): %s", response.status_code, response.text[:500])
            if response.status_code == 429:
                raise AppError(429, "Dịch vụ nhận diện giọng nói đang quá tải. Hãy thử lại sau ít phút.", "voice_busy")
            raise AppError(
                502, "Chưa nhận diện được giọng nói lúc này. Hãy thử lại hoặc gõ câu trả lời.", "voice_failed"
            )

    except httpx.TimeoutException as e:
        logger.error("Groq Whisper API timeout sau 30 giây")
        raise AppError(504, "Nhận diện giọng nói quá lâu. Hãy thử lại với đoạn nói ngắn hơn.", "voice_timeout") from e
    except AppError:
        raise
    except Exception as e:
        logger.exception("Lỗi không xác định khi gọi Groq Whisper API")
        raise AppError(500, "Có lỗi khi xử lý âm thanh. Hãy thử lại hoặc gõ câu trả lời.", "voice_failed") from e
