"use client"

import { useState } from "react"
import {
  CalendarDays,
  CheckCheck,
  Clock,
  Eye,
  LineChart,
  Lock,
  MessageSquareText,
  Pencil,
  Radar,
  Timer,
  TimerOff,
} from "lucide-react"

import { ReportDialog } from "@/components/advisor/profile/report-dialog"
import { ReviewDialog } from "@/components/advisor/profile/review-dialog"
import { InterviewProgressBlock, StarAverageBars } from "@/components/advisor/progress-blocks"
import { Panel, PanelHeader } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime, formatWhen } from "@/lib/format"
import { LABEL_META, formatScore } from "@/lib/interview"
import type { AdvisorInterviewRow, AdvisorReviewInfo, AdvisorStudentDetail } from "@/lib/types"
import { cn } from "@/lib/utils"

type SessionFilter = "all" | "pending" | "reviewed" | "private"

const FILTERS: { value: SessionFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ nhận xét" },
  { value: "reviewed", label: "Đã nhận xét" },
  { value: "private", label: "Chưa chia sẻ" },
]

function sessionState(item: AdvisorInterviewRow): Exclude<SessionFilter, "all"> {
  if (!item.shared) return "private"
  return item.review ? "reviewed" : "pending"
}

interface ProfileInterviewTabProps {
  detail: AdvisorStudentDetail
  interviews: AdvisorInterviewRow[]
  onReviewed: (sessionId: string, review: AdvisorReviewInfo) => void
}

// Figma: frame "Hồ sơ sinh viên - Phỏng vấn & STAR" (18:6025). Điểm và tóm tắt luôn xem được;
// câu trả lời chi tiết và nhận xét chỉ khi SV chia sẻ báo cáo đó.
export function ProfileInterviewTab({ detail, interviews, onReviewed }: ProfileInterviewTabProps) {
  const { student } = detail
  const [filter, setFilter] = useState<SessionFilter>("all")
  const [position, setPosition] = useState(0)
  const [reviewing, setReviewing] = useState<AdvisorInterviewRow | null>(null)
  const [viewing, setViewing] = useState<AdvisorInterviewRow | null>(null)

  const groups = detail.interview_progress
  const group = groups[Math.min(position, groups.length - 1)]
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, f.value === "all" ? interviews.length : interviews.filter((i) => sessionState(i) === f.value).length]),
  ) as Record<SessionFilter, number>
  const visible = filter === "all" ? interviews : interviews.filter((i) => sessionState(i) === filter)
  // Số thứ tự buổi trong từng vị trí (cũ nhất = 1), khớp cách đánh số ở cờ "Cần chú ý".
  const roundOf = new Map<string, number>()
  for (const g of groups) g.points.forEach((p, i) => roundOf.set(p.id, i + 1))

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <Panel className="grid gap-4">
          <PanelHeader
            icon={LineChart}
            title="Tiến bộ theo vị trí"
            aside={<span className="text-xs text-ink-2">Điểm chỉ so sánh trong cùng vị trí</span>}
          />
          {groups.length > 1 && (
            <div role="group" aria-label="Chọn vị trí" className="flex flex-wrap gap-1.5">
              {groups.map((g, i) => (
                <button
                  key={g.jd.id}
                  type="button"
                  aria-pressed={g === group}
                  onClick={() => setPosition(i)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    g === group ? "bg-blue text-on-blue" : "bg-card text-ink-2 ring-1 ring-line hover:bg-blue-soft",
                  )}
                >
                  {g.jd.title} ({g.session_count})
                </button>
              ))}
            </div>
          )}
          {group ? (
            <InterviewProgressBlock group={group} />
          ) : (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-2">Sinh viên chưa luyện phỏng vấn buổi nào.</p>
          )}
        </Panel>
        <Panel className="grid gap-4">
          <PanelHeader icon={Radar} title="Tiêu chí STAR" />
          <StarAverageBars star={detail.star} insight={detail.insight} />
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
                <span className={cn("rounded-full px-1.5 text-[11px]", filter === f.value ? "bg-card/25" : "bg-surface")}>
                  {counts[f.value]}
                </span>
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
                <SessionCard
                  item={item}
                  round={roundOf.get(item.id) ?? 1}
                  onView={() => setViewing(item)}
                  onReview={() => setReviewing(item)}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <ReportDialog studentId={student.id} studentName={student.full_name} item={viewing} onClose={() => setViewing(null)} />
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

