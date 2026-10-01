from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# ============================================================================
# 1. Health & Status Schemas
# ============================================================================


class HealthResponse(BaseModel):
    """Schema phản hồi kiểm tra sức khỏe hệ thống."""

    status: str = Field(default="ok", description="Trạng thái hệ thống (ok / healthy)")
    env: str = Field(default="development", description="Môi trường hiện tại (development / production)")
    version: str = Field(default="1.0.0", description="Phiên bản API")


class AgentStatusResponse(BaseModel):
    """Schema thông tin trạng thái Agent và LLM Provider."""

    status: str = Field(default="ready", description="Trạng thái agent")
    agent: str = Field(default="LangGraph Agent v1.0", description="Tên agent")
    llm_provider: str = Field(default="groq", description="Provider đang kích hoạt (groq / openrouter / openai)")
    model_name: str = Field(default="llama-3.3-70b-versatile", description="Tên model đang dùng")
    langsmith_tracing: bool = Field(default=True, description="Trạng thái LangSmith tracing")


# ============================================================================
# 2. General Chat Schemas
# ============================================================================


class ChatRequest(BaseModel):
    """Schema gửi tin nhắn trò chuyện với Agent."""

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Tin nhắn từ người dùng",
        examples=["Cho tôi lời khuyên tối ưu CV ngành AI Engineer"],
    )
    conversation_id: str | None = Field(
        default=None,
        description="ID phiên hội thoại (tự tạo nếu None)",
    )
    stream: bool = Field(
        default=False,
        description="Bật chế độ phản hồi dạng stream",
    )


class ChatResponse(BaseModel):
    """Schema phản hồi tin nhắn từ Agent."""

    response: str = Field(..., description="Nội dung phản hồi từ AI Agent")
    conversation_id: str = Field(default="", description="ID phiên hội thoại")
    analysis: str = Field(default="", description="Phân tích nội bộ / suy luận của agent")
    sources: list[str] = Field(default_factory=list, description="Danh sách tài liệu trích dẫn nguồn")
    timestamp: datetime = Field(default_factory=datetime.now, description="Thời gian phản hồi")


# ============================================================================
# 3. CV Upload & Versioning Schemas (US-SV-01, US-SV-03)
# ============================================================================


class ParsedCV(BaseModel):
    """Dữ liệu trích xuất có cấu trúc từ CV."""

    full_name: str | None = Field(default=None, description="Họ và tên ứng viên")
    email: str | None = Field(default=None, description="Email liên hệ")
    skills: list[str] = Field(default_factory=list, description="Danh sách kỹ năng trích xuất được")
    experiences: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Kinh nghiệm làm việc / dự án (công ty, vị trí, thời gian, mô tả)",
    )
    education: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Học vấn (trường, chuyên ngành, GPA, niên khoá)",
    )
    raw_text: str = Field(default="", description="Toàn bộ văn bản trích xuất từ CV")
    raw_length: int = Field(default=0, description="Độ dài ký tự văn bản CV")


class CVUploadRequest(BaseModel):
    """Schema upload hoặc dán nội dung CV."""

    student_id: str = Field(..., description="Mã sinh viên hoặc user ID", examples=["SV2026001"])
    filename: str | None = Field(default="cv.pdf", description="Tên file gốc nếu tải lên")
    cv_text: str | None = Field(
        default=None,
        description="Nội dung CV dạng text (nếu người dùng paste trực tiếp)",
    )


class CVUploadResponse(BaseModel):
    """Schema kết quả sau khi upload và parse CV."""

    cv_id: str = Field(..., description="Mã định danh bản ghi CV")
    version: int = Field(default=1, description="Phiên bản CV (bắt đầu từ 1)")
    student_id: str = Field(..., description="Mã sinh viên")
    filename: str = Field(default="", description="Tên file đã tải")
    parsed_cv: ParsedCV = Field(..., description="Thông tin CV đã bóc tách cấu trúc")
    message: str = Field(default="Tải lên và xử lý CV thành công", description="Thông báo kết quả")
    created_at: datetime = Field(default_factory=datetime.now, description="Thời điểm upload")


