"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { BadgeCheck, ChevronRight, Mail, MessageSquareText, TrendingUp, type LucideIcon } from "lucide-react"

import { ScoreFromTo, StudentAvatar } from "@/components/advisor/students/student-bits"
import { useChat } from "@/components/chat/chat-context"
import { EmptyState } from "@/components/common/empty-state"
import { MetricColumn } from "@/components/common/metric-column"
import { SoftPanel } from "@/components/common/panel"
import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { Zone, ZoneLink } from "@/components/common/zone"
import { Button } from "@/components/ui/button"
import { formatPercent } from "@/lib/analysis"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { STAR_META, STAR_ORDER, formatScore } from "@/lib/interview"
import type { AdvisorOverview, AssignedStudent, RecentReview } from "@/lib/types"
import { cn } from "@/lib/utils"

const TASK_LIMIT = 4

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatScore(n)}`
const profileHref = (id: string, tab?: "interviews") =>
  `/advisor/students/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ""}`

// ---------- Lời chào ----------

function timeGreeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 11) return "Chào buổi sáng"
  if (hour < 14) return "Chào buổi trưa"
  if (hour < 18) return "Chào buổi chiều"
  return "Chào buổi tối"
}

/** "ThS. Trần Hoàng Nam" → "ThS. Nam" (giữ học vị, chỉ lấy tên riêng). */
function callName(fullName: string): string {
  const title = fullName.match(/^(ThS|TS|PGS\.TS|GS\.TS)\./i)?.[0]
  const last = fullName.trim().split(/\s+/).at(-1)
  return title ? `${title} ${last}` : (last ?? fullName)
}

function summary(data: AdvisorOverview): string {
  if (data.student_count === 0) return "Bạn chưa được phân công sinh viên nào."
  const flagged = data.status_counts.flagged
  const pending = data.pending_reviews
  if (flagged === 0 && pending === 0) return `Cả ${data.student_count} sinh viên đều ổn, không có buổi nào chờ nhận xét.`
  const parts = [
    flagged > 0 && `${flagged} sinh viên cần chú ý`,
    pending > 0 && `${pending} buổi phỏng vấn đang chờ bạn nhận xét`,
  ].filter(Boolean)
  return `${parts.join(" và ")}.`.replace(/^./, (c) => c.toUpperCase())
}

// Lời chào theo buổi + một câu tóm tắt; 2 nút đối diện bên phải (giống Tổng quan của SV).
export function AdvisorGreeting({ data }: { data: AdvisorOverview }) {
  return (
    <section
      aria-labelledby="advisor-greeting"
      className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-8 pb-2 md:pt-12"
    >
      <div className="min-w-0 flex-[1_1_480px]">
        <h1
          id="advisor-greeting"
          className="font-heading text-[30px] leading-9 font-semibold tracking-[-0.025em] text-balance text-ink md:text-[40px] md:leading-[46px]"
        >
          {timeGreeting(new Date())}, {callName(data.advisor_name)}!
        </h1>
        <p className="mt-2.5 text-base leading-[26px] text-ink-2 md:text-[17px]">{summary(data)}</p>
      </div>
      {data.student_count > 0 && (
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="ghost"
            size="brand"
            className="glass text-ink shadow-xs hover:bg-white"
            nativeButton={false}
            render={<Link href="/advisor/students" />}
          >
            Sinh viên phụ trách
          </Button>
          {data.pending_reviews > 0 && (
            <Button size="brand" nativeButton={false} render={<Link href="/advisor/students?status=pending" />}>
              Nhận xét buổi chờ
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

// ---------- Việc cần làm ----------

/** Một thẻ trắng trong panel "Việc cần làm": tiêu đề + số đếm, link bên phải, các dòng kẻ mảnh. */
function TaskList({
  id,
  title,
  count,
  link,
  empty,
  children,
}: {
  id: string
  title: string
  count: number
  link: { label: string; href: string }
  empty: { icon: LucideIcon; text: string }
  children: ReactNode
}) {
  const EmptyIcon = empty.icon
  return (
    <article aria-labelledby={id} className="min-w-0 rounded-card bg-card px-5 pt-2 pb-3.5 shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 pt-3 pb-1">
        <h3 id={id} className="text-base font-semibold text-ink">
          {title} <span className="font-medium text-ink-3 tabular-nums">{count}</span>
        </h3>
        {count > 0 && <ZoneLink href={link.href}>{link.label}</ZoneLink>}
      </div>
      {count === 0 ? (
        <p className="flex items-center gap-2 py-3 text-sm text-ink-3">
          <EmptyIcon className="size-4 text-good" strokeWidth={1.75} aria-hidden />
          {empty.text}
        </p>
      ) : (
        <ul className="[&>li:last-child]:border-b-0">{children}</ul>
      )}
    </article>
  )
}

function TaskRow({
  student,
  meta,
  metaClassName,
  action,
}: {
  student: Pick<AssignedStudent, "id" | "full_name" | "avatar_url">
  meta: ReactNode
  metaClassName?: string
  action: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3">
      <StudentAvatar name={student.full_name} src={student.avatar_url} />
      <Link href={profileHref(student.id)} className="group grid min-w-0 flex-1">
        <span className="truncate font-medium text-ink group-hover:text-accent-strong">{student.full_name}</span>
        <span className={cn("truncate text-[13px] text-ink-3", metaClassName)}>{meta}</span>
      </Link>
      {action}
    </li>
  )
}

const PILL_SM = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-[background-color,transform] active:scale-[.97]"

/**
 * "Chờ nhận xét": buổi SV đã chia sẻ mà bạn chưa nhận xét, chờ lâu nhất trước; "Nhận xét" mở thẳng dialog của buổi đó.
 * "Cần chú ý": SV bị gắn cờ 2 vòng liên tiếp không tăng điểm (US-ADV-02), kèm nút nhắn tin.
 */
export function AdvisorTasks({ data }: { data: AdvisorOverview }) {
  const { openChat } = useChat()
  const pending = data.pending_sessions ?? []
  const flagged = data.flagged_students

  return (
    <SoftPanel aria-labelledby="advisor-tasks" className="grid gap-4 sm:px-[26px] sm:pb-[26px]">
      <h2 id="advisor-tasks" className="font-heading text-xl leading-7 font-semibold text-ink">
        Việc cần làm
      </h2>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <TaskList
          id="task-pending"
          title="Chờ nhận xét"
          count={data.pending_reviews}
          link={{ label: "Xem tất cả", href: "/advisor/students?status=pending" }}
          empty={{ icon: BadgeCheck, text: "Bạn đã nhận xét hết các buổi được chia sẻ." }}
        >
          {pending.slice(0, TASK_LIMIT).map((p) => (
            <TaskRow
              key={p.session_id}
              student={{ id: p.student_id, full_name: p.student_name, avatar_url: p.avatar_url }}
              meta={[
                p.jd.title,
                p.overall_score !== null ? `${formatScore(p.overall_score)} / 5` : null,
                formatRelativeTime(p.completed_at).toLowerCase(),
              ]
                .filter(Boolean)
                .join(" · ")}
              action={
                <Link
                  href={`/advisor/students/${encodeURIComponent(p.student_id)}?review=${encodeURIComponent(p.session_id)}`}
                  className={cn(PILL_SM, "bg-ink text-white hover:bg-ink/85")}
                >
                  Nhận xét
                </Link>
              }
            />
          ))}
        </TaskList>
        <TaskList
          id="task-flagged"
          title="Cần chú ý"
          count={flagged.length}
          link={{ label: "Xem danh sách", href: "/advisor/students?status=flagged" }}
          empty={{ icon: BadgeCheck, text: "Không có sinh viên nào cần chú ý." }}
        >
          {flagged.slice(0, TASK_LIMIT).map((s) => (
            <TaskRow
              key={s.id}
              student={s}
              metaClassName="text-warn"
              meta={
                s.flag
                  ? `Buổi ${s.flag.rounds.join(", ")} không tăng điểm · ${s.flag.jd.title}`
                  : "Điểm không tăng 2 vòng liên tiếp"
              }
              action={
                <button
                  type="button"
                  onClick={() => openChat(s.id)}
                  className={cn(PILL_SM, "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel")}
                >
                  <Mail className="size-4" strokeWidth={1.75} aria-hidden />
                  Nhắn tin
                </button>
              }
            />
          ))}
        </TaskList>
      </div>
    </SoftPanel>
  )
}

// ---------- Tình hình nhóm ----------

function OutOf({ value, total }: { value: ReactNode; total: ReactNode }) {
  return (
    <>
      {value}
      <span className="text-[15px] text-ink-3"> / {total}</span>
    </>
  )
}

export function GroupMetrics({ data, students }: { data: AdvisorOverview; students: AssignedStudent[] }) {
  const activeRate = percent(data.active_count, data.student_count)
  const matches = students.flatMap((s) => (s.latest_match !== null ? [s.latest_match] : []))
  const matchAverage = matches.length ? matches.reduce((sum, m) => sum + m, 0) / matches.length : null
  const delta = data.average_delta

  return (
    <Zone id="group-metrics" title="Tình hình nhóm">
      <div className="grid gap-x-11 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        <MetricColumn
          label="Sinh viên"
          value={data.student_count}
          compare={`${activeRate}% hoạt động ${data.active_days} ngày qua (mục tiêu ≥ ${data.active_target}%)`}
          link={{ label: "Xem danh sách", href: "/advisor/students" }}
        />
        <MetricColumn
          label="Điểm phỏng vấn TB"
          value={data.average_score !== null ? <OutOf value={formatScore(data.average_score)} total={5} /> : "—"}
          delta={delta !== null && delta !== 0 ? { text: signed(delta), positive: delta > 0 } : undefined}
          points={data.weekly_scores.map((w) => w.average)}
          note={delta !== null ? "So với buổi đầu" : "Chưa ai có đủ 2 buổi"}
        />
        <MetricColumn
          label="Đang tiến bộ"
          value={<OutOf value={data.status_counts.improving} total={data.student_count} />}
          compare="tăng từ 0,3 điểm"
          link={{ label: "Xem danh sách", href: "/advisor/students?status=improving" }}
        />
        <MetricColumn
          label="Độ khớp CV TB"
          value={matchAverage !== null ? `${formatPercent(Math.round(matchAverage))}%` : "—"}
          compare={matches.length ? `${matches.length} sinh viên, lượt gần nhất` : "chưa có lượt phân tích"}
        />
      </div>
    </Zone>
  )
}

// ---------- Phân tích nhóm ----------

function WeeklyScores({ data }: { data: AdvisorOverview }) {
  const last = data.weekly_scores.length - 1
  const points: ScorePoint[] = data.weekly_scores.map((w, i) => ({
    label: formatDate(w.week_start).slice(0, 5),
    value: w.average,
    detail: `${i === last ? "Tuần này" : `Tuần từ ${formatDate(w.week_start).slice(0, 5)}`} · ${w.student_count} sinh viên có điểm`,
  }))
  return (
    <section aria-labelledby="weekly-scores" className="min-w-0">
      <h3 id="weekly-scores" className="text-base font-semibold text-ink">
        Điểm phỏng vấn trung bình theo tuần
      </h3>
      {points.length > 0 ? (
        <ScoreLineChart points={points} max={5} unit="điểm TB" sparseTicksOnMobile className="mt-3 h-56" />
      ) : (
        <EmptyState icon={TrendingUp} title="Chưa có dữ liệu" description="Chưa có buổi phỏng vấn nào được chấm." />
      )}
    </section>
  )
}

function CohortStar({ data }: { data: AdvisorOverview }) {
  const star = data.star
  return (
    <section aria-labelledby="cohort-star" className="min-w-0">
      <h3 id="cohort-star" className="mb-1 text-base font-semibold text-ink">
        Tiêu chí STAR cả nhóm
      </h3>
      {!star ? (
        <EmptyState icon={MessageSquareText} title="Chưa có dữ liệu STAR" description="Chưa sinh viên nào hoàn thành buổi phỏng vấn." />
      ) : (
        <>
          <ul>
            {STAR_ORDER.map((key) => {
              const score = star.average[key]
              const weak = key === star.weakest
              return (
                <li
                  key={key}
                  className="grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-3 border-b border-line py-2.5 sm:grid-cols-[110px_minmax(0,1fr)_44px]"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-ink">{STAR_META[key].label}</span>
                    <span className="text-xs text-ink-3">{STAR_META[key].letter}</span>
                  </span>
                  <span
                    role="progressbar"
                    aria-label={STAR_META[key].label}
                    aria-valuenow={score}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    className="h-1.5 overflow-hidden rounded-full bg-surface"
                  >
                    <span className={cn("block h-full rounded-full", weak ? "bg-warn" : "bg-blue")} style={{ width: `${(score / 5) * 100}%` }} />
                  </span>
                  <span className="text-right font-semibold text-ink tabular-nums">{formatScore(score)}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2.5 text-[13px] text-ink-3">
            {STAR_META[star.weakest].label} ({STAR_META[star.weakest].letter}) yếu nhất ở {star.weakest_count} /{" "}
            {star.student_count} sinh viên. Mỗi người tính tối đa 5 buổi gần nhất, thang 0–5.
          </p>
        </>
      )}
    </section>
  )
}

export function GroupAnalysis({ data }: { data: AdvisorOverview }) {
  return (
    <Zone id="group-analysis" title="Phân tích nhóm">
      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <WeeklyScores data={data} />
        <CohortStar data={data} />
      </div>
    </Zone>
  )
}

// ---------- Mức tiến bộ, tiến bộ nhiều nhất, nhận xét gần đây ----------

/** Vùng nhỏ cùng hàng: tiêu đề vùng + đường kẻ, nội dung sát dưới. */
function SmallZone({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Zone id={id} title={title} className="min-w-0 [&>div:last-child]:pt-2">
      {children}
    </Zone>
  )
}

/** Tăng / Giữ nguyên / Giảm theo xu hướng điểm ở vị trí đang luyện (kể cả SV đang bị gắn cờ). */
export function ProgressSplit({ students }: { students: AssignedStudent[] }) {
  const count = (trend: AssignedStudent["trend"]) => students.filter((s) => s.trend === trend).length
  const rows = [
    { label: "Tăng", value: count("improving"), tone: "bg-good" },
    { label: "Giữ nguyên", value: count("stable"), tone: "bg-line-strong" },
    { label: "Giảm", value: count("declining"), tone: "bg-warn" },
  ]
  const insufficient = count("insufficient")
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  return (
    <SmallZone id="progress-split" title="Mức tiến bộ">
      <div className="pt-4">
        {total > 0 ? (
          <div
            className="flex h-3 gap-[3px] overflow-hidden rounded-full"
            role="img"
            aria-label={rows.map((r) => `${r.label} ${r.value}`).join(", ")}
          >
            {rows.map((r) => r.value > 0 && <span key={r.label} className={r.tone} style={{ flexGrow: r.value }} />)}
          </div>
        ) : (
          <div className="h-3 rounded-full bg-surface" aria-hidden />
        )}
        <ul className="mt-1">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5 border-b border-line py-[11px]">
              <span className={cn("size-2.5 rounded-[3px]", r.tone)} aria-hidden />
              <span className="flex-1 text-ink">{r.label}</span>
              <b className="font-semibold text-ink tabular-nums">{r.value}</b>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[13px] text-ink-3">
          Buổi gần nhất so với buổi đầu, mốc ±0,3 điểm.
          {insufficient > 0 && ` ${insufficient} sinh viên chưa đủ 2 buổi.`}
        </p>
      </div>
    </SmallZone>
  )
}

export function TopImprovers({ students }: { students: AssignedStudent[] }) {
  return (
    <SmallZone id="top-improvers" title="Tiến bộ nhiều nhất">
      {students.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Chưa có" description="Chưa sinh viên nào tăng điểm so với buổi đầu." className="py-8" />
      ) : (
        <ul>
          {students.map((s) => (
            <li key={s.id} className="border-b border-line">
              <Link
                href={profileHref(s.id)}
                className="-mx-2.5 flex items-center gap-3 rounded-[10px] px-2.5 py-3 transition-colors hover:bg-panel"
              >
                <StudentAvatar name={s.full_name} src={s.avatar_url} className="size-8" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink" title={s.target?.title}>
                  {s.full_name}
                </span>
                {s.first_score !== null && s.latest_score !== null && (
                  <ScoreFromTo first={s.first_score} latest={s.latest_score} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SmallZone>
  )
}

export function RecentReviews({ items }: { items: RecentReview[] }) {
  return (
    <SmallZone id="recent-reviews" title="Nhận xét gần đây">
      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Chưa có nhận xét"
          description="Nhận xét bạn viết cho các buổi sinh viên chia sẻ sẽ hiện ở đây."
          className="py-8"
        />
      ) : (
        <ul>
          {items.map((r) => (
            <li key={r.id} className="border-b border-line">
              <Link
                href={profileHref(r.student_id, "interviews")}
                className="-mx-2.5 grid gap-0.5 rounded-[10px] px-2.5 py-3 transition-colors hover:bg-panel"
              >
                <span className="flex items-baseline justify-between gap-2.5">
                  <span className="truncate font-medium text-ink">{r.student_name}</span>
                  <span className="shrink-0 text-[13px] text-ink-3 tabular-nums">
                    {r.seen_at ? "Đã xem · " : "Chưa xem · "}
                    {formatDate(r.updated_at).slice(0, 5)}
                  </span>
                </span>
                <span className="truncate text-sm text-ink-2">{r.comment}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SmallZone>
  )
}
