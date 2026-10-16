from typing import Any

from typing_extensions import TypedDict


class SuggestionItem(TypedDict, total=False):
    """Cấu trúc một gợi ý cải thiện có bằng chứng từ CV gốc."""

    skill: str
    evidence_span: str  # Đoạn trích nguyên văn từ CV gốc làm bằng chứng
    original_text: str  # Câu văn gốc trong CV
    suggested_revision: str  # Diễn đạt lại tối ưu (chỉ dựa trên nội dung có thật trong CV)
    rationale: str


class GapAnalysisState(TypedDict, total=False):
    """State schema cho Gap Analysis Agent (CV vs JD), chấm CV–JD Matching Score theo PRD mục 5.2."""

    cv_raw: str
    jd_raw: str
    # CV tách dòng: [{"line_no", "text", "section", "is_heading"}] (src/services/skill_matching.py)
    cv_lines: list[dict[str, Any]]
    # Yêu cầu của JD: [{"id", "name", "importance", "aliases"}]; JD thư viện truyền sẵn, JD tự dán thì trích ở node retrieve
    requirements: list[dict[str, Any]]
    # given: có sẵn (JD thư viện / đã trích trước); llm: vừa trích bằng AI; dictionary: AI lỗi, dùng từ điển kỹ năng
    requirements_source: str
    # Kết quả chấm từng yêu cầu: [{"id", "skill", "importance", "weight", "match", "status", "evidence", "note", "source"}]
    assessments: list[dict[str, Any]]
    # Gợi ý viết lại thô từ LLM trước khi chuẩn hoá: [{"requirement_id", "line", "rewrite", "reason"}]
    raw_suggestions: list[dict[str, Any]]
    llm_summary: str | None
    match_score: float | None
    score_breakdown: list[dict[str, Any]]
    # PRD mục 5.2: tối đa 2 lệnh gọi LLM mỗi lượt phân tích
    llm_calls: int
    llm_used: bool
    parsed_cv: dict[str, Any]
    parsed_jd: dict[str, Any]
    retrieved_context: list[dict[str, Any]]
    matched_skills: list[str]
    missing_skills: list[str]
    taxonomy_matches: dict[str, str]
    gap_summary: str
    suggestions: list[dict[str, Any]]  # mỗi suggestion kèm evidence_span trích từ CV gốc
    grounding_results: list[dict[str, Any]]  # kết quả kiểm định {passed, suggestion, evidence_span}
    manual_review_items: list[dict[str, Any]]  # các mục passed=false cần cố vấn xem lại
    recommendations: list[str]
    grounding_score: float
    is_grounded: bool
    error: str | None
