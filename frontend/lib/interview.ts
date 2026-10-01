// Hằng số và tiện ích dùng chung cho luồng phỏng vấn thử (S5 → S7), thang STAR 0–5 theo PRD mục 5.1.

import type { InterviewLabel, StarCriterion } from "@/lib/types"

export const QUESTION_COUNT = 4
export const SECONDS_PER_QUESTION = 5 * 60
export const PAUSE_MAX_SECONDS = 60
export const MIN_ANSWER_CHARS = 30
export const MAX_ANSWER_CHARS = 3000

/** Chủ đề 4 câu theo thứ tự (khớp ngân hàng câu hỏi ở backend: src/services/interview.py). */
export const QUESTION_THEMES = ["Nhiệm vụ tiêu biểu", "Xử lý khó khăn", "Làm việc nhóm", "Học hỏi & ưu tiên"]

export const STAR_ORDER: StarCriterion[] = ["situation", "task", "action", "result"]

export const STAR_META: Record<StarCriterion, { letter: string; label: string; hint: string }> = {
  situation: { letter: "S", label: "Bối cảnh", hint: "Thời điểm, nơi làm việc/dự án, quy mô và vấn đề cần giải quyết." },
  task: { letter: "T", label: "Nhiệm vụ", hint: "Vai trò và trách nhiệm của riêng bạn, mục tiêu cần đạt." },
  action: { letter: "A", label: "Hành động", hint: "Các bước bạn trực tiếp làm, công cụ và kỹ năng đã dùng." },
  result: { letter: "R", label: "Kết quả", hint: "Kết quả, tác động hoặc số liệu có thật; điều bạn rút ra." },
}

/** Thang điểm mỗi tiêu chí (PRD mục 5.1). */
export const RUBRIC_SCALE: { score: number; label: string }[] = [
  { score: 0, label: "Không đề cập" },
  { score: 1, label: "Rất yếu, mơ hồ" },
  { score: 2, label: "Có đề cập nhưng thiếu nhiều" },
  { score: 3, label: "Đạt yêu cầu cơ bản" },
  { score: 4, label: "Tốt, rõ ràng và cụ thể" },
  { score: 5, label: "Rất tốt, đầy đủ và thuyết phục" },
]

export const LABEL_META: Record<InterviewLabel, { text: string; className: string; bar: string; badge: string }> = {
  weak: { text: "Cần luyện thêm", className: "text-bad", bar: "bg-bad", badge: "bg-bad-soft text-bad" },
  basic: { text: "Đạt cơ bản", className: "text-warn", bar: "bg-warn", badge: "bg-warn-soft text-warn" },
  fair: { text: "Khá", className: "text-blue", bar: "bg-blue", badge: "bg-blue-soft text-blue" },
  good: { text: "Tốt", className: "text-good", bar: "bg-good", badge: "bg-good-soft text-good" },
}

/** Cần luyện thêm (< 2) · Đạt cơ bản (< 3) · Khá (< 4) · Tốt (≥ 4). */
export function labelOf(score: number): InterviewLabel {
  return score >= 4 ? "good" : score >= 3 ? "fair" : score >= 2 ? "basic" : "weak"
}

/** "3,6" */
export const formatScore = (score: number) => score.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

/** "04:59" */
export const mmss = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`

/**
 * Xu hướng so với buổi trước (PRD mục 5.1): ≥ +0,3 cải thiện rõ rệt; từ −0,3 đến +0,3 chưa thay đổi đáng kể;
 * ≤ −0,3 giảm, cần chú ý. Ngưỡng 0,3 đang chờ PO xác nhận.
 */
export const TREND_THRESHOLD = 0.3

export function trendOf(delta: number) {
  if (delta >= TREND_THRESHOLD) return { text: "Cải thiện rõ rệt", className: "text-good" }
  if (delta <= -TREND_THRESHOLD) return { text: "Giảm, cần chú ý", className: "text-bad" }
  return { text: "Chưa thay đổi đáng kể", className: "text-ink-2" }
}
