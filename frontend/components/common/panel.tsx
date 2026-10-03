import type { ComponentProps, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Khối nền trắng bo 20px + shadow-card theo DESIGN.md (thẻ/card). */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-[20px] border border-line bg-card p-6 shadow-card", className)} {...props} />
}

interface PanelHeaderProps {
  icon?: LucideIcon
  title: ReactNode
  /** Nội dung bên phải tiêu đề (badge, link "Xem toàn bộ"...). */
  aside?: ReactNode
  className?: string
}

/**
 * Tiêu đề một mục đặt ngoài ô, ngay trên nền trang (link "Xem tất cả" ở bên phải).
 * Ô bên dưới chỉ chứa nội dung, để trang không thành một lưới ô giống nhau và ô nhấn mạnh nổi lên được.
 */
export function SectionHeader({ title, aside, className }: Omit<PanelHeaderProps, "icon">) {
  return (
    <div className={cn("flex min-h-7 flex-wrap items-center justify-between gap-3", className)}>
      <h2 className="font-heading text-lg font-bold text-ink">{title}</h2>
      {aside}
    </div>
  )
}

export function PanelHeader({ icon: Icon, title, aside, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-ink">
        {Icon && <Icon className="size-[18px] text-blue" aria-hidden />}
        {title}
      </h2>
      {aside}
    </div>
  )
}
