import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: ReactNode
  /** Một nút dẫn tới hành động tạo dữ liệu. */
  action?: ReactNode
  className?: string
}

/** Trạng thái rỗng lần đầu (DESIGN.md mục 9): icon trong vòng tròn xám, tiêu đề, một câu, một nút. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span className="mb-1 grid size-11 place-items-center rounded-full bg-surface text-ink-3">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
