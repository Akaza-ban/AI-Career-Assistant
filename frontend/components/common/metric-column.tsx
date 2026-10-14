import type { ReactNode } from "react"

import { WidgetFooter } from "@/components/common/zone"
import { cn } from "@/lib/utils"

interface MetricColumnProps {
  label: string
  value: ReactNode
  /** Mức thay đổi so với lần trước, ví dụ "+22,3"; dương thì badge xanh, âm thì badge cảnh báo. */
  delta?: { text: string; positive: boolean }
  /** Số so sánh nhỏ cạnh số chính, ví dụ "58,3% ở CV v1.0". */
  compare?: ReactNode
  /** Chuỗi giá trị theo thời gian để vẽ đường mảnh; cần ít nhất 2 điểm. */
  points?: number[]
  link?: { label: string; href: string }
  /** Chữ nhỏ bên phải dòng chân, ví dụ "Cập nhật 08/10". */
  note?: ReactNode
}

/** Một khối chỉ số kiểu Stripe: tiêu đề + badge thay đổi, số, đường biểu đồ mảnh, dòng chân (DESIGN.md mục 6). */
export function MetricColumn({ label, value, delta, compare, points, link, note }: MetricColumnProps) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">{label}</h3>
        {delta && (
          <span
            className={cn(
              "rounded-badge border px-1.5 text-xs leading-5 font-semibold tabular-nums",
              delta.positive ? "border-good-line bg-good-soft text-good" : "border-warn-line bg-warn-soft text-warn",
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[26px] leading-8 text-ink tabular-nums">{value}</span>
        {compare && <span className="text-sm text-ink-3 tabular-nums">{compare}</span>}
      </span>
      {points && points.length > 1 && <Sparkline points={points} />}
      <WidgetFooter link={link} note={note} className="mt-auto pt-3" />
    </div>
  )
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const coords = points
    .map((v, i) => `${((i / (points.length - 1)) * 300).toFixed(1)},${(64 - ((v - min) / span) * 52).toFixed(1)}`)
    .join(" ")
  return (
    <svg viewBox="0 0 300 72" preserveAspectRatio="none" className="mt-3 block h-[72px] w-full" aria-hidden>
      <line x1="0" y1="71" x2="300" y2="71" className="stroke-line" />
      <polyline
        points={coords}
        fill="none"
        className="stroke-blue"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
