import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Vùng nội dung lớn kiểu dashboard Stripe (DESIGN.md mục 7): tiêu đề 26px + đường kẻ dưới, bên trong là các khối
 * không có viền. Thay cho việc bọc nội dung trong thẻ.
 */
export function Zone({
  id,
  title,
  aside,
  className,
  children,
}: {
  id: string
  title: ReactNode
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3.5">
        <h2 id={id} className="text-[22px] leading-7 font-semibold text-ink sm:text-[26px] sm:leading-8">
          {title}
        </h2>
        {aside}
      </div>
      <div className="pt-7">{children}</div>
    </section>
  )
}

/** Link nhỏ đặt ở góc phải tiêu đề vùng hoặc chân khối. */
export function ZoneLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-sm font-semibold text-blue hover:text-accent-strong">
      {children}
    </Link>
  )
}

/** Dòng chân của một khối: link bên trái, ghi chú nhỏ bên phải — giúp thấy khối kết thúc ở đâu. */
export function WidgetFooter({
  link,
  note,
  className,
}: {
  link?: { label: string; href: string }
  note?: ReactNode
  className?: string
}) {
  if (!link && !note) return null
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      {link ? <ZoneLink href={link.href}>{link.label}</ZoneLink> : <span />}
      {note && <span className="text-right text-ink-3">{note}</span>}
    </div>
  )
}