class CVVersionItem(BaseModel):
    """Thông tin tóm tắt 1 phiên bản CV trong lịch sử."""

    version: int = Field(..., description="Số thứ tự phiên bản")
    cv_id: str = Field(..., description="ID bản CV")
    summary: str = Field(default="", description="Mô tả tóm tắt phiên bản / thay đổi chính")
    updated_at: datetime = Field(default_factory=datetime.now, description="Thời điểm cập nhật")


class CVHistoryResponse(BaseModel):
    """Lịch sử các phiên bản CV của sinh viên."""

    student_id: str = Field(..., description="Mã sinh viên")
    versions: list[CVVersionItem] = Field(default_factory=list, description="Danh sách các phiên bản CV")


# ============================================================================
# 4. Gap Analysis Schemas (CV vs JD) (US-SV-02, US-SV-05)
# ============================================================================


class GapItem(BaseModel):
    """Một mục khoảng cách phát hiện giữa CV và JD."""

    category: Literal["presentation", "capability", "manual_review"] = Field(
        ...,
        description="Loại khoảng cách: presentation (cách diễn đạt), capability (năng lực thật), manual_review (cần SV xem xét)",
    )
    skill: str = Field(..., description="Tên kỹ năng hoặc yêu cầu liên quan", examples=["Docker", "LangGraph"])
    description: str = Field(
        ...,
        description="Chi tiết khoảng cách",
        examples=["JD yêu cầu thành thạo Docker containerization nhưng CV chưa thể hiện số liệu định lượng"],
    )
    severity: Literal["low", "medium", "high"] = Field(
        default="medium",
        description="Mức độ quan trọng của yêu cầu",
    )
    suggested_revision: str | None = Field(
        default=None,
        description="Gợi ý diễn đạt lại (chỉ áp dụng cho presentation gap, không bịa thông tin)",
    )


class CVSuggestion(BaseModel):
    """Gợi ý tối ưu hóa câu chữ kèm bằng chứng trích xuất từ CV gốc."""

    skill: str = Field(..., description="Kỹ năng liên quan")
    evidence_span: str = Field(..., description="Đoạn văn bản trích xuất nguyên văn từ CV gốc làm bằng chứng")
    original_text: str = Field(default="", description="Câu văn gốc trong CV")
    suggested_revision: str = Field(
        ...,
        description="Câu văn diễn đạt lại tối ưu (chỉ dựa trên nội dung có thật trong CV)",
    )
    rationale: str = Field(default="", description="Lý do cải thiện theo chuẩn ATS/JD")


class GapAnalysisRequest(BaseModel):
    """Schema yêu cầu phân tích khoảng cách CV vs JD."""

    student_id: str | None = Field(default=None, description="Mã sinh viên")
    cv_id: str | None = Field(default=None, description="ID bản CV đã lưu trong hệ thống")
    cv_raw: str | None = Field(
        default=None,
        description="Văn bản CV gốc (nếu truyền trực tiếp thay vì cv_id)",
    )
    jd_id: str | None = Field(default=None, description="Mã vị trí / JD mẫu trong hệ thống")
    jd_raw: str = Field(
        ...,
        min_length=50,
        description="Mô tả công việc (JD) cần so sánh (tối thiểu 50 ký tự theo PRD)",
        examples=[
            "Tuyển dụng AI Engineer: Thành thạo Python, LangGraph, Qdrant Vector DB, kinh nghiệm triển khai RAG và tối ưu LLM."
        ],
    )


