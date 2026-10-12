// Đánh giá của sinh viên (US-SV-06): lý do chọn nhanh khi chấm 1–3 sao. Mã giống backend (src/services/feedback.py).

import type { CsatActivity } from "@/lib/types"

export const STAR_LABELS = ["Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Rất hữu ích"]
export const LOW_SCORE = 3
export const MAX_COMMENT_CHARS = 500

export const REASON_LABELS: Record<string, string> = {
  off_target: "Chưa sát JD",
  generic: "Gợi ý chung chung",
  missing_skill: "Thiếu kỹ năng quan trọng",
  unclear: "Khó hiểu",
  slow: "Chậm",
  unnatural: "Câu viết lại chưa tự nhiên",
  wrong_info: "Sai thông tin của tôi",
  hard_to_use: "Khó thao tác",
  off_target_questions: "Câu hỏi chưa sát vị trí",
  unfair_score: "Chấm điểm chưa hợp lý",
  generic_feedback: "Nhận xét chung chung",
  too_short: "Thời gian quá ngắn",
  technical: "Lỗi kỹ thuật",
}

export const REASONS: Record<CsatActivity, string[]> = {
  gap_analysis: ["off_target", "generic", "missing_skill", "unclear", "slow"],
  optimizer: ["unnatural", "wrong_info", "generic", "hard_to_use", "slow"],
  interview: ["off_target_questions", "unfair_score", "generic_feedback", "too_short", "technical"],
}

export const CSAT_ACTIVITY_LABEL: Record<CsatActivity, string> = {
  gap_analysis: "Phân tích CV",
  optimizer: "Trình tối ưu CV",
  interview: "Phỏng vấn thử",
}
