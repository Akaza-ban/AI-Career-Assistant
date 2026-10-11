import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Mảnh giao diện nhỏ dùng chung cho các tab Hồ sơ sinh viên (bản vẽ HoSoSinhVien, NhanXetPV).

/** Điểm thang 5 luôn một chữ số thập phân: "4,0", "3,8" (DESIGN.md 8.1: phỏng vấn hiện x,x / 5). */
export function score1(n: number): string {
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** "+1,3" / "−0,4" cho badge chênh lệch. */
export function signed(n: number, format: (abs: number) => string): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${format(Math.abs(n))}`
}

/** Badge chênh lệch kiểu Stripe: dương xanh lá, âm màu cảnh báo, bằng 0 xám. */
export function DeltaBadge({ value, text }: { value: number; text: string }) {
  return (
    <span
      className={cn(
        "rounded-badge border px-1.5 text-xs leading-5 font-semibold whitespace-nowrap tabular-nums",
        value > 0
          ? "border-good-line bg-good-soft text-good"
          : value < 0
            ? "border-warn-line bg-warn-soft text-warn"
            : "border-line-strong bg-surface text-ink-2",
      )}
    >
      {text}
    </span>
  )
}

/** "09/10" */
export function dayMonth(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** "x,x / 5" với "/ 5" nhỏ và nhạt. */
export function OutOfFive({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {score1(score)}
      <span className="text-[0.6em] font-normal text-ink-3"> / 5</span>
    </span>
  )
}

/** Thanh ngang mảnh 6px; `tone="warn"` cho tiêu chí yếu nhất, `"muted"` cho bản cũ. */
export function ThinBar({ value, tone = "accent", className }: { value: number; tone?: "accent" | "warn" | "muted"; className?: string }) {
  return (
    <span className={cn("block h-1.5 overflow-hidden rounded-full bg-surface", className)} aria-hidden>
      <span
        className={cn(
          "block h-full rounded-full",
          tone === "warn" ? "bg-warn/70" : tone === "muted" ? "bg-line-strong" : "bg-blue",
        )}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </span>
  )
}

/** Chip chọn được (thẻ ghi chú, mẫu câu nhận xét). */
export function ChoiceChip({
  on = false,
  onClick,
  children,
  className,
  ...aria
}: {
  on?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  "aria-pressed"?: boolean
  "aria-label"?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...aria}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
        on
          ? "bg-panel text-ink ring-[1.5px] ring-ink ring-inset"
          : "bg-card text-ink-2 ring-1 ring-line-strong ring-inset hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Tiêu đề khối 16px trong một vùng (không phụ đề). */
export function BlockTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold text-ink", className)}>{children}</h3>
}
