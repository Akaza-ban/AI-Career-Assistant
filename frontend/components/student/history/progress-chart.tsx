"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts"

export interface ProgressPoint {
  /** Nhãn trục X, ví dụ "14/09" hoặc "v2.1". */
  label: string
  value: number
  /** Dòng mô tả trong tooltip, ví dụ ngày đầy đủ. */
  detail?: string
}

interface ProgressChartProps {
  points: ProgressPoint[]
  /** Các vạch trục Y, ví dụ [1, 3, 5] hoặc [0, 50, 100]. */
  ticks: number[]
  /** Vạch ngưỡng nét đứt màu xanh lá, ví dụ mức "Cao" 75%. */
  threshold?: { value: number; label: string }
  format: (value: number) => string
}

/**
 * Biểu đồ đường mảnh của màn Lịch sử & tiến bộ (bản vẽ TienBo): 3 vạch ngang, chấm rỗng, chấm cuối tô đặc.
 * Khác `ScoreLineChart` ở trục Y cố định toàn thang và vạch ngưỡng có nhãn.
 */
export function ProgressChart({ points, ticks, threshold, format }: ProgressChartProps) {
  const last = points.length - 1
  const data = points.map((p, index) => ({ ...p, index }))

  function renderTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
    const point = payload?.[0]?.payload as (ProgressPoint & { index: number }) | undefined
    if (!active || !point) return null
    return (
      <div className="grid gap-0.5 rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-float">
        <p className="font-semibold text-ink">{point.detail ?? point.label}</p>
        <p className="text-ink-2 tabular-nums">{format(point.value)}</p>
      </div>
    )
  }

  return (
    <div
      className="mt-3.5 h-[200px] w-full"
      role="img"
      aria-label={points.map((p) => `${p.label}: ${format(p.value)}`).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={10}
            padding={{ left: 10, right: 10 }}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
          />
          <YAxis
            domain={[ticks[0], ticks[ticks.length - 1]]}
            ticks={ticks}
            axisLine={false}
            tickLine={false}
            width={40}
            tick={{ fill: "var(--ink-3)", fontSize: 11 }}
          />
          {threshold && (
            <ReferenceLine
              y={threshold.value}
              stroke="var(--good)"
              strokeDasharray="4 4"
              label={{ value: threshold.label, position: "insideTopLeft", fill: "var(--good)", fontSize: 11 }}
            />
          )}
          <Tooltip content={renderTooltip} cursor={{ stroke: "var(--line)" }} />
          <Line
            type="linear"
            dataKey="value"
            stroke="var(--blue)"
            strokeWidth={2}
            isAnimationActive={false}
            activeDot={{ r: 5, fill: "var(--blue)", stroke: "var(--card)", strokeWidth: 2 }}
            dot={(props) => {
              const { cx, cy, index } = props as { cx: number; cy: number; index: number }
              const isLast = index === last
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 5 : 3.5}
                  fill={isLast ? "var(--blue)" : "var(--card)"}
                  stroke="var(--blue)"
                  strokeWidth={2}
                />
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