class GapAnalysisResponse(BaseModel):
    """Schema kết quả phân tích khoảng cách CV vs JD."""

    analysis_id: str = Field(..., description="Mã phiên phân tích")
    student_id: str | None = Field(default=None, description="Mã sinh viên")
    job_title: str | None = Field(default=None, description="Tiêu đề vị trí tuyển dụng")
    matched_skills: list[str] = Field(
        default_factory=list, description="Danh sách kỹ năng đã khớp giữa CV và JD (đã áp dụng taxonomy)"
    )
    missing_skills: list[str] = Field(default_factory=list, description="Danh sách kỹ năng JD yêu cầu mà CV còn thiếu")
    suggestions: list[CVSuggestion] = Field(
        default_factory=list, description="Danh sách gợi ý tối ưu câu chữ kèm evidence_span từ CV gốc"
    )
    presentation_gaps: list[GapItem] = Field(
        default_factory=list,
        description="Khoảng cách trình bày (có thể tối ưu hoá câu chữ dựa trên kinh nghiệm thật)",
    )
    capability_gaps: list[GapItem] = Field(
        default_factory=list,
        description="Khoảng cách năng lực thực (cần học thêm kỹ năng mới, agent không tự bịa)",
    )
    manual_review_items: list[GapItem] = Field(
        default_factory=list,
        description="Các mục không đủ độ tin cậy, đề xuất sinh viên xem xét thủ công",
    )
    gap_summary: str = Field(default="", description="Bản tóm tắt tổng quan về độ phù hợp của CV với JD")
    recommendations: list[str] = Field(
        default_factory=list,
        description="Các khuyến nghị cụ thể để nâng cao chất lượng hồ sơ",
    )
    grounding_score: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Điểm kiểm định Grounding (chống ảo giác, đảm bảo bám sát dữ liệu thật)",
    )
    is_grounded: bool = Field(default=True, description="Đạt chuẩn bám sát nguồn (Guardrail check)")
    disclaimer: str = Field(
        default="Hệ thống không xác minh tính xác thực của kinh nghiệm tự khai và không cam kết trúng tuyển.",
        description="Tuyên bố miễn trừ trách nhiệm theo quy định PRD",
    )
    created_at: datetime = Field(default_factory=datetime.now, description="Thời điểm phân tích")


# ============================================================================
# 5. Apply Suggestion Schemas (HITL CV Optimization) (US-SV-03)
# ============================================================================


class ApplySuggestionRequest(BaseModel):
    """Schema áp dụng gợi ý chỉnh sửa vào CV để tạo phiên bản mới."""

    student_id: str = Field(..., description="Mã sinh viên")
    cv_id: str = Field(..., description="ID phiên bản CV hiện tại")
    suggestion_id: str = Field(..., description="Mã gợi ý hoặc kỹ năng được tối ưu")
    original_text: str = Field(..., description="Đoạn văn bản gốc trong CV cần thay thế")
    suggested_text: str = Field(..., description="Đoạn văn bản mới được sinh từ gợi ý")


class ApplySuggestionResponse(BaseModel):
    """Schema kết quả tạo phiên bản CV mới sau khi áp dụng gợi ý."""

    new_cv_id: str = Field(..., description="Mã định danh bản CV phiên bản mới")
    new_version: int = Field(..., description="Số thứ tự phiên bản mới (version = old + 1)")
    diff: str = Field(default="", description="Mô tả sự thay đổi giữa hai phiên bản")
    updated_cv_text: str = Field(default="", description="Toàn bộ nội dung CV mới cập nhật")
    message: str = Field(default="Đã tạo phiên bản CV mới thành công", description="Thông báo")


# ============================================================================
# 6. Mock Interview Schemas (STAR Rubric) (US-SV-04)
# ============================================================================


class InterviewStartRequest(BaseModel):
    """Schema khởi tạo vòng phỏng vấn thử."""

    student_id: str = Field(..., description="Mã sinh viên", examples=["SV2026001"])
    job_role: str = Field(..., description="Vị trí ứng tuyển mục tiêu", examples=["AI Engineer"])
    jd_id: str | None = Field(default=None, description="Mã JD trong hệ thống (nếu có)")
    jd_text: str | None = Field(default=None, description="Nội dung mô tả công việc")
    cv_id: str | None = Field(default=None, description="ID bản CV dùng làm bối cảnh phỏng vấn")


