"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface HintItem {
  /** Không có: dùng chấm đầu dòng. */
  icon?: LucideIcon
  content: ReactNode
}

interface HintPopoverProps {
  /** Chữ trên nút, ví dụ "Mẹo tối ưu CV". */
  label: string
  icon: LucideIcon
  iconClassName?: string
  title: string
  items: HintItem[]
  /** Class cho khung popover (ví dụ độ rộng). */
  className?: string
}

/**
 * Mẹo / lưu ý gọn trong một nút ở góc hàng tiêu đề trang: rê chuột (hoặc bấm, trên màn hình cảm ứng) mới hiện,
 * để trang bớt chữ. Dùng ở "CV của tôi" (Mẹo tối ưu CV) và "Chia sẻ với Cố vấn" (Lưu ý về chia sẻ).
 */
export function HintPopover({ label, icon: Icon, iconClassName, title, items, className }: HintPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={<Button variant="ghost" className="h-9 gap-1.5 px-3 text-ink-2 hover:text-ink" />}
      >
        <Icon className={iconClassName} aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className={cn("w-80 gap-2 rounded-xl p-4", className)}>
        <p className="font-heading text-sm font-bold text-ink">{title}</p>
        <ul className="grid gap-2">
          {items.map((item, i) => {
            const ItemIcon = item.icon
            return (
              <li key={i} className="flex gap-2 text-[13px] leading-5 text-ink-2">
                {ItemIcon ? (
                  <ItemIcon className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
                ) : (
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                )}
                <span>{item.content}</span>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
