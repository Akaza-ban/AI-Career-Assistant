"use client"

import { useMemo, useState } from "react"
import { CalendarDays, CheckCheck, Clock, LineChart, ListChecks, Lock, MessageSquareText, Radar, Sparkles, Timer } from "lucide-react"

import { ReviewDialog } from "@/components/advisor/profile/review-dialog"
import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatRelativeTime, formatWhen } from "@/lib/format"
import { scoreVerdict, STAR_KEYS, STAR_LABELS, STAR_LEVEL_STYLE, starLevel } from "@/lib/star"
import type { AdvisorInterviewItem, AdvisorStudentDetail } from "@/lib/types"
import { cn } from "@/lib/utils"

type SessionFilter = "all" | "pending" | "reviewed" | "private"

const FILTERS: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ nhận xét" },
  { value: "reviewed", label: "Đã nhận xét" },
  { value: "private", label: "Chưa chia sẻ" },
]

function sessionState(item: AdvisorInterviewItem): Exclude<SessionFilter, "all"> {
  if (!item.shared) return "private"
  return item.review ? "reviewed" : "pending"
}

interface ProfileInterviewTabProps {
  detail: AdvisorStudentDetail
  interviews: AdvisorInterviewItem[]
  onReviewed: (item: AdvisorInterviewItem) => void
}

