from typing import Any

from typing_extensions import TypedDict


class InterviewState(TypedDict, total=False):
    """
    State schema cho Mock Interview Agent (chấm điểm theo Rubric STAR).
    Hỗ trợ 3-4 vòng phỏng vấn cố định không có logic escalation.
    """

    # --- Inputs ---
    job_role: str  # Vị trí ứng tuyển (VD: "Python Backend Developer", "AI Engineer")
    user_answer: str  # Câu trả lời của sinh viên trong vòng hiện tại
    current_round: int  # Vòng hiện tại (1, 2, 3, 4 - mặc định là 1)
    total_rounds: int  # Tổng số vòng cố định (3 hoặc 4, mặc định là 3)
    current_question: str  # Câu hỏi của vòng hiện tại
    jd_context: str | None  # Ngữ cảnh JD liên quan (nếu có)
    cv_summary: str | None  # Tóm tắt kinh nghiệm CV (nếu có)
    chat_history: list[dict[str, str]]  # Lịch sử câu hỏi - câu trả lời các vòng trước

    # --- Outputs theo yêu cầu T3 ---
    # Thang điểm 0 - 5 / tiêu chí
    situation_score: float  # Điểm Situation (0.0 - 5.0)
    task_score: float  # Điểm Task (0.0 - 5.0)
    action_score: float  # Điểm Action (0.0 - 5.0)
    result_score: float  # Điểm Result (0.0 - 5.0)
    feedback_text: str  # Nhận xét chi tiết theo tiêu chuẩn STAR
    next_question: str | None  # Câu hỏi tiếp theo, hoặc None (null) nếu đã đến vòng cuối

    # --- Internal Control ---
    is_finished: bool  # Đã hoàn thành tất cả các vòng chưa
    retry_count: int  # Số lần đã retry khi gọi LLM (tối đa 1 lần)
    evaluation_scores: list[dict[str, Any]]  # Danh sách điểm các vòng đã qua
    error: str | None  # Thông báo lỗi nếu có
