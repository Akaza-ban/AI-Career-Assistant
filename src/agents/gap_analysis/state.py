from typing import Any

from typing_extensions import TypedDict


class SuggestionItem(TypedDict, total=False):
    """Cấu trúc một gợi ý cải thiện có bằng chứng từ CV gốc."""

    skill: str
    evidence_span: str  # Đoạn trích nguyên văn từ CV gốc làm bằng chứng
    original_text: str  # Câu văn gốc trong CV
    suggested_revision: str  # Diễn đạt lại tối ưu (chỉ dựa trên nội dung có thật trong CV)
    rationale: str  # Lý do cải thiện theo chuẩn ATS / JD


class GapAnalysisState(TypedDict, total=False):
    """State schema cho Gap Analysis Agent 4-node (CV vs JD)."""

    cv_raw: str
    jd_raw: str
    parsed_cv: dict[str, Any]
    parsed_jd: dict[str, Any]
    retrieved_context: list[dict[str, Any]]
    matched_skills: list[str]
    missing_skills: list[str]
    taxonomy_matches: dict[str, str]
    gap_summary: str
    suggestions: list[dict[str, Any]]  # mỗi suggestion kèm evidence_span trích từ CV gốc
    recommendations: list[str]
    grounding_score: float
    is_grounded: bool
    error: str | None
