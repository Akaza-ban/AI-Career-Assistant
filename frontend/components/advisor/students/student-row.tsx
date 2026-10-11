"use client"

import Link from "next/link"
import { useCallback, type ReactNode } from "react"
import { AlertCircle, ChevronDown, ChevronRight, Mail } from "lucide-react"

import { MiniSparkline, PendingPill, ScoreFromTo, StatusPill, StudentAvatar } from "@/components/advisor/students/student-bits"
import { useChat } from "@/components/chat/chat-context"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPercent } from "@/lib/analysis"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { STAR_META, formatScore } from "@/lib/interview"
import type { AdvisorStudentProgress, AssignedStudent } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/**
 * Cột bảng khi vùng chứa đủ rộng (container ≥ 56rem). Hẹp hơn thì mỗi SV là một dòng xếp dọc,
 * để điện thoại không cuộn ngang.
 */
export const ROW_GRID =
  "@4xl:grid @4xl:grid-cols-[minmax(180px,1.5fr)_minmax(130px,1fr)_150px_76px_150px_84px_20px] @4xl:items-center @4xl:gap-4"

const PILL_SM =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-[background-color,transform] active:scale-[.97]"

export function StudentTableHead() {
  return (
    <div className={cn("hidden border-b border-line py-3 text-[13px] text-ink-3", ROW_GRID)} aria-hidden>
      <span>Sinh viên</span>
      <span>Vị trí đang luyện</span>
      <span>Điểm PV đầu → gần nhất</span>
      <span>Độ khớp CV</span>
      <span>Trạng thái</span>
      <span>Hoạt động</span>
      <span />
    </div>
  )
}

