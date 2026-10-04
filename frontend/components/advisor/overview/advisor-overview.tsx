"use client"

import Link from "next/link"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCheck,
  Clock,
  MessageSquareText,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { StarAverageBars } from "@/components/advisor/progress-blocks"
import { FlagDetail, STATUS_META, ScoreDelta } from "@/components/advisor/student-status"
import { Panel, SectionHeader } from "@/components/common/panel"
import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AdvisorOverview as Overview, AssignedStudent, RecentReview, StudentStatus } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const FLAGGED_LIMIT = 5

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 11) return "Chào buổi sáng"
  if (hour < 14) return "Chào buổi trưa"
  if (hour < 18) return "Chào buổi chiều"
  return "Chào buổi tối"
}

/** "ThS. Trần Hoàng Nam" → "ThS. Nam" */
function callName(fullName: string): string {
  const title = fullName.match(/^(ThS|TS|PGS\.TS|GS\.TS)\./i)?.[0]
  const last = fullName.trim().split(/\s+/).at(-1)
  return title ? `${title} ${last}` : (last ?? fullName)
}

const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

// Tổng quan cả nhóm SV phụ trách (gộp "Theo dõi tiến bộ"). PRD US-ADV-01, US-ADV-02, KPI mục 9.
// Chỉ dùng số liệu tổng hợp; nội dung từng tài liệu vẫn cần SV chia sẻ.
// Cùng kiểu trang Tổng quan của sinh viên: lời chào đặt thẳng trên nền, tiêu đề mục nằm ngoài ô.
export function AdvisorOverview() {
  const { data, error, reload } = useApi(api.getAdvisorOverview)

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được bảng tổng quan</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }
  if (!data) return <OverviewSkeleton />

  const flaggedCount = data.status_counts.flagged
  return (
    <div className="grid gap-10">
      <header className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-6">
        <div className="grid max-w-3xl gap-1.5">
          <h1 className="font-heading text-[32px] leading-10 font-bold">
            {greeting(new Date())}, {callName(data.advisor_name)}!
          </h1>
          {data.student_count > 0 ? (
            <p className="text-base leading-7 text-ink-2">
              Hôm nay có{" "}
              <Link href="/advisor/students?status=pending" className="font-semibold text-blue hover:underline">
                {data.pending_reviews} báo cáo chờ nhận xét
              </Link>{" "}
              và{" "}
              <Link href="/advisor/students?status=flagged" className="font-semibold text-bad hover:underline">
                {flaggedCount} sinh viên cần chú ý
              </Link>{" "}
              trong tổng số {data.student_count} sinh viên phụ trách.
            </p>
          ) : (
            <p className="text-base text-ink-2">Bạn chưa được phân công sinh viên nào.</p>
          )}
        </div>
        {data.pending_reviews > 0 && (
          <Button size="brand" nativeButton={false} render={<Link href="/advisor/students?status=pending" />}>
            <MessageSquareText aria-hidden />
            Nhận xét báo cáo
            <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-blue">{data.pending_reviews}</span>
          </Button>
        )}
      </header>

      {data.student_count === 0 ? (
        <Panel className="grid justify-items-center gap-2 py-12 text-center">
          <Users className="size-8 text-ink-3" aria-hidden />
          <p className="font-heading font-bold">Chưa có sinh viên phụ trách</p>
          <p className="max-w-md text-sm text-ink-2">
            Khi nhà trường phân công sinh viên cho bạn, tiến bộ của cả nhóm sẽ hiển thị ở đây.
          </p>
        </Panel>
      ) : (
        <OverviewBody data={data} />
      )}
    </div>
  )
}

function OverviewBody({ data }: { data: Overview }) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StudentsCard data={data} />
        <ActiveCard data={data} />
        <ScoreCard data={data} />
        <CsatCard data={data} />
      </div>

      <div className="grid gap-x-8 gap-y-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WeeklyScores data={data} />
        <FlaggedStudents students={data.flagged_students} />
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <StatusDistribution data={data} />
        <Section
          title="Tiêu chí STAR của cả nhóm"
          caption={
            data.star
              ? `Trung bình của ${data.star.student_count} sinh viên (mỗi người tối đa 5 buổi gần nhất), thang 0–5.`
              : undefined
          }
        >
          <Panel className="flex-1">
            <StarAverageBars star={data.star} insight={data.insight} caption={null} />
          </Panel>
        </Section>
      </div>

      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-2">
        <TopImprovers students={data.top_improvers} />
        <RecentReviews items={data.recent_reviews} />
      </div>
    </>
  )
}