class InterviewStartResponse(BaseModel):
    """Schema kết quả khởi tạo vòng phỏng vấn."""

    session_id: str = Field(..., description="ID phiên phỏng vấn")
    student_id: str = Field(..., description="Mã sinh viên")
    job_role: str = Field(..., description="Vị trí ứng tuyển")
    total_questions: int = Field(default=5, description="Tổng số câu hỏi dự kiến trong vòng")
    current_question_index: int = Field(default=1, description="Số thứ tự câu hỏi hiện tại")
    first_question: str = Field(..., description="Nội dung câu hỏi phỏng vấn đầu tiên")
    message: str = Field(
        default="Vòng phỏng vấn đã bắt đầu. Hãy trả lời câu hỏi theo mô hình STAR.", description="Hướng dẫn"
    )


class InterviewAnswerRequest(BaseModel):
    """Schema gửi câu trả lời cho câu hỏi phỏng vấn."""

    session_id: str = Field(..., description="ID phiên phỏng vấn")
    question_index: int = Field(..., ge=1, description="Số thứ tự câu hỏi đang trả lời")
    answer: str = Field(..., min_length=5, description="Nội dung câu trả lời của sinh viên")


class STARScore(BaseModel):
    """Điểm đánh giá theo Rubric STAR (Situation, Task, Action, Result)."""

    situation_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Điểm bối cảnh (Situation)")
    task_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Điểm nhiệm vụ (Task)")
    action_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Điểm hành động (Action)")
    result_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Điểm kết quả (Result)")
    total_score: float = Field(default=0.0, ge=0.0, le=10.0, description="Điểm tổng thể câu trả lời")
    feedback: str = Field(default="", description="Nhận xét chi tiết theo từng khía cạnh STAR")


class InterviewAnswerResponse(BaseModel):
    """Schema phản hồi kết quả sau khi nộp câu trả lời."""

    session_id: str = Field(..., description="ID phiên phỏng vấn")
    question_index: int = Field(..., description="Số thứ tự câu hỏi vừa trả lời")
    star_evaluation: STARScore = Field(..., description="Chấm điểm và nhận xét câu trả lời")
    is_finished: bool = Field(default=False, description="Đã hoàn thành toàn bộ câu hỏi của vòng chưa")
    next_question_index: int | None = Field(default=None, description="Số thứ tự câu hỏi kế tiếp")
    next_question: str | None = Field(default=None, description="Nội dung câu hỏi tiếp theo (nếu chưa kết thúc)")


class QuestionEvaluationItem(BaseModel):
    """Chi tiết đánh giá một câu hỏi trong báo cáo tổng kết."""

    question_index: int = Field(..., description="Số thứ tự câu hỏi")
    question: str = Field(..., description="Nội dung câu hỏi")
    answer: str = Field(..., description="Câu trả lời của sinh viên")
    score: float = Field(..., description="Điểm câu hỏi")
    feedback: str = Field(..., description="Nhận xét chi tiết")


class InterviewReportResponse(BaseModel):
    """Schema báo cáo tổng kết vòng phỏng vấn."""

    session_id: str = Field(..., description="ID phiên phỏng vấn")
    student_id: str = Field(..., description="Mã sinh viên")
    job_role: str = Field(..., description="Vị trí ứng tuyển")
    round_number: int = Field(default=1, description="Số thứ tự vòng phỏng vấn đã thực hiện")
    overall_score: float = Field(..., ge=0.0, le=10.0, description="Điểm trung bình toàn vòng")
    star_breakdown: STARScore = Field(..., description="Điểm trung bình theo các tiêu chí STAR")
    strengths: list[str] = Field(default_factory=list, description="Điểm mạnh phát huy tốt")
    areas_for_improvement: list[str] = Field(default_factory=list, description="Điểm cần cải thiện")
    question_evaluations: list[QuestionEvaluationItem] = Field(
        default_factory=list,
        description="Chi tiết từng câu hỏi và nhận xét",
    )
    week_quota_used: int = Field(default=1, description="Số vòng phỏng vấn đã dùng trong tuần")
    week_quota_remaining: int = Field(
        default=2, description="Số vòng phỏng vấn còn lại trong tuần (giới hạn 3 vòng/tuần)"
    )
    completed_at: datetime = Field(default_factory=datetime.now, description="Thời điểm hoàn thành")


# ============================================================================
# 7. CSAT Feedback Schemas (US-SV-06)
# ============================================================================


