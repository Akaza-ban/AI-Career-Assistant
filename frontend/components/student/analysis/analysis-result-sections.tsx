import type { ComponentProps, ReactNode } from "react"
import { TriangleAlert } from "lucide-react"

import { WidgetFooter } from "@/components/common/zone"
import type { MatchStatus, RequirementImportance } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Thứ tự và nhãn nhóm yêu cầu trên trang kết quả (DESIGN.md mục 6, SkillRow). */
export const TIERS: { importance: RequirementImportance; label: string; weight: number }[] = [
  { importance: "required", label: "Bắt buộc", weight: 3 },
  { importance: "preferred", label: "Ưu tiên", weight: 2 },
  { importance: "additional", label: "Cộng thêm", weight: 1 },
]

export const STATUS_META: Record<MatchStatus, { label: string; badge: "good" | "neutral" | "warn"; dot: string }> = {
  matched: { label: "Đã đáp ứng", badge: "good", dot: "bg-current" },
  // Chấm nửa đặc để trạng thái không chỉ phân biệt bằng màu.
  partial: { label: "Chỉ liệt kê", badge: "neutral", dot: "bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" },
  missing: { label: "Còn thiếu", badge: "warn", dot: "bg-transparent" },
}

/** "SQL", "SQL và Excel", "SQL, Excel và 2 kỹ năng khác" */
export function joinSkills(names: string[]): string {
  if (names.length <= 2) return names.join(" và ")
  return `${names.slice(0, 2).join(", ")} và ${names.length - 2} kỹ năng khác`
}

/**
 * Một khối trong vùng (DESIGN.md 3.6): tiêu đề 16px, không phụ đề, các dòng kẻ mảnh và dòng chân ở đáy.
 * Không có viền bao quanh; tiêu đề và dòng chân cho biết khối bắt đầu và kết thúc ở đâu.
 */
export function ResultWidget({
  id,
  title,
  icon,
  footer,
  className,
  children,
}: {
  id: string
  title: string
  icon?: ReactNode
  footer?: ComponentProps<typeof WidgetFooter>
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col", className)}>
      <h3 id={id} className="mb-1.5 flex items-center gap-2 text-base font-semibold text-ink">
        {icon}
        {title}
      </h3>
      <div className="flex-1">{children}</div>
      {footer && <WidgetFooter {...footer} className="mt-3.5" />}
    </section>
  )
}

/** Chế độ dự phòng khi LLM lỗi (DESIGN.md mục 9). */
export function FallbackBanner() {
  return (
    <p className="flex items-start gap-2 rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      Kết quả được tạo bằng quy tắc, chưa có đánh giá AI chi tiết. Điểm vẫn chấm theo cùng rubric.
    </p>
  )
}