/** Một mục: tiêu đề (và chú thích) đặt ngoài ô. Ô biểu đồ giãn đều chiều cao với mục cùng hàng; ô danh sách theo nội dung. */
function Section({
  title,
  aside,
  caption,
  children,
}: {
  title: ReactNode
  aside?: ReactNode
  caption?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="grid gap-1">
        <SectionHeader title={title} aside={aside} />
        {caption && <p className="text-xs text-ink-2">{caption}</p>}
      </div>
      {children}
    </section>
  )
}

// ---------- Số liệu chính ----------

function StatCard({
  label,
  icon: Icon,
  iconClass,
  children,
  footer,
}: {
  label: string
  icon: LucideIcon
  iconClass: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <Panel className="flex flex-col justify-between gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", iconClass)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <p className="flex items-baseline gap-1.5">{children}</p>
      <div className="grid gap-1.5 text-xs text-ink-2">{footer}</div>
    </Panel>
  )
}

const BIG = "font-heading text-[32px] leading-9 font-bold tracking-[-0.025em] text-ink"

function Target({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <span className={cn(met && "font-medium text-good")}>
      {children}
      {met && " · Đạt"}
    </span>
  )
}

function StudentsCard({ data }: { data: Overview }) {
  return (
    <StatCard
      label="Sinh viên phụ trách"
      icon={Users}
      iconClass="bg-blue-soft text-blue"
      footer={
        <span>
          {data.sharing_count > 0
            ? `${data.sharing_count} sinh viên đang chia sẻ tài liệu với bạn`
            : "Chưa sinh viên nào chia sẻ tài liệu với bạn"}
        </span>
      }
    >
      <span className={BIG}>{data.student_count}</span>
      <span className="text-[13px] text-ink-2">sinh viên</span>
    </StatCard>
  )
}