class CSATRequest(BaseModel):
    """Schema gửi đánh giá trải nghiệm người dùng (1-5 sao)."""

    student_id: str = Field(..., description="Mã sinh viên")
    activity_type: Literal["gap_analysis", "mock_interview"] = Field(
        ...,
        description="Loại hoạt động vừa hoàn tất (gap_analysis hoặc mock_interview)",
    )
    activity_id: str | None = Field(default=None, description="Mã phiên phân tích hoặc phiên phỏng vấn")
    rating: int = Field(..., ge=1, le=5, description="Đánh giá từ 1 đến 5 sao", examples=[5])
    feedback_text: str | None = Field(default=None, description="Nhận xét / đóng góp ý kiến thêm")


class CSATResponse(BaseModel):
    """Schema phản hồi sau khi lưu đánh giá CSAT."""

    status: str = Field(default="success", description="Trạng thái lưu khảo sát")
    message: str = Field(default="Cảm ơn bạn đã đóng góp ý kiến đánh giá!", description="Thông báo")
    recorded_at: datetime = Field(default_factory=datetime.now, description="Thời điểm ghi nhận")


# ============================================================================
# 8. Advisor Dashboard Schemas (US-ADV-01, US-ADV-02, US-ADV-03)
# ============================================================================


class StudentSummary(BaseModel):
    """Tóm tắt thông tin và tiến độ của một sinh viên trên Dashboard cố vấn."""

    student_id: str = Field(..., description="Mã sinh viên")
    full_name: str = Field(..., description="Họ và tên sinh viên")
    target_role: str = Field(..., description="Vị trí ứng tuyển mục tiêu")
    completed_interview_rounds: int = Field(default=0, description="Số vòng phỏng vấn đã hoàn thành")
    first_score: float | None = Field(default=None, description="Điểm vòng phỏng vấn đầu tiên")
    latest_score: float | None = Field(default=None, description="Điểm vòng phỏng vấn gần nhất")
    score_delta: float | None = Field(
        default=None,
        description="Mức cải thiện điểm (latest_score - first_score). None nếu chưa đủ 2 vòng.",
    )
    needs_attention: bool = Field(
        default=False,
        description="Cờ tự động cảnh báo (auto-escalate) khi điểm không tăng qua 2 vòng liên tiếp",
    )
    flag_reason: str | None = Field(
        default=None,
        description="Lý do gắn cờ cảnh báo (ví dụ: 'Điểm không tăng sau 2 vòng liên tiếp')",
    )


class AdvisorStudentsResponse(BaseModel):
    """Danh sách sinh viên được phân công cho cố vấn."""

    advisor_id: str = Field(..., description="Mã cố vấn hướng nghiệp")
    total_assigned: int = Field(..., description="Tổng số sinh viên được phân công")
    flagged_count: int = Field(default=0, description="Số sinh viên đang cần chú ý hỗ trợ")
    students: list[StudentSummary] = Field(default_factory=list, description="Danh sách sinh viên chi tiết")


class StudentDetailResponse(BaseModel):
    """Hồ sơ chi tiết của sinh viên cho cố vấn xem xét (CV, JD, Lịch sử điểm)."""

    student_id: str = Field(..., description="Mã sinh viên")
    full_name: str = Field(..., description="Họ và tên sinh viên")
    advisor_id: str = Field(..., description="Mã cố vấn phụ trách")
    target_role: str = Field(..., description="Vị trí tuyển dụng mục tiêu")
    latest_cv_version: int = Field(default=1, description="Phiên bản CV mới nhất")
    cv_raw: str = Field(default="", description="Nội dung văn bản CV phiên bản mới nhất")
    target_jd: str = Field(default="", description="Nội dung JD mục tiêu")
    has_target_jd: bool = Field(default=True, description="Sinh viên đã chọn JD hay chưa")
    gap_summary: str | None = Field(default=None, description="Tóm tắt phân tích khoảng cách gần nhất")
    interview_history: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Lịch sử các vòng phỏng vấn và điểm số tương ứng",
    )
    needs_attention: bool = Field(default=False, description="Trạng thái cờ cảnh báo cần hỗ trợ")
