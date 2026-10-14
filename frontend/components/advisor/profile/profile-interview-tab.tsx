"use client"

import { useState } from "react"
import { Lock, MessagesSquare } from "lucide-react"

import { OutOfFive, dayMonth, score1, signed } from "@/components/advisor/profile/profile-bits"
import { ReviewDialog } from "@/components/advisor/profile/review-dialog"
import { StarAverageBars } from "@/components/advisor/progress-blocks"
import { EmptyState } from "@/components/common/empty-state"
import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone } from "@/components/common/zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AdvisorInterviewRow, AdvisorReviewInfo, AdvisorStudentDetail, InterviewProgress } from "@/lib/types"
import { cn } from "@/lib/utils"

type SessionFilter = "all" | "pending"
type SessionState = "pending" | "reviewed" | "private"

function sessionState(item: AdvisorInterviewRow): SessionState {
  if (!item.shared) return "private"
  return item.review ? "reviewed" : "pending"
}

interface ProfileInterviewTabProps {
  detail: AdvisorStudentDetail
  interviews: AdvisorInterviewRow[]
  /** Buổi mở sẵn dialog nhận xét (từ `?review=`); bỏ qua nếu không có hoặc SV chưa chia sẻ. */
  initialReviewId?: string | null
  onReviewed: (sessionId: string, review: AdvisorReviewInfo) => void
}

// Bản vẽ HoSoSinhVien, tab Phỏng vấn. Điểm luôn xem được; câu trả lời chi tiết và nhận xét chỉ khi SV chia sẻ báo cáo đó.
export function ProfileInterviewTab({ detail, interviews, initialReviewId = null, onReviewed }: ProfileInterviewTabProps) {
  const { student } = detail
  const [filter, setFilter] = useState<SessionFilter>("all")
  const [position, setPosition] = useState(0)
  const [reviewingId, setReviewingId] = useState<string | null>(
    () => interviews.find((i) => i.id === initialReviewId && i.shared)?.id ?? null,
  )
  const reviewing = interviews.find((i) => i.id === reviewingId) ?? null

  function closeReview() {
    setReviewingId(null)
    // Bỏ ?review= khỏi URL để tải lại trang không mở lại dialog.
    const url = new URL(window.location.href)
    if (url.searchParams.has("review")) {
      url.searchParams.delete("review")
      url.searchParams.set("tab", "interviews")
      history.replaceState(null, "", url.pathname + url.search)
    }
  }

  const groups = detail.interview_progress
  const group = groups[Math.min(position, groups.length - 1)]
  const pending = interviews.filter((i) => sessionState(i) === "pending").length
  const visible = filter === "all" ? interviews : interviews.filter((i) => sessionState(i) === "pending")
  // Số thứ tự buổi trong từng vị trí (cũ nhất = 1), khớp cách đánh số ở cờ "Cần chú ý".
  const roundOf = new Map<string, number>()
  for (const g of groups) g.points.forEach((p, i) => roundOf.set(p.id, i + 1))

  return (
    <div className="grid gap-14">
      <div className="grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Zone
          id="position-progress"
          title="Tiến bộ theo vị trí"
          aside={
            groups.length > 1 ? (
              <PositionSelect groups={groups} value={position} onChange={setPosition} />
            ) : (
              group && <span className="text-sm text-ink-2">{group.jd.title}</span>
            )
          }
        >
          {group ? (
            <PositionChart group={group} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="Chưa có buổi phỏng vấn"
              description="Sinh viên chưa luyện phỏng vấn buổi nào."
              className="py-8"
            />
          )}
        </Zone>
        <Zone id="star-criteria" title="Tiêu chí STAR">
          <StarAverageBars star={detail.star} insight={detail.insight} />
        </Zone>
      </div>

      <Zone
        id="sessions-heading"
        title="Các buổi phỏng vấn thử"
        aside={
          <SegmentedControl
            aria-label="Lọc buổi phỏng vấn"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "pending", label: "Chờ nhận xét", count: pending },
            ]}
            className="w-full sm:w-auto"
          />
        }
      >
        {visible.length === 0 ? (
          <p className="-mt-1 border-b border-line py-6 text-sm text-ink-3">
            {interviews.length === 0
              ? "Sinh viên chưa có buổi phỏng vấn thử nào."
              : "Không còn báo cáo nào chờ bạn nhận xét."}
          </p>
        ) : (
          <ol className="-mt-3">
            {visible.map((item) => (
              <SessionRow key={item.id} item={item} round={roundOf.get(item.id) ?? 1} onOpen={() => setReviewingId(item.id)} />
            ))}
          </ol>
        )}
      </Zone>

      <ReviewDialog
        studentId={student.id}
        studentName={student.full_name}
        avatarUrl={student.avatar_url}
        item={reviewing}
        onClose={closeReview}
        onReviewed={onReviewed}
      />
    </div>
  )
}

