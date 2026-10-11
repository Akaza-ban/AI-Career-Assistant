import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface TaskCardProps {
  icon: LucideIcon
  /** Loại việc, ví dụ "Trình tối ưu CV", "Phỏng vấn thử". */
  kind: string
  title: ReactNode
  /** Dòng thông tin, ví dụ "Đã xử lý 4 / 7 gợi ý · còn 3 gợi ý". */
  meta?: ReactNode
  /** Tiến độ liên tục 0–1 (thanh) hoặc theo bước (các đoạn). Bỏ trống thì không hiện. */
  progress?: { value: number } | { done: number; total: number }
  /** Chữ nhỏ bên trái nút, ví dụ "Mở lần cuối hôm qua". */
  footnote?: ReactNode
  action: { label: string; href: string }
  className?: string
}

/** Thẻ "Việc nên làm tiếp": dữ liệu thật và một hành động, không chứa hình minh hoạ (DESIGN.md mục 6). */
export function TaskCard({ icon: Icon, kind, title, meta, progress, footnote, action, className }: TaskCardProps) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card bg-card p-5 shadow-card transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-float",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid size-[34px] place-items-center rounded-[10px] bg-blue-soft text-blue">
          <Icon className="size-[17px]" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="text-[13px] text-ink-3">{kind}</span>
      </div>
      <div>
        <h3 className="font-heading text-[17px] leading-6 font-semibold text-ink">{title}</h3>
        {meta && <p className="mt-0.5 text-sm text-ink-3">{meta}</p>}
      </div>
      {progress && "value" in progress && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full rounded-full bg-blue" style={{ width: `${Math.round(progress.value * 100)}%` }} />
        </div>
      )}
      {progress && "total" in progress && (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: progress.total }, (_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < progress.done ? "bg-blue" : "bg-surface")} />
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="min-w-0 truncate text-[13px] text-ink-3">{footnote}</span>
        <Link
          href={action.href}
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]"
        >
          {action.label}
        </Link>
      </div>
    </article>
  )
}

type QuickLinkProps = { icon: LucideIcon; label: string } & ({ href: string } | { onClick: () => void })

const quickLinkClass =
  "flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3.5 text-left text-sm font-semibold text-ink shadow-card transition-transform active:scale-[0.98]"

/** Lối tắt dạng dòng trắng: icon, nhãn, mũi tên (cột phải của "Việc nên làm tiếp"). Nhận href hoặc onClick. */
export function QuickLink(props: QuickLinkProps) {
  const { icon: Icon, label } = props
  const content = (
    <>
      <Icon className="size-[18px] text-ink-2" strokeWidth={1.75} aria-hidden />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-ink-3" aria-hidden />
    </>
  )
  if ("href" in props) {
    return (
      <Link href={props.href} className={quickLinkClass}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={props.onClick} className={quickLinkClass}>
      {content}
    </button>
  )
}
