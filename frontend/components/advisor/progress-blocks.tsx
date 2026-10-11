"use client"

import { Sparkles } from "lucide-react"

import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { DeltaLine, StarCompare } from "@/components/student/history/history-sections"
import { Badge } from "@/components/ui/badge"
import { formatPercent } from "@/lib/analysis"
import { formatDate } from "@/lib/format"
import { STAR_META, STAR_ORDER, formatScore } from "@/lib/interview"
import type { CvProgress, InterviewProgress, StarSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

// Khối số liệu tiến bộ dùng chung cho dòng mở rộng ở danh sách SV và hồ sơ SV (số liệu luôn xem được).

/** Điểm 0–5 của một vị trí qua các buổi, chênh lệch theo PRD 5.1 và S/T/A/R buổi trước so với gần nhất. */
export function InterviewProgressBlock({ group, compact = false }: { group: InterviewProgress; compact?: boolean }) {
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
            <span className="font-semibold text-ink">{group.jd.title}</span>
            {group.jd.company && <span className="text-xs text-ink-2">{group.jd.company}</span>}
          </p>
          <Badge variant="neutral">{group.session_count} buổi</Badge>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          <p className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-[26px] leading-8 text-ink">{formatScore(group.latest_score)}</span>
            <span className="text-[15px] text-ink-3">/ 5</span>
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
    return <p className="py-3 text-sm text-ink-3">Sinh viên chưa có lượt phân tích CV–JD nào.</p>
  }
  // Mỗi JD một nhóm; các dòng phiên bản ngăn bằng đường kẻ mảnh, bản mới nhất tô màu nhấn.
  return (
    <ul className="grid gap-6">
      {groups.map((group) => (
        <li key={group.jd.id} className="grid">
          {groups.length > 1 && (
            <p className="flex flex-wrap items-center justify-between gap-2 pb-1 text-sm">
              <span className="font-medium text-ink">{group.jd.title}</span>
              {group.delta !== null && group.delta !== 0 && (
                <span
                  className={cn(
                    "rounded-badge border px-1.5 text-xs leading-5 font-semibold tabular-nums",
                    group.delta > 0 ? "border-good-line bg-good-soft text-good" : "border-warn-line bg-warn-soft text-warn",
                  )}
                >
                  {group.delta > 0 ? "+" : ""}
                  {formatPercent(group.delta)}
                </span>
              )}
            </p>
          )}
          <ul className="grid">
            {group.points.map((p, i) => {
              const last = i === group.points.length - 1
              return (
                <li
                  key={p.analysis_id}
                  className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-3 border-b border-line py-[11px] text-sm"
                >
                  <span className={cn("tabular-nums", last ? "font-medium text-ink" : "text-ink-3")}>{p.cv_label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <span
                      className={cn("block h-full rounded-full", last ? "bg-blue" : "bg-line-strong")}
                      style={{ width: `${p.match_score}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold text-ink tabular-nums">{formatPercent(p.match_score)}%</span>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

/** Điểm trung bình S/T/A/R (mặc định: tối đa 5 buổi gần nhất của một SV), tiêu chí yếu nhất tô màu cảnh báo. */
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
  if (!star) return <p className="py-3 text-sm text-ink-3">Chưa có buổi phỏng vấn nào.</p>
  return (
    <div className="grid">
      <ul className="grid">
        {STAR_ORDER.map((key) => {
          const score = star.average[key]
          const weak = key === star.weakest
          return (
            <li
              key={key}
              className="grid grid-cols-[minmax(92px,110px)_minmax(0,1fr)_40px] items-center gap-3 border-b border-line py-2.5"
            >
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-ink">{STAR_META[key].label}</span>
                <span className="text-xs text-ink-3">{STAR_META[key].letter}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <span className={cn("block h-full rounded-full", weak ? "bg-warn/70" : "bg-blue")} style={{ width: `${(score / 5) * 100}%` }} />
              </span>
              <span className={cn("text-right font-semibold tabular-nums", weak ? "text-warn" : "text-ink")}>
                {formatScore1(score)}
                {weak && <span className="sr-only"> (yếu nhất)</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {caption !== null && (
        <p className="mt-2.5 text-[13px] text-ink-3">
          {caption ?? (star.session_count ? `Trung bình ${star.session_count} buổi gần nhất, thang 0–5.` : "Thang 0–5.")}
        </p>
      )}
      {insight && (
        <p className="mt-3 flex gap-2 text-sm leading-6 text-ink-2">
          <Sparkles className="mt-1 size-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
          <span>{insight}</span>
        </p>
      )}
    </div>
  )
}

/** Gợi ý cho buổi tư vấn tới, ghép từ số liệu của SV theo quy tắc (không dùng AI). */
export function SuggestionList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="py-3 text-sm text-ink-3">Chưa có gợi ý nào: sinh viên đang tiến triển ổn định.</p>
  return (
    <ol className="grid">
      {items.map((s, i) => (
        <li key={s} className="flex gap-3 border-b border-line py-3.5">
          <span
            className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-soft text-xs font-semibold text-accent-strong tabular-nums"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="text-[15px] leading-6 text-ink-2">{s}</span>
        </li>
      ))}
    </ol>
  )
}

/** Điểm thang 5 luôn một chữ số thập phân: "4,0", "3,8". */
function formatScore1(n: number) {
  return n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