// Figma: frame "Hồ sơ sinh viên - Phỏng vấn & STAR" (18:6025).
export function ProfileInterviewTab({ detail, interviews, onReviewed }: ProfileInterviewTabProps) {
  const { student } = detail
  const [filter, setFilter] = useState<SessionFilter>("all")
  const [reviewing, setReviewing] = useState<AdvisorInterviewItem | null>(null)

  const points: ScorePoint[] = useMemo(
    () =>
      [...interviews].reverse().map((item, i) => ({
        label: `Buổi ${i + 1}`,
        sub: formatDate(item.completed_at).slice(0, 5),
        detail: item.round_title,
        value: item.total_score,
      })),
    [interviews],
  )
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, f.value === "all" ? interviews.length : interviews.filter((i) => sessionState(i) === f.value).length]),
  ) as Record<SessionFilter, number>
  const visible = filter === "all" ? interviews : interviews.filter((i) => sessionState(i) === filter)
  const total = interviews.length

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="grid gap-4">
          <PanelHeader icon={LineChart} title="Tiến trình điểm phỏng vấn" aside={<span className="text-xs text-ink-2">{total} buổi đã chấm</span>} />
          {points.length > 0 ? (
            <ScoreLineChart points={points} highlight unit="điểm STAR" className="h-56" />
          ) : (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-2">Sinh viên chưa có buổi phỏng vấn nào được chấm.</p>
          )}
        </Panel>
        <Panel className="grid gap-4">
          <PanelHeader icon={Radar} title="Tiêu chí STAR" aside={<Badge variant="violet">AI đánh giá</Badge>} />
          {student.star_average ? (
            <>
              <ul className="grid gap-3">
                {STAR_KEYS.map((key) => {
                  const score = student.star_average![key]
                  const level = STAR_LEVEL_STYLE[starLevel(score)]
                  return (
                    <li key={key} className="grid gap-1">
                      <p className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 text-ink">
                          <span className="grid size-5 place-items-center rounded-md bg-blue-soft text-[11px] font-bold text-blue">
                            {STAR_LABELS[key].letter}
                          </span>
                          {STAR_LABELS[key].label}
                        </span>
                        <span className={cn("font-semibold", level.text)}>{score}%</span>
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${score}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              {detail.star_insight && (
                <p className="flex gap-2 rounded-xl bg-violet-soft/60 p-3 text-xs leading-5 text-ink">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
                  <span>
                    <strong className="text-violet">Gợi ý cho cố vấn: </strong>
                    {detail.star_insight}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p className="rounded-xl bg-surface p-4 text-sm text-ink-2">Chưa có dữ liệu STAR được chia sẻ.</p>
          )}
        </Panel>
      </div>

      <section className="grid gap-4" aria-labelledby="sessions-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sessions-heading" className="font-heading text-lg font-bold">
            Các buổi phỏng vấn thử
          </h2>
          <div role="group" aria-label="Lọc buổi phỏng vấn" className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.value ? "bg-blue text-on-blue" : "bg-card text-ink-2 ring-1 ring-line hover:bg-blue-soft",
                )}
              >
                {f.label}
                <span className={cn("rounded-full px-1.5 text-[11px]", filter === f.value ? "bg-card/25" : "bg-surface")}>{counts[f.value]}</span>
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <Panel className="py-10 text-center text-sm text-ink-2">Không có buổi phỏng vấn nào trong mục này.</Panel>
        ) : (
          <ol className="grid gap-4">
            {visible.map((item) => (
              <li key={item.id}>
                <SessionCard item={item} index={total - interviews.indexOf(item)} onReview={() => setReviewing(item)} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <ReviewDialog
        studentId={student.id}
        studentName={student.full_name}
        item={reviewing}
        onClose={() => setReviewing(null)}
        onReviewed={onReviewed}
      />
    </div>
  )
}

function SessionCard({ item, index, onReview }: { item: AdvisorInterviewItem; index: number; onReview: () => void }) {
  const state = sessionState(item)
  const verdict = scoreVerdict(item.total_score)
  const minutes = Math.max(1, Math.round(item.duration_seconds / 60))

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-soft font-heading text-sm font-bold text-blue">
          {String(index).padStart(2, "0")}
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="font-heading font-bold text-ink">
            Buổi {index}: {item.round_title}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatWhen(item.completed_at)}
            </span>
            <span className="flex items-center gap-1">
              <Timer className="size-3.5" aria-hidden />
              {minutes} phút
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="size-3.5" aria-hidden />
              {item.question_count} câu hỏi
            </span>
            <Badge variant="neutral" className="h-auto px-2 py-0.5">
              {item.jd.title}
              {item.jd.company && ` · ${item.jd.company}`}
            </Badge>
          </p>
        </div>
      </div>
      <span className="flex items-center gap-2">
        <span className="text-xs text-ink-2">Điểm AI</span>
        <strong className={cn("font-heading text-lg", verdict.className)}>{item.total_score}/100</strong>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", verdict.badge)}>{verdict.label}</span>
      </span>
    </div>
  )

  if (state === "private") {
    return (
      <Panel className="grid gap-3 bg-surface/60 p-5 shadow-none">
        {header}
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Lock className="size-4" aria-hidden />
          Sinh viên chưa chia sẻ báo cáo chi tiết của buổi này.
        </p>
      </Panel>
    )
  }

  return (
    <Panel className={cn("grid gap-4 p-5", state === "pending" && "ring-2 ring-blue/40")}>
      {header}
      {item.summary && (
        <div className="grid gap-2 rounded-xl bg-surface p-4">
          <p className="text-xs font-semibold text-ink-2">Tóm tắt của AI</p>
          <p className="text-sm leading-6 text-ink">{item.summary}</p>
          <p className="flex flex-wrap gap-1.5 text-xs text-ink-2">
            Điểm từng câu:
            {item.question_scores.map((s, i) => (
              <span key={i} className={cn("rounded px-1.5 font-medium", scoreVerdict(s).badge)}>
                C{i + 1}: {s}
              </span>
            ))}
          </p>
        </div>
      )}
      {item.review ? (
        <div className="grid gap-2 rounded-xl border border-violet/20 bg-violet-soft/40 p-4">
          <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-violet">
              <MessageSquareText className="size-4" aria-hidden />
              Nhận xét của {item.review.advisor_name} · {formatRelativeTime(item.review.reviewed_at).toLowerCase()}
            </span>
            {item.review.score !== null && (
              <span className="font-medium text-ink">
                Điểm cố vấn chốt: {item.review.score}/100 ({item.review.score - item.total_score > 0 ? "+" : ""}
                {item.review.score - item.total_score} so với AI)
              </span>
            )}
          </p>
          <blockquote className="text-sm leading-6 text-ink italic">“{item.review.comment}”</blockquote>
          <p className="flex items-center gap-1.5 text-xs">
            {item.review_seen_at ? (
              <span className="flex items-center gap-1 text-good">
                <CheckCheck className="size-3.5" aria-hidden />
                Sinh viên đã xem {formatRelativeTime(item.review_seen_at).toLowerCase()}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-ink-2">
                <Clock className="size-3.5" aria-hidden />
                Sinh viên chưa xem
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-2">Sinh viên đã chia sẻ báo cáo này và đang chờ nhận xét của bạn.</p>
          <Button onClick={onReview} className="h-10 px-4">
            <MessageSquareText aria-hidden />
            Nhận xét buổi này
          </Button>
        </div>
      )}
    </Panel>
  )
}
