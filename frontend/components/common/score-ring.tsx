import { cn } from "@/lib/utils"

export type ScoreTone = "good" | "blue" | "violet" | "warn" | "bad"

const toneClass: Record<ScoreTone, { stroke: string; text: string }> = {
  good: { stroke: "stroke-good", text: "text-good" },
  blue: { stroke: "stroke-blue", text: "text-blue" },
  violet: { stroke: "stroke-violet", text: "text-violet" },
  warn: { stroke: "stroke-warn", text: "text-warn" },
  bad: { stroke: "stroke-bad", text: "text-bad" },
}

/** Màu theo điểm ATS/độ khớp: ≥80 xanh lá, ≥70 xanh dương, còn lại tím (ngưỡng tạm thời). */
export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return "good"
  if (score >= 70) return "blue"
  return "violet"
}

interface ScoreRingProps {
  score: number
  /** Đường kính (px). */
  size?: number
  strokeWidth?: number
  tone?: ScoreTone
  className?: string
  /** Cỡ chữ số ở giữa (class Tailwind). */
  labelClassName?: string
}

/** Vòng tròn điểm 0–100 (dùng cho điểm ATS, % khớp JD). */
export function ScoreRing({ score, size = 44, strokeWidth = 4, tone, className, labelClassName }: ScoreRingProps) {
  const t = toneClass[tone ?? scoreTone(score)]
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${score} trên 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-blue-soft" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={t.stroke}
        />
      </svg>
      <span className={cn("absolute font-heading font-bold", t.text, labelClassName ?? "text-base")}>{score}</span>
    </span>
  )
}
