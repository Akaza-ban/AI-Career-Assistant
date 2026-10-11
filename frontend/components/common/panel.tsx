import type { ComponentProps, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Thẻ trắng bo 16px, viền mảnh, shadow-card (DESIGN.md mục 6). */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-card border border-line bg-card p-6 shadow-card", className)} {...props} />
}

/** Panel xám chứa các thẻ trắng, ví dụ "Việc nên làm tiếp", "Phù hợp nhất với CV" (DESIGN.md mục 6). */
export function SoftPanel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-panel bg-panel p-5 sm:p-6", className)} {...props} />
}

interface PanelHeaderProps {
  icon?: LucideIcon
  title: ReactNode
  /** Nội dung bên phải tiêu đề (badge, link "Xem tất cả"...). */
  aside?: ReactNode
  className?: string
}

interface SectionHeaderProps extends Omit<PanelHeaderProps, "icon"> {
  /** Đường kẻ mảnh dưới tiêu đề, kiểu "Tiến độ của bạn" của Stripe. */
  divider?: boolean
  /** "lg" cho tiêu đề khu vực lớn (22–26px), mặc định 18px. */
  size?: "md" | "lg"
  id?: string
}

/**
 * Tiêu đề một khu vực đặt ngay trên nền trang, link "Xem tất cả" ở bên phải.
 * Ô bên dưới chỉ chứa nội dung, để trang không thành một lưới ô giống nhau.
 */
export function SectionHeader({ title, aside, className, divider = false, size = "md", id }: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-7 flex-wrap items-center justify-between gap-3",
        divider && "border-b border-line pb-3",
        className,
      )}
    >
      <h2
        id={id}
        className={cn(
          "font-heading font-bold text-ink",
          size === "lg" ? "text-[22px] leading-7 sm:text-2xl sm:leading-8" : "text-lg",
        )}
      >
        {title}
      </h2>
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