function ActiveCard({ data }: { data: Overview }) {
  const rate = percent(data.active_count, data.student_count)
  return (
    <StatCard
      label={`Hoạt động ${data.active_days} ngày qua`}
      icon={Activity}
      iconClass="bg-violet-soft text-violet"
      footer={
        <>
          <div
            className="relative h-2 rounded-full bg-surface"
            role="img"
            aria-label={`${rate}% sinh viên hoạt động, mục tiêu ${data.active_target}%`}
          >
            <div className="h-full rounded-full bg-violet" style={{ width: `${rate}%` }} />
            <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${data.active_target}%` }} aria-hidden />
          </div>
          <Target met={rate >= data.active_target}>Mục tiêu ≥ {data.active_target}%</Target>
        </>
      }
    >
      <span className={BIG}>{rate}%</span>
      <span className="text-[13px] text-ink-2">
        ({data.active_count}/{data.student_count} SV)
      </span>
    </StatCard>
  )
}

function ScoreCard({ data }: { data: Overview }) {
  const delta = data.average_delta
  const TrendIcon = delta !== null && delta < 0 ? TrendingDown : TrendingUp
  return (
    <StatCard
      label="Điểm phỏng vấn TB"
      icon={BarChart3}
      iconClass="bg-good-soft text-good"
      footer={
        delta !== null ? (
          <span className="grid gap-0.5">
            <span className={cn("flex items-center gap-1.5 font-semibold", delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-ink-2")}>
              <TrendIcon className="size-4" aria-hidden />
              {delta > 0 ? "+" : ""}
              {formatScore(delta)} so với buổi đầu
            </span>
            <span>Trung bình của {data.delta_count} sinh viên có từ 2 buổi</span>
          </span>
        ) : (
          <span>Chưa sinh viên nào có đủ 2 buổi để so sánh</span>
        )
      }
    >
      <span className={BIG}>{data.average_score !== null ? formatScore(data.average_score) : "—"}</span>
      <span className="text-[13px] text-ink-2">/5</span>
    </StatCard>
  )
}

function CsatCard({ data }: { data: Overview }) {
  return (
    <StatCard
      label="Hài lòng (CSAT)"
      icon={Star}
      iconClass="bg-warn-soft text-gold"
      footer={
        data.csat !== null ? (
          <span className="grid gap-0.5">
            <Target met={data.csat >= data.csat_target}>Mục tiêu ≥ {formatScore(data.csat_target)}</Target>
            <span>{data.csat_count} lượt đánh giá sau phân tích CV và phỏng vấn</span>
          </span>
        ) : (
          <span>Sinh viên chưa gửi đánh giá nào</span>
        )
      }
    >
      <span className={BIG}>{data.csat !== null ? formatScore(data.csat) : "—"}</span>
      <span className="text-[13px] text-ink-2">/5</span>
    </StatCard>
  )
}

// ---------- Biểu đồ và danh sách ----------

function WeeklyScores({ data }: { data: Overview }) {
  const last = data.weekly_scores.length - 1
  const points: ScorePoint[] = data.weekly_scores.map((w, i) => ({
    label: formatDate(w.week_start).slice(0, 5),
    value: w.average,
    detail: `${i === last ? "Tuần này" : `Tuần từ ${formatDate(w.week_start).slice(0, 5)}`} · ${w.student_count} sinh viên có điểm`,
  }))
  return (
    <Section
      title="Điểm phỏng vấn trung bình theo tuần"
      caption="Mỗi sinh viên lấy điểm buổi gần nhất tính đến cuối tuần, thang 0–5."
    >
      <Panel className="flex-1">
        {points.length > 0 ? (
          <ScoreLineChart points={points} max={5} unit="điểm TB" sparseTicksOnMobile className="h-60" />
        ) : (
          <p className="py-10 text-center text-sm text-ink-2">Chưa có buổi phỏng vấn nào được chấm.</p>
        )}
      </Panel>
    </Section>
  )
}

function FlaggedStudents({ students }: { students: AssignedStudent[] }) {
  return (
    <Section
      title="Sinh viên cần chú ý"
      aside={
        <Badge variant={students.length ? "bad" : "neutral"} className="h-auto px-2 py-0.5">
          {students.length} sinh viên
        </Badge>
      }
      caption="Tự động gắn cờ khi 2 vòng liên tiếp không tăng điểm ở vị trí đang luyện; tự gỡ khi có buổi cao hơn buổi liền trước."
    >
      <Panel className="flex flex-col overflow-hidden p-0">
        {students.length === 0 ? (
          <p className="flex items-center gap-2 p-5 text-sm text-good">
            <BadgeCheck className="size-4" aria-hidden />
            Không có sinh viên nào cần chú ý.
          </p>
        ) : (
          <ul className="@container divide-y divide-line">
            {students.slice(0, FLAGGED_LIMIT).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/advisor/students/${encodeURIComponent(s.id)}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-bad-soft/30"
                >
                  <UserAvatar name={s.full_name} src={s.avatar_url} className="size-9" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-heading text-sm font-bold text-ink">{s.full_name}</span>
                    {s.flag && <span className="truncate text-xs text-ink-2">{s.flag.jd.title}</span>}
                    <FlagDetail student={s} />
                    <span className="@md:hidden">
                      <ScoreDelta student={s} />
                    </span>
                  </span>
                  <span className="@max-md:hidden">
                    <ScoreDelta student={s} />
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {students.length > FLAGGED_LIMIT && (
          <Link
            href="/advisor/students?status=flagged"
            className="border-t border-line px-5 py-3 text-sm font-medium text-blue hover:underline"
          >
            Xem cả {students.length} sinh viên
          </Link>
        )}
      </Panel>
    </Section>
  )
}

const STATUS_ROWS: { key: StudentStatus; note: string; bar: string }[] = [
  { key: "improving", note: "Tăng từ 0,3 điểm so với buổi đầu", bar: "bg-good" },
  { key: "stable", note: "Chênh lệch dưới 0,3 điểm", bar: "bg-blue" },
  { key: "declining", note: "Giảm từ 0,3 điểm so với buổi đầu", bar: "bg-warn" },
  { key: "flagged", note: "2 vòng liên tiếp không tăng điểm", bar: "bg-bad" },
  { key: "insufficient", note: "Chưa có 2 buổi ở vị trí đang luyện", bar: "bg-ink-3" },
]

function StatusDistribution({ data }: { data: Overview }) {
  const total = data.student_count
  return (
    <Section title="Phân bố mức tiến bộ" caption="Điểm buổi gần nhất so với buổi đầu ở vị trí sinh viên đang luyện.">
      <Panel className="grid flex-1 content-start gap-4">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-surface"
          role="img"
          aria-label={STATUS_ROWS.map((r) => `${STATUS_META[r.key].label} ${data.status_counts[r.key]}`).join(", ")}
        >
          {STATUS_ROWS.map((r) => (
            <div key={r.key} className={r.bar} style={{ width: `${percent(data.status_counts[r.key], total)}%` }} />
          ))}
        </div>
        <ul className="-mx-2 grid gap-1">
          {STATUS_ROWS.map((r) => {
            const meta = STATUS_META[r.key]
            const Icon = meta.icon
            const count = data.status_counts[r.key]
            return (
              <li key={r.key}>
                <Link
                  href={`/advisor/students?status=${r.key}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface"
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.className)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="text-sm font-medium text-ink">{meta.label}</span>
                    <span className="text-xs text-ink-2">{r.note}</span>
                  </span>
                  <span className="text-right text-sm whitespace-nowrap text-ink-2">
                    <strong className="font-heading text-base text-ink">{count}</strong> SV ({percent(count, total)}%)
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Panel>
    </Section>
  )
}

