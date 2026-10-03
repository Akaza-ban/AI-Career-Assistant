"use client"

import { Sparkles } from "lucide-react"

import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { DeltaLine, StarCompare } from "@/components/student/history/history-sections"
import { Badge } from "@/components/ui/badge"
import { formatPercent } from "@/lib/analysis"
import { formatDate } from "@/lib/format"
import { LABEL_META, STAR_META, STAR_ORDER, formatScore, labelOf } from "@/lib/interview"
import type { CvProgress, InterviewProgress, StarSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

// Khối số liệu tiến bộ dùng chung cho dòng mở rộng ở danh sách SV và hồ sơ SV (số liệu luôn xem được).

/** Điểm 0–5 của một vị trí qua các buổi, chênh lệch theo PRD 5.1 và S/T/A/R buổi trước so với gần nhất. */
export function InterviewProgressBlock({ group, compact = false }: { group: InterviewProgress; compact?: boolean }) {
  const label = LABEL_META[labelOf(group.latest_score)]
  const points: ScorePoint[] = group.points.map((p, i) => ({
    label: `Buổi ${i + 1}`,
    sub: formatDate(p.completed_at).slice(0, 5),
    value: p.score,
  }))
  const previousIsFirst = group.previous_session_id === group.points[0].id
  return (
    <div className={cn("grid gap-4", !compact && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")}>
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="grid">
            <span className="font-heading font-bold text-ink">{group.jd.title}</span>
            {group.jd.company && <span className="text-xs text-ink-2">{group.jd.company}</span>}
          </p>
          <Badge variant="neutral">{group.session_count} buổi</Badge>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <p className="flex items-end gap-1.5">
            <span className={cn("font-heading text-3xl leading-none font-extrabold", label.className)}>
              {formatScore(group.latest_score)}
            </span>
            <span className="text-sm font-semibold text-ink-3">/5</span>
            <Badge variant="neutral" className={label.badge}>
              {label.text}
            </Badge>
          </p>
          {group.delta_from_previous !== null ? (
            <div className="grid gap-0.5">
              <DeltaLine label="so với buổi trước" delta={group.delta_from_previous} />
              {group.delta_from_first !== null && !previousIsFirst && (
                <p className="text-xs text-ink-2">
                  {group.delta_from_first > 0 ? "+" : ""}
                  {formatScore(group.delta_from_first)} so với buổi đầu ({formatScore(group.first_score)} →{" "}
                  {formatScore(group.latest_score)})
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-2">Mới có 1 buổi ở vị trí này.</p>
          )}
        </div>
        {points.length > 1 && (
          <ScoreLineChart points={points} highlight max={5} unit="điểm STAR" className={compact ? "h-40" : "h-48"} />
        )}
      </div>
      <StarCompare group={group} />
    </div>
  )
}

/** Độ khớp CV–JD qua các phiên bản CV, mỗi JD một nhóm. */
export function CvProgressBlock({ groups }: { groups: CvProgress[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-ink-2">Sinh viên chưa có lượt phân tích CV–JD nào.</p>
  }
  // Mỗi JD một nhóm, ngăn bằng đường kẻ (không lồng ô trong ô).
  return (
    <ul className="grid divide-y divide-line">
      {groups.map((group) => (
        <li key={group.jd.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-ink">{group.jd.title}</span>
            {group.delta !== null && (
              <Badge variant={group.delta > 0 ? "good" : group.delta < 0 ? "bad" : "neutral"}>
                {group.delta === 0 ? "Không đổi" : `${group.delta > 0 ? "+" : ""}${formatPercent(group.delta)} điểm`}
              </Badge>
            )}
          </p>
          <ul className="grid gap-1.5">
            {group.points.map((p, i) => {
              const last = i === group.points.length - 1
              return (
                <li key={p.analysis_id} className="grid grid-cols-[56px_minmax(0,1fr)_52px] items-center gap-2 text-xs">
                  <span className={cn(last ? "font-semibold text-ink" : "text-ink-2")}>CV {p.cv_label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <span
                      className={cn("block h-full rounded-full", last ? "bg-blue" : "bg-blue/35")}
                      style={{ width: `${p.match_score}%` }}
                    />
                  </span>
                  <span className={cn("text-right font-heading", last ? "font-bold text-ink" : "text-ink-2")}>
                    {formatPercent(p.match_score)}%
                  </span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

/** Điểm trung bình S/T/A/R (mặc định: tối đa 5 buổi gần nhất của một SV), đánh dấu tiêu chí yếu nhất. */
export function StarAverageBars({
  star,
  insight,
  caption,
}: {
  star: (Pick<StarSummary, "average" | "weakest"> & { session_count?: number }) | null
  insight: string | null
  /** null: không hiện chú thích (trang đã đặt chú thích dưới tiêu đề mục). */
  caption?: string | null
}) {
  if (!star) return <p className="text-sm text-ink-2">Chưa có buổi phỏng vấn nào.</p>
  return (
    <div className="grid gap-3">
      {caption !== null && (
        <p className="text-xs text-ink-2">{caption ?? `Trung bình ${star.session_count} buổi gần nhất (mọi vị trí), thang 0–5`}</p>
      )}
      <ul className="grid gap-2.5">
        {STAR_ORDER.map((key) => {
          const score = star.average[key]
          const weak = key === star.weakest
          return (
            <li key={key} className="grid gap-1">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-ink">
                  <span className="grid size-5 place-items-center rounded-md bg-blue-soft text-[11px] font-bold text-blue">
                    {STAR_META[key].letter}
                  </span>
                  {STAR_META[key].label}
                  {weak && <Badge variant="warn">Yếu nhất</Badge>}
                </span>
                <span className="font-heading font-semibold text-ink">{formatScore(score)}/5</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className={cn("h-full rounded-full", weak ? "bg-warn" : "bg-blue")} style={{ width: `${(score / 5) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      {insight && (
        <p className="flex gap-2 rounded-xl bg-violet-soft/60 p-3 text-xs leading-5 text-ink">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
          <span>{insight}</span>
        </p>
      )}
    </div>
  )
}

/** Gợi ý cho buổi tư vấn tới, ghép từ số liệu của SV theo quy tắc (không dùng AI). */
export function SuggestionList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-2">Chưa có gợi ý nào: sinh viên đang tiến triển ổn định.</p>
  return (
    <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-ink">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  )
}

