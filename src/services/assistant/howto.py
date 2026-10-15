"""Guide-only policy and cached answers; retrieval and TTL storage are reused."""

import hashlib
import json

from pydantic import BaseModel, Field

from src.models.assistant import SourceCitation
from src.services.assistant.chunker import DocChunk
from src.services.assistant.router.cache import ModelCache
from src.services.assistant.router.text import detect_language, normalize


class AttachmentMetadata(BaseModel):
    route_id: str = ""
    ui_targets: list[str] = Field(default_factory=list)
    score: float = 0.0


class GuideAnswer(BaseModel):
    message: str
    sources: list[SourceCitation]
    attachment: AttachmentMetadata = Field(default_factory=AttachmentMetadata)


# The cache contains guide prose/citations only, never identities, history,
# resolved records, current-page context or already-sequenced UI actions.
AnswerCache = ModelCache[GuideAnswer]


def answer_cache_key(query: str, role: str, language: str, docs_version: str) -> str:
    return hashlib.sha256(f"{normalize(query).folded}|{role}|{language}|{docs_version}".encode()).hexdigest()


def corpus_version(chunks: list[DocChunk]) -> str:
    versions = {chunk.docs_version for chunk in chunks}
    if len(versions) == 1 and "" not in versions:
        return next(iter(versions))
    # Pre-migration indexes and injected retrievers have no corpus stamp. Hash
    # their actual guide models, rather than share a constant stale-cache key.
    return hashlib.sha256(
        json.dumps([chunk.model_dump() for chunk in sorted(chunks, key=lambda c: c.chunk_id)], sort_keys=True).encode()
    ).hexdigest()


def answer_language(message: str) -> str:
    return "en" if detect_language(message) == "en" else "vi"


def capability_menu(language: str, role: str) -> str:
    if language == "en":
        topics = (
            "uploading CVs, using the JD library, CV–JD analysis, interview practice, history and sharing"
            if role == "student"
            else "the advisor overview and assigned students"
        )
        return (
            "The usage guide does not cover this question. I can explain "
            + topics
            + ", highlight a registered control, or navigate to an allowed page. Which feature do you need help with?"
        )
    topics = (
        "tải CV, Thư viện JD, phân tích CV–JD, luyện phỏng vấn, lịch sử và chia sẻ"
        if role == "student"
        else "trang tổng quan cố vấn và danh sách sinh viên phụ trách"
    )
    return (
        "Tài liệu hướng dẫn chưa có thông tin phù hợp cho câu hỏi này. Tôi có thể hướng dẫn "
        + topics
        + ", chỉ vị trí nút hoặc mở trang được phép. Bạn cần hỗ trợ tính năng nào?"
    )