function SessionCard({
  item,
  round,
  onView,
  onReview,
}: {
  item: AdvisorInterviewRow
  round: number
  onView: () => void
  onReview: () => void
}) {
  const state = sessionState(item)
  const label = LABEL_META[item.label]
  const minutes = Math.max(1, Math.round(item.duration_seconds / 60))

  return (
    <Panel className={cn("grid gap-4 p-5", state === "private" && "bg-surface/60 shadow-none", state === "pending" && "ring-2 ring-blue/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-soft font-heading text-sm font-bold text-blue">
            {String(round).padStart(2, "0")}
          </span>
          <div className="grid min-w-0 gap-1">
            <p className="font-heading font-bold text-ink">
              Buổi {round} · {item.jd.title}
              {item.jd.company && <span className="font-normal text-ink-2"> · {item.jd.company}</span>}
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
              {item.timed_out_count > 0 && (
                <span className="flex items-center gap-1 text-warn">
                  <TimerOff className="size-3.5" aria-hidden />
                  {item.timed_out_count} câu hết giờ
                </span>
              )}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-2">
          <span className="text-xs text-ink-2">Điểm AI</span>
          <strong className={cn("font-heading text-lg", label.className)}>{formatScore(item.overall_score)}/5</strong>
          <Badge variant="neutral" className={label.badge}>
            {label.text}
          </Badge>
        </span>
      </div>

      <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-ink">
        <span className="font-semibold text-ink-2">Tóm tắt: </span>
        {item.summary}
      </p>

      {item.review && <ReviewBlock review={item.review} />}

      {state === "private" ? (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <Lock className="size-4 shrink-0" aria-hidden />
          Sinh viên chưa chia sẻ báo cáo này: bạn chỉ xem được điểm và tóm tắt ở trên.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-2">
            {item.review ? "Điểm AI giữ nguyên, nhận xét của bạn hiện trong báo cáo của sinh viên." : "Sinh viên đã chia sẻ báo cáo này và đang chờ nhận xét của bạn."}
          </p>
          <span className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={onView} className="h-10 px-4">
              <Eye aria-hidden />
              Xem báo cáo
            </Button>
            <Button variant={item.review ? "soft" : "default"} onClick={onReview} className="h-10 px-4">
              {item.review ? <Pencil aria-hidden /> : <MessageSquareText aria-hidden />}
              {item.review ? "Sửa nhận xét" : "Nhận xét buổi này"}
            </Button>
          </span>
        </div>
      )}
    </Panel>
  )
}

function ReviewBlock({ review }: { review: AdvisorReviewInfo }) {
  const edited = review.updated_at !== review.created_at
  return (
    <div className="grid gap-2 rounded-xl border border-violet/20 bg-violet-soft/40 p-4">
      <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-violet">
          <MessageSquareText className="size-4" aria-hidden />
          Nhận xét của bạn · {edited ? "sửa " : ""}
          {formatRelativeTime(review.updated_at).toLowerCase()}
        </span>
        {review.seen_at ? (
          <span className="flex items-center gap-1 text-good">
            <CheckCheck className="size-3.5" aria-hidden />
            Sinh viên đã xem {formatRelativeTime(review.seen_at).toLowerCase()}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-ink-2">
            <Clock className="size-3.5" aria-hidden />
            Sinh viên chưa xem
          </span>
        )}
      </p>
      <blockquote className="text-sm leading-6 whitespace-pre-line text-ink">{review.comment}</blockquote>
    </div>
  )
}