function TopImprovers({ students }: { students: AssignedStudent[] }) {
  return (
    <Section title="Tiến bộ nhiều nhất" aside={<span className="text-xs text-ink-2">Buổi đầu → gần nhất</span>}>
      <Panel className="overflow-hidden p-0">
        {students.length === 0 ? (
          <p className="p-5 text-center text-sm text-ink-2">Chưa có sinh viên nào tăng điểm so với buổi đầu.</p>
        ) : (
          <ol className="@container divide-y divide-line">
            {students.map((s, i) => (
              <li key={s.id}>
                <Link
                  href={`/advisor/students/${encodeURIComponent(s.id)}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface"
                >
                  <span className="w-4 shrink-0 text-center font-heading text-sm font-bold text-ink-3">{i + 1}</span>
                  <UserAvatar name={s.full_name} src={s.avatar_url} className="size-9" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-heading text-sm font-bold text-ink">{s.full_name}</span>
                    <span className="truncate text-xs text-ink-2">
                      {s.target?.title} · {s.focus_session_count} buổi
                    </span>
                    <span className="@md:hidden">
                      <ScoreDelta student={s} />
                    </span>
                  </span>
                  <span className="@max-md:hidden">
                    <ScoreDelta student={s} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </Section>
  )
}

function RecentReviews({ items }: { items: RecentReview[] }) {
  const seen = items.filter((r) => r.seen_at).length
  return (
    <Section
      title="Nhận xét đã gửi gần đây"
      // aside={
      //   items.length > 0 && (
      //     <span className="text-xs text-ink-2">
      //       Sinh viên đã xem{" "}
      //       <strong className="text-ink">
      //         {seen}/{items.length}
      //       </strong>
      //     </span>
      //   )
      // }
    >
      <Panel className="overflow-hidden p-0">
        {items.length === 0 ? (
          <p className="p-5 text-center text-sm text-ink-2">
            Bạn chưa gửi nhận xét nào. Nhận xét viết cho các báo cáo sinh viên đã chia sẻ.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/advisor/students/${encodeURIComponent(r.student_id)}`}
                  className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-surface"
                >
                  <UserAvatar name={r.student_name} src={r.avatar_url} className="size-9" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center justify-between gap-x-2">
                      <span className="font-heading text-sm font-bold text-ink">{r.student_name}</span>
                      {r.seen_at ? (
                        <span className="flex items-center gap-1 text-xs text-good">
                          <CheckCheck className="size-3.5" aria-hidden />
                          Đã xem {formatRelativeTime(r.seen_at).toLowerCase()}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-ink-2">
                          <Clock className="size-3.5" aria-hidden />
                          Chưa xem
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-ink-2">
                      {r.jd.title} · gửi {formatRelativeTime(r.updated_at).toLowerCase()}
                    </span>
                    <span className="line-clamp-2 text-sm text-ink">“{r.comment}”</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="grid gap-2.5 py-4 sm:py-6">
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-5 w-[520px] max-w-full" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-10 xl:grid-cols-[3fr_2fr]">
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    </div>
  )
}