function PositionSelect({ groups, value, onChange }: { groups: InterviewProgress[]; value: number; onChange: (i: number) => void }) {
  const items = groups.map((g, i) => ({ value: String(i), label: g.jd.title }))
  return (
    <Select items={items} value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger
        className="h-9 w-full min-w-0 rounded-[10px] border-line-strong bg-card px-3.5 text-sm sm:w-[230px]"
        aria-label="Chọn vị trí"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PositionChart({ group }: { group: InterviewProgress }) {
  const points: ScorePoint[] = group.points.map((p, i) => ({
    label: dayMonth(p.completed_at),
    value: p.score,
    detail: `Buổi ${i + 1}`,
  }))
  return (
    <div className="-mt-3">
      {points.length > 1 ? (
        <ScoreLineChart points={points} max={5} unit="điểm STAR" sparseTicksOnMobile className="h-[190px]" />
      ) : (
        <p className="border-b border-line py-6 text-sm text-ink-2">
          Mới có 1 buổi ở vị trí này: <OutOfFive score={group.latest_score} className="font-semibold text-ink" />
        </p>
      )}
      <p className="mt-2 text-[13px] leading-5 text-ink-3">
        {group.session_count} buổi · gần nhất {score1(group.latest_score)} / 5
        {group.delta_from_previous !== null && ` (${signed(group.delta_from_previous, score1)} so với buổi trước)`}. Điểm
        chỉ so sánh trong cùng vị trí.
      </p>
    </div>
  )
}

const STATE_BADGE: Record<SessionState, { label: string; variant: "blue" | "good" } | null> = {
  pending: { label: "Chờ nhận xét", variant: "blue" },
  reviewed: { label: "Đã nhận xét", variant: "good" },
  private: null,
}

function SessionRow({ item, round, onOpen }: { item: AdvisorInterviewRow; round: number; onOpen: () => void }) {
  const state = sessionState(item)
  const badge = STATE_BADGE[state]
  const minutes = Math.max(1, Math.round(item.duration_seconds / 60))
  const meta = [`Buổi ${round}`, `${minutes} phút`, item.timed_out_count > 0 && `${item.timed_out_count} câu hết giờ`]
    .filter(Boolean)
    .join(" · ")

  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line py-3.5",
        "md:grid-cols-[64px_minmax(0,1fr)_84px_150px_120px] md:gap-x-4",
      )}
    >
      <span className="hidden text-sm text-ink-3 tabular-nums md:block">{dayMonth(item.completed_at)}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{item.jd.title}</span>
        <span className="block truncate text-[13px] text-ink-3">
          <span className="md:hidden">{dayMonth(item.completed_at)} · </span>
          {meta}
        </span>
      </span>
      <span className="text-right font-semibold text-ink tabular-nums md:text-left">
        {score1(item.overall_score)} <span className="font-normal text-ink-3">/ 5</span>
      </span>
      <span className="flex items-center md:block">
        {badge ? (
          <Badge variant={badge.variant} className="h-[22px] px-2">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {badge.label}
          </Badge>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
            <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
            Chưa chia sẻ
          </span>
        )}
      </span>
      <span className="text-right">
        {state === "pending" ? (
          <Button size="sm" className="h-8 rounded-full px-3.5 text-[13px] font-semibold" onClick={onOpen}>
            Nhận xét
          </Button>
        ) : state === "reviewed" ? (
          <button type="button" onClick={onOpen} className="inline-flex h-8 items-center text-sm font-semibold text-blue hover:text-accent-strong">
            Xem
          </button>
        ) : null}
      </span>
    </li>
  )
}
