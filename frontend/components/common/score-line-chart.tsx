"use client"

import { useId } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts"

import { cn } from "@/lib/utils"

export interface ScorePoint {
  /** Nhãn trục X, ví dụ "Buổi 3", "Tuần 2". */
  label: string
  /** Dòng phụ dưới nhãn, ví dụ ngày. */
  sub?: string
  value: number
  /** Dòng mô tả thêm trong tooltip, ví dụ tên vòng phỏng vấn. */
  detail?: string
}

interface ScoreLineChartProps {
  points: ScorePoint[]
  /** Đường tham chiếu nét đứt, ví dụ mức mục tiêu. */
  target?: { value: number; label: string } | null
  /** Tô màu điểm đầu (vàng), cao nhất (tím) và gần nhất (xanh lá). */
  highlight?: boolean
  /** Hậu tố trong tooltip, ví dụ "điểm STAR", "điểm TB". */
  unit?: string
  /** Điểm tối đa của thang: 100 (mặc định) hoặc 5 (STAR theo PRD mục 5.1). */
  max?: number
  /** Màn hẹp (< 640px) chỉ hiện nhãn trục X xen kẽ, luôn giữ nhãn cuối (khi có nhiều điểm). */
  sparseTicksOnMobile?: boolean
  className?: string
}

/** Biểu đồ vùng cho điểm theo thời gian (thang 0–100 hoặc 0–5). Màu lấy từ token CSS. */
export function ScoreLineChart({
  points,
  target,
  highlight = false,
  unit = "điểm",
  max = 100,
  sparseTicksOnMobile = false,
  className = "h-64",
}: ScoreLineChartProps) {
  const gradientId = `score-fill-${useId().replace(/:/g, "")}`
  const last = points.length - 1
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0)
  const yTicks = max <= 10 ? Array.from({ length: max + 1 }, (_, i) => i) : percentTicks(points, target)
  const data = points.map((p, index) => ({ ...p, index }))
  const format = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

  function renderTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
    const point = payload?.[0]?.payload as (ScorePoint & { index: number }) | undefined
    if (!active || !point) return null
    return (
      <div className="grid gap-0.5 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-float">
        <p className="font-heading font-bold text-ink">
          {point.label}
          {point.sub && ` · ${point.sub}`}
        </p>
        {point.detail && <p className="text-ink-2">{point.detail}</p>}
        <p className="font-semibold text-blue">
          {format(point.value)}/{max} {unit}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn("w-full", className)}
      role="img"
      aria-label={points.map((p) => `${p.label} ${format(p.value)}/${max}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--blue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="index"
            axisLine={false}
            tickLine={false}
            interval={0}
            height={points.some((p) => p.sub) ? 40 : 24}
            padding={{ left: 16, right: 16 }}
            tick={({ x, y, payload }) => {
              const p = points[payload.value as number]
              if (!p) return <g />
              const isLast = payload.value === last
              const hideOnMobile = sparseTicksOnMobile && (last - (payload.value as number)) % 2 === 1
              return (
                <g transform={`translate(${x},${y})`} className={hideOnMobile ? "max-sm:hidden" : undefined}>
                  <text textAnchor="middle" dy={14} fontSize={12} fontWeight={isLast ? 700 : 500} fill={isLast ? "var(--ink)" : "var(--ink-2)"}>
                    {p.label}
                  </text>
                  {p.sub && (
                    <text textAnchor="middle" dy={30} fontSize={11} fill="var(--ink-3)">
                      {p.sub}
                    </text>
                  )}
                </g>
              )
            }}
          />
          <YAxis domain={[yTicks[0], max]} ticks={yTicks} axisLine={false} tickLine={false} tick={{ fill: "var(--ink-3)", fontSize: 12 }} />
          {target && <ReferenceLine y={target.value} stroke="var(--ink-3)" strokeDasharray="5 4" />}
          <Tooltip content={renderTooltip} cursor={{ stroke: "var(--line)" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--blue)"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 6, fill: "var(--blue)", stroke: "var(--card)", strokeWidth: 2 }}
            dot={(props) => {
              const { cx, cy, index } = props as { cx: number; cy: number; index: number }
              if (!highlight) {
                return <circle key={index} cx={cx} cy={cy} r={4} fill="var(--card)" stroke="var(--blue)" strokeWidth={2.5} />
              }
              const color =
                index === 0 ? "var(--warn)" : index === last ? "var(--good)" : index === peak ? "var(--violet)" : "var(--blue)"
              const filled = index === peak && index !== last
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={index === last || filled ? 6 : 4.5}
                  fill={filled ? color : "var(--card)"}
                  stroke={color}
                  strokeWidth={2.5}
                />
              )
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Thang 100: bắt đầu trục Y gần điểm thấp nhất để thấy rõ chênh lệch. */
function percentTicks(points: ScorePoint[], target?: { value: number } | null): number[] {
  const minScore = Math.min(...points.map((p) => p.value), target?.value ?? 100)
  const yMin = Math.max(0, Math.floor((minScore - 10) / 10) * 10)
  const yStep = 100 - yMin > 50 ? 20 : 10
  return Array.from({ length: Math.floor((100 - yMin) / yStep) + 1 }, (_, i) => 100 - i * yStep).reverse()
}

/** Chỉ số của điểm cao nhất (dùng cho chú thích "Cao nhất: ..."). */
export function peakIndex(points: ScorePoint[]): number {
  return points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0)
}
