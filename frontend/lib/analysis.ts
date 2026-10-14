// Hằng số dùng chung cho lượt phân tích CV–JD (US-SV-02, PRD mục 5.2).

import type { AnalysisStep, MatchLabel } from "@/lib/types"

/** Các bước thật của pipeline phân tích (khớp thứ tự node của gap_analysis_agent). */
export const ANALYSIS_STEPS: { key: AnalysisStep; title: string; description: string }[] = [
  { key: "parse", title: "Đọc CV", description: "Tách nội dung CV theo từng mục" },
  { key: "retrieve", title: "Tra cứu yêu cầu vị trí", description: "Xác định kỹ năng JD yêu cầu và mức độ quan trọng" },
  { key: "compare", title: "So sánh kỹ năng", description: "Đối chiếu từng yêu cầu với bằng chứng trong CV" },
  { key: "generate", title: "Viết gợi ý", description: "Đề xuất cách diễn đạt rõ hơn từ nội dung sẵn có" },
  { key: "verify_grounding", title: "Kiểm tra độ tin cậy", description: "Loại bỏ gợi ý không có căn cứ trong CV" },
]

/** Trung bình (< 50) / Khá (50–74) / Cao (≥ 75), DESIGN.md mục 8.2. Không dùng màu đỏ cho mức thấp. */
export const MATCH_LABEL_META: Record<
  MatchLabel,
  { text: string; className: string; bar: string; badge: "neutral" | "blue" | "good" }
> = {
  low: { text: "Trung bình", className: "text-ink-2", bar: "bg-ink-3", badge: "neutral" },
  medium: { text: "Khá", className: "text-accent-strong", bar: "bg-blue", badge: "blue" },
  high: { text: "Cao", className: "text-good", bar: "bg-good", badge: "good" },
}

/** "80,6" */
export const formatPercent = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
