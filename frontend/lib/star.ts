import type { StarScore } from "@/lib/types"

export const STAR_KEYS = ["situation", "task", "action", "result"] as const satisfies readonly (keyof StarScore)[]

export const STAR_LABELS: Record<keyof StarScore, { letter: string; label: string }> = {
  situation: { letter: "S", label: "Situation (Bối cảnh)" },
  task: { letter: "T", label: "Task (Nhiệm vụ)" },
  action: { letter: "A", label: "Action (Hành động)" },
  result: { letter: "R", label: "Result (Kết quả có số liệu)" },
}

export type StarLevel = "good" | "fair" | "average" | "weak"

/**
 * Phân mức điểm 0–100. Ngưỡng tạm thời do frontend đề xuất,
 * cần chốt cùng rubric STAR (PRD US-SV-04 còn để ngỏ).
 */
export function starLevel(score: number): StarLevel {
  if (score >= 85) return "good"
  if (score >= 75) return "fair"
  if (score >= 70) return "average"
  return "weak"
}

export const STAR_LEVEL_STYLE: Record<StarLevel, { label: string; text: string; bar: string; badge: string }> = {
  good: { label: "Tốt", text: "text-good", bar: "bg-good", badge: "bg-good-soft text-good" },
  fair: { label: "Khá", text: "text-blue", bar: "bg-blue", badge: "bg-blue-soft text-blue" },
  average: { label: "Trung bình", text: "text-violet", bar: "bg-violet", badge: "bg-violet-soft text-violet" },
  weak: { label: "Cần cải thiện", text: "text-bad", bar: "bg-bad", badge: "bg-bad-soft text-bad" },
}

export function starAverage(star: StarScore): number {
  return (star.situation + star.task + star.action + star.result) / 4
}

/** Nhận định cho điểm tổng một buổi hoặc điểm một câu (0–100). Ngưỡng tạm thời, cần chốt cùng rubric STAR. */
export function scoreVerdict(score: number) {
  if (score >= 85) return { label: "Xuất sắc", className: "text-good", badge: "bg-good-soft text-good" }
  if (score >= 75) return { label: "Tốt", className: "text-blue", badge: "bg-blue-soft text-blue" }
  if (score >= 65) return { label: "Khá", className: "text-violet", badge: "bg-violet-soft text-violet" }
  return { label: "Cần cải thiện", className: "text-bad", badge: "bg-bad-soft text-bad" }
}
