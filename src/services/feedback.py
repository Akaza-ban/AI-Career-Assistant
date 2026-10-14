"""
Phản hồi của sinh viên cho kết quả AI (US-SV-06).

- CSAT 1–5 sao sau mỗi lượt dùng: phân tích CV, trình tối ưu CV, phỏng vấn thử. Chấm 1–3 sao thì chọn được lý do
  (nút chọn nhanh); nhận xét bằng chữ luôn không bắt buộc.
- Like / dislike cho từng phần nhỏ: gợi ý sửa CV, nhận xét từng câu phỏng vấn, gợi ý vị trí, bảng so sánh nhiều vị trí.
Lý do lưu dạng mã ổn định; nhãn tiếng Việt giống frontend (lib/feedback.ts).
"""

from src.api.errors import AppError

CSAT_ACTIVITIES = ("gap_analysis", "optimizer", "interview")
THUMB_ACTIVITIES = ("gap_suggestion", "interview_turn", "job_recommendation", "jd_compare")
MAX_COMMENT_CHARS = 500
LOW_SCORE = 3

REASON_LABELS = {
    "off_target": "Chưa sát JD",
    "generic": "Gợi ý chung chung",
    "missing_skill": "Thiếu kỹ năng quan trọng",
    "unclear": "Khó hiểu",
    "slow": "Chậm",
    "unnatural": "Câu viết lại chưa tự nhiên",
    "wrong_info": "Sai thông tin của tôi",
    "hard_to_use": "Khó thao tác",
    "off_target_questions": "Câu hỏi chưa sát vị trí",
    "unfair_score": "Chấm điểm chưa hợp lý",
    "generic_feedback": "Nhận xét chung chung",
    "too_short": "Thời gian quá ngắn",
    "technical": "Lỗi kỹ thuật",
}

REASONS = {
    "gap_analysis": ("off_target", "generic", "missing_skill", "unclear", "slow"),
    "optimizer": ("unnatural", "wrong_info", "generic", "hard_to_use", "slow"),
    "interview": ("off_target_questions", "unfair_score", "generic_feedback", "too_short", "technical"),
}

ACTIVITY_LABELS = {
    "gap_analysis": "Phân tích CV",
    "optimizer": "Trình tối ưu CV",
    "interview": "Phỏng vấn thử",
    "gap_suggestion": "Gợi ý sửa CV",
    "interview_turn": "Nhận xét từng câu phỏng vấn",
    "job_recommendation": "Gợi ý vị trí",
    "jd_compare": "So sánh nhiều vị trí",
}


def check_tags(activity: str, value: int, tags: list[str] | None) -> list[str] | None:
    """Lý do chỉ dùng cho CSAT 1–3 sao và phải thuộc danh sách của hoạt động đó; trả về danh sách đã bỏ trùng."""
    if not tags:
        return None
    if value > LOW_SCORE:
        raise AppError(422, "Chỉ chọn lý do khi chấm từ 1 đến 3 sao.", "validation_error")
    allowed = REASONS.get(activity, ())
    unknown = [t for t in tags if t not in allowed]
    if unknown:
        raise AppError(422, "Lý do không hợp lệ cho hoạt động này.", "validation_error")
    return list(dict.fromkeys(tags))
