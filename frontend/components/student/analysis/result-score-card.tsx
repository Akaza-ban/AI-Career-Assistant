"use client"

import { useEffect, useId, useState } from "react"
import { ChevronDown, Info } from "lucide-react"

import { MatchBadge } from "@/components/common/match-badge"
import { Zone } from "@/components/common/zone"
import { TIERS, joinSkills } from "@/components/student/analysis/analysis-result-sections"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatPercent } from "@/lib/analysis"
import type { GapAnalysis, RequirementAssessment, ScoreBreakdown } from "@/lib/types"
import { cn } from "@/lib/utils"

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** Tiến độ 0→1 (ease-out) cho lần xuất hiện đầu, 1100ms (DESIGN.md 3.8); giảm chuyển động thì hiện ngay. */
function useAppear(duration = 1100) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / duration)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [duration])
  return 1 - Math.pow(1 - t, 3)
}

/** Một hai câu nhận xét dựng từ dữ liệu: ưu tiên nói về yêu cầu bắt buộc, sau đó tới mức ưu tiên. */
function summarize(requirements: RequirementAssessment[]): string {
  const pick = (importance: RequirementAssessment["importance"], status: RequirementAssessment["status"]) =>
    requirements.filter((r) => r.importance === importance && r.status === status).map((r) => r.skill)

  const required = requirements.filter((r) => r.importance === "required")
  const reqMissing = pick("required", "missing")
  const reqPartial = pick("required", "partial")
  const prefMissing = pick("preferred", "missing")
  const prefPartial = pick("preferred", "partial")

  const parts: string[] = []
  if (required.length === 0) {
    const matched = requirements.filter((r) => r.status === "matched").length
    parts.push(`Đáp ứng ${matched}/${requirements.length} yêu cầu của JD.`)
  } else if (reqMissing.length) parts.push(`Còn thiếu ${joinSkills(reqMissing)} ở mức bắt buộc.`)
  else if (reqPartial.length) parts.push(`Có đủ yêu cầu bắt buộc, nhưng ${joinSkills(reqPartial)} mới chỉ được liệt kê.`)
  else parts.push("Đáp ứng đủ yêu cầu bắt buộc.")

  if (reqMissing.length === 0) {
    if (prefMissing.length) parts.push(`Còn thiếu ${joinSkills(prefMissing)} ở mức ưu tiên.`)
    else if (prefPartial.length) parts.push(`${joinSkills(prefPartial)} ở mức ưu tiên mới chỉ được liệt kê.`)
  }
  return parts.join(" ")
}

/**
 * Vùng "Mức phù hợp" (DESIGN.md 3.6): không thẻ bao; bên trái vòng điểm + nhãn + một câu nhận xét, bên phải các cột
 * chỉ số theo mức yêu cầu cùng nhịp với `MetricColumn`. "Cách tính điểm" đặt ở góc phải tiêu đề vùng.
 */
