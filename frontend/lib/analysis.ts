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

/** Thấp (< 50) / Trung bình (50–74) / Cao (≥ 75). */
export const MATCH_LABEL_META: Record<
  MatchLabel,
  { text: string; className: string; bar: string; badge: "bad" | "warn" | "good" }
> = {
  low: { text: "Thấp", className: "text-bad", bar: "bg-bad", badge: "bad" },
  medium: { text: "Trung bình", className: "text-warn", bar: "bg-warn", badge: "warn" },
  high: { text: "Cao", className: "text-good", bar: "bg-good", badge: "good" },
}

/** "80,6" */
export const formatPercent = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
