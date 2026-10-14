import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Nút hoặc bộ chọn đặt đối diện bên phải (ví dụ "Gợi ý theo [CV ▾]"). */
  actions?: ReactNode
  className?: string
}

/**
 * Tiêu đề đầu trang, cùng cỡ chữ và bố cục với lời chào ở Tổng quan (DESIGN.md 3.4): tiêu đề 40/46 weight 600,
 * một dòng mô tả 17px, nút đặt đối diện bên phải và căn theo đáy khối chữ.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-8 pb-2 md:pt-12", className)}>
      <div className="min-w-0 flex-[1_1_480px]">
        <h1 className="font-heading text-[30px] leading-9 font-semibold tracking-[-0.025em] text-balance text-ink md:text-[40px] md:leading-[46px]">
          {title}
        </h1>
        {description && <p className="mt-2.5 text-base leading-[26px] text-ink-2 md:text-[17px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}