function ScoreCell({ student: s }: { student: AssignedStudent }) {
  if (s.score_delta === null || s.first_score === null || s.latest_score === null) {
    return (
      <span className="text-[13px] text-ink-3">
        {s.latest_score === null ? "Chưa phỏng vấn" : `1 buổi · ${formatScore(s.latest_score)}`}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2.5">
      <ScoreFromTo first={s.first_score} latest={s.latest_score} />
      <MiniSparkline points={[s.first_score, s.latest_score]} down={s.score_delta < 0} />
    </span>
  )
}

const activity = (s: AssignedStudent) => (s.last_active_at ? formatRelativeTime(s.last_active_at) : "Chưa hoạt động")
const match = (s: AssignedStudent) => (s.latest_match !== null ? `${formatPercent(Math.round(s.latest_match))}%` : "—")

/** Một SV: bấm cả dòng để mở rộng tại chỗ. */
export function StudentRow({
  student: s,
  open,
  onToggle,
}: {
  student: AssignedStudent
  open: boolean
  onToggle: () => void
}) {
  const panelId = `student-${s.id}-detail`
  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="-mx-2.5 block w-[calc(100%+20px)] rounded-[10px] px-2.5 text-left transition-colors hover:bg-panel"
      >
        {/* Bảng (màn rộng) */}
        <span className={cn("hidden py-3", ROW_GRID)}>
          <span className="flex min-w-0 items-center gap-3">
            <StudentAvatar name={s.full_name} src={s.avatar_url} />
            <span className="grid min-w-0">
              <span className="truncate font-medium text-ink">{s.full_name}</span>
              <span className="truncate text-[13px] text-ink-3">{s.subtitle}</span>
            </span>
          </span>
          <span className={cn("min-w-0 text-sm", s.target ? "text-ink-2" : "text-ink-3")}>
            {s.target?.title ?? "Chưa chọn vị trí"}
          </span>
          <ScoreCell student={s} />
          <span className="font-medium text-ink tabular-nums">{match(s)}</span>
          <span className="flex flex-col items-start gap-1">
            <StatusPill student={s} />
            {s.pending_reviews > 0 && <PendingPill count={s.pending_reviews} />}
          </span>
          <span className="text-sm text-ink-3">{activity(s)}</span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
        </span>

        {/* Dòng xếp dọc (màn hẹp) */}
        <span className="flex gap-3 py-3.5 @4xl:hidden">
          <StudentAvatar name={s.full_name} src={s.avatar_url} />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex items-start justify-between gap-2">
              <span className="grid min-w-0">
                <span className="truncate font-medium text-ink">{s.full_name}</span>
                <span className="truncate text-[13px] text-ink-3">
                  {s.subtitle} · {s.target?.title ?? "Chưa chọn vị trí"}
                </span>
              </span>
              <ChevronDown className={cn("mt-1 size-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusPill student={s} />
              {s.pending_reviews > 0 && <PendingPill count={s.pending_reviews} />}
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
              <ScoreCell student={s} />
              <span>
                CV <span className="font-medium text-ink tabular-nums">{match(s)}</span>
              </span>
              <span>{activity(s)}</span>
            </span>
          </span>
        </span>
      </button>
      {open && (
        <div id={panelId} className="mb-4 @4xl:ml-12">
          <StudentQuickView student={s} />
        </div>
      )}
    </li>
  )
}

/** STAR yếu nhất, CV trước → sau (cùng vị trí đang luyện), gợi ý buổi tới (lấy số liệu khi mở). */
function StudentQuickView({ student }: { student: AssignedStudent }) {
  const fetchProgress = useCallback(() => api.getAdvisorStudentProgress(student.id), [student.id])
  const { data, error, reload } = useApi(fetchProgress)
  const { openChat } = useChat()

  return (
    <div className="grid gap-x-6 gap-y-4 rounded-[14px] bg-panel px-5 py-[18px] @2xl:grid-cols-3 @5xl:grid-cols-[repeat(3,minmax(0,1fr))_auto] @5xl:items-center">
      {error ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-bad @2xl:col-span-3">
          <AlertCircle className="size-4" strokeWidth={1.75} aria-hidden />
          Không tải được tiến bộ của sinh viên.
          <button type="button" onClick={reload} className="font-semibold text-blue hover:text-accent-strong">
            Thử lại
          </button>
        </p>
      ) : !data ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)
      ) : (
        <QuickFacts student={student} data={data} />
      )}
      <div className="flex flex-wrap gap-2 @2xl:col-span-3 @5xl:col-span-1">
        <button
          type="button"
          onClick={() => openChat(student.id)}
          className={cn(PILL_SM, "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel")}
        >
          <Mail className="size-4" strokeWidth={1.75} aria-hidden />
          Nhắn tin
        </button>
        <Link
          href={`/advisor/students/${encodeURIComponent(student.id)}`}
          className={cn(PILL_SM, "bg-ink text-white hover:bg-ink/85")}
        >
          Mở hồ sơ
          <ChevronRight className="size-[15px]" aria-hidden />
        </Link>
      </div>
    </div>
  )
}

function Fact({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className={cn("font-medium text-ink", className)}>{children}</div>
    </div>
  )
}

function QuickFacts({ student, data }: { student: AssignedStudent; data: AdvisorStudentProgress }) {
  const star = data.star
  const cv = data.cv_progress.find((g) => g.jd.id === student.target?.id) ?? data.cv_progress[0]
  const firstCv = cv?.points[0]
  const lastCv = cv?.points.at(-1)
  return (
    <>
      <Fact label="STAR yếu nhất">
        {star ? (
          <>
            {STAR_META[star.weakest].label} ({STAR_META[star.weakest].letter}) ·{" "}
            <span className="tabular-nums">{formatScore(star.average[star.weakest])}</span>
          </>
        ) : (
          <span className="text-ink-3">Chưa có buổi nào</span>
        )}
      </Fact>
      <Fact label="Độ khớp CV">
        {firstCv && lastCv ? (
          <span className="tabular-nums">
            {cv.points.length > 1 && `${formatPercent(firstCv.match_score)}% → `}
            {formatPercent(lastCv.match_score)}%
          </span>
        ) : (
          <span className="text-ink-3">Chưa phân tích</span>
        )}
      </Fact>
      <Fact label="Gợi ý buổi tới" className="text-sm leading-[22px]">
        {data.suggestions[0] ?? <span className="text-ink-3">Đang tiến triển ổn định</span>}
      </Fact>
    </>
  )
}
