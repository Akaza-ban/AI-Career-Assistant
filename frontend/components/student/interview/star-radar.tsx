"use client"

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts"

import { STAR_KEYS, STAR_LABELS } from "@/lib/star"
import type { StarScore } from "@/lib/types"

const AXIS_NAME: Record<keyof StarScore, string> = {
  situation: "Tình huống",
  task: "Nhiệm vụ",
  action: "Hành động",
  result: "Kết quả",
}

interface StarRadarProps {
  star: StarScore
  /** Vẽ thêm một buổi để so sánh (nét đứt, màu xám), ví dụ buổi đầu tiên. */
  compare?: StarScore | null
  className?: string
}

/** Biểu đồ radar 4 tiêu chí STAR (0–100). Màu lấy từ token CSS. */
export function StarRadar({ star, compare, className = "h-56" }: StarRadarProps) {
  const data = STAR_KEYS.map((key) => ({
    axis: compare ? `${STAR_LABELS[key].letter} - ${AXIS_NAME[key]}` : `${STAR_LABELS[key].letter} (${star[key]})`,
    score: star[key],
    compare: compare?.[key] ?? 0,
  }))
  const label = STAR_KEYS.map(
    (k) => `${STAR_LABELS[k].letter} ${compare ? `${compare[k]} → ` : ""}${star[k]}`,
  ).join(", ")
  return (
    <div className={`w-full ${className}`} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%" margin={{ top: 8, right: 36, bottom: 8, left: 36 }}>
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--ink-2)", fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {compare && (
            <Radar
              dataKey="compare"
              stroke="var(--ink-3)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="var(--ink-3)"
              fillOpacity={0.08}
              isAnimationActive={false}
            />
          )}
          <Radar dataKey="score" stroke="var(--violet)" strokeWidth={2} fill="var(--violet)" fillOpacity={0.18} dot={{ r: 3, fill: "var(--violet)" }} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