export function ResultScoreCard({ analysis }: { analysis: GapAnalysis }) {
  const gradientId = useId()
  const [showMath, setShowMath] = useState(false)
  const e = useAppear()
  const score = analysis.match_score ?? 0
  const shown = e >= 1 ? score : Math.floor(score * e)
  const tiers = TIERS.flatMap((tier) => {
    const b = analysis.breakdown.find((x) => x.importance === tier.importance)
    return b && b.possible > 0 ? [{ ...tier, b, pct: (b.earned / b.possible) * 100 }] : []
  })

  return (
    <Zone
      id="score-title"
      title="Mức phù hợp"
      aside={
        <div className="-my-2 flex items-center text-sm">
          <button
            type="button"
            onClick={() => setShowMath((v) => !v)}
            aria-expanded={showMath}
            aria-controls="score-math"
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-blue hover:text-accent-strong"
          >
            Cách tính điểm
            <ChevronDown className={cn("size-4 transition-transform", showMath && "rotate-180")} aria-hidden />
          </button>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Giải thích công thức"
                  className="-mr-3 grid size-11 place-items-center rounded-full text-ink-3 hover:text-ink"
                />
              }
            >
              <Info className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-5">
              Điểm = Σ(trọng số × mức khớp) / Σ trọng số × 100. Trọng số: Bắt buộc 3, Ưu tiên 2, Cộng thêm 1. Mức khớp: 1
              khi có bằng chứng cụ thể, 0,5 khi chỉ được liệt kê, 0 khi không có trong CV.
            </TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div data-agent-target="match-score-badge" className="flex flex-wrap items-center gap-x-12 gap-y-10">
        <div className="flex min-w-0 flex-[1_1_380px] items-center gap-5 sm:gap-7">
          <div
            className="relative size-24 shrink-0 sm:size-[124px]"
            role="img"
            aria-label={`Điểm phù hợp ${formatPercent(score)} trên 100`}
          >
            <svg viewBox="0 0 124 124" className="size-full -rotate-90" aria-hidden>
              <defs>
                {/* Ngoại lệ có chủ đích của DESIGN.md mục 4: vòng điểm tô gradient pastel. */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7FC4FF" />
                  <stop offset="55%" stopColor="#9F86FF" />
                  <stop offset="100%" stopColor="#FF8FB8" />
                </linearGradient>
              </defs>
              <circle cx="62" cy="62" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-surface" />
              <circle
                cx="62"
                cy="62"
                r={RING_RADIUS}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - (Math.min(100, score) / 100) * e)}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center" aria-hidden>
              <div>
                <div className="font-heading text-[26px] leading-none font-semibold tabular-nums sm:text-4xl">
                  {formatPercent(shown)}
                </div>
                <div className="mt-1 text-xs text-ink-3">/ 100</div>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
            <MatchBadge label={analysis.match_label ?? "low"} prefix="Mức phù hợp:" />
            <p className="max-w-[440px] text-[15px] leading-6 text-ink sm:text-[17px] sm:leading-[26px]">
              {summarize(analysis.requirements)}
            </p>
          </div>
        </div>

        {tiers.length > 0 && (
          <ul
            className="grid min-w-0 flex-[2_1_520px] grid-cols-3 gap-x-5 gap-y-8 sm:gap-x-12"
            aria-label="Điểm theo mức yêu cầu"
          >
            {tiers.map((t) => (
              <TierMetric key={t.importance} label={t.label} weight={t.weight} b={t.b} pct={t.pct} e={e} />
            ))}
          </ul>
        )}
      </div>

      {showMath && (
        <div id="score-math" className="mt-10 grid gap-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <caption className="sr-only">Phân rã điểm theo mức độ yêu cầu</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-ink-3 uppercase">
                  <th className="pb-2.5 font-medium">Mức độ</th>
                  <th className="pb-2.5 font-medium">Đáp ứng</th>
                  <th className="pb-2.5 font-medium">Liệt kê</th>
                  <th className="pb-2.5 font-medium">Thiếu</th>
                  <th className="pb-2.5 text-right font-medium">Điểm đạt</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {TIERS.map((tier) => {
                  const b = analysis.breakdown.find((x) => x.importance === tier.importance)
                  if (!b) return null
                  return (
                    <tr key={b.importance} className="border-b border-line">
                      <td className="py-3 text-[15px] font-medium text-ink">
                        {tier.label} <span className="text-[13px] font-normal text-ink-3">(×{b.weight})</span>
                      </td>
                      <td className="py-3 text-ink-2">{b.matched}</td>
                      <td className="py-3 text-ink-2">{b.partial}</td>
                      <td className="py-3 text-ink-2">{b.missing}</td>
                      <td className="py-3 text-right text-ink">
                        {formatPercent(b.earned)} / {formatPercent(b.possible)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* PRD mục 8: chỉ diễn giải theo rubric của hệ thống, không nói về khả năng qua ATS hay trúng tuyển */}
          <p className="text-[13px] leading-5 text-ink-3">
            Tổng {formatPercent(analysis.breakdown.reduce((s, b) => s + b.earned, 0))} /{" "}
            {formatPercent(analysis.breakdown.reduce((s, b) => s + b.possible, 0))} điểm trọng số: CV đáp ứng{" "}
            {formatPercent(score)}% tổng trọng số các yêu cầu hệ thống trích từ JD.
          </p>
        </div>
      )}
    </Zone>
  )
}

/** Cột chỉ số của một mức yêu cầu, cùng nhịp với `MetricColumn`: tiêu đề, số 26px, thanh mảnh, dòng chân. */
function TierMetric({
  label,
  weight,
  b,
  pct,
  e,
}: {
  label: string
  weight: number
  b: ScoreBreakdown
  pct: number
  e: number
}) {
  const total = b.matched + b.partial + b.missing
  return (
    <li className="flex min-w-0 flex-col">
      <h3 className="text-base font-semibold text-ink">{label}</h3>
      <span className="mt-1.5 text-[26px] leading-8 text-ink tabular-nums">
        {Math.round(pct * e)}
        <span className="ml-0.5 text-lg text-ink-3">%</span>
      </span>
      <span
        className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-label={`${label}: tỉ lệ điểm đạt`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="block h-full rounded-full bg-blue" style={{ width: `${pct * e}%` }} />
      </span>
      <span className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[13px] text-ink-3 tabular-nums sm:text-sm">
        <span>
          {b.matched}/{total} đáp ứng
        </span>
        <span>trọng số ×{weight}</span>
      </span>
    </li>
  )
}
