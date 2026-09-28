"use client"

import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCheck,
  Clock,
  Flag,
  LineChart,
  MessageSquareText,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { FlagDetail, ScoreDelta } from "@/components/advisor/student-status"
import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreLineChart } from "@/components/common/score-line-chart"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AdvisorOverview as Overview } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

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

// Figma: frame "Tổng quan Cố vấn" (18:4850). PRD US-ADV-01, US-ADV-02.
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

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-2xl gap-2">
          <h1 className="font-heading text-[28px] leading-9 font-bold">
            {greeting(new Date())}, {callName(data.advisor_name)}!
          </h1>
          <p className="text-sm leading-6 text-ink-2">
            Hôm nay có{" "}
            <Link href="/advisor/students?status=pending" className="font-semibold text-blue hover:underline">
              {data.pending_reviews} báo cáo chờ nhận xét
            </Link>{" "}
            và{" "}
            <Link href="/advisor/students?status=flagged" className="font-semibold text-bad hover:underline">
              {data.flagged_count} sinh viên cần chú ý
            </Link>{" "}
            trong tổng số {data.student_count} sinh viên phụ trách.
          </p>
        </div>
        <Button size="brand" nativeButton={false} render={<Link href="/advisor/students?status=pending" />}>
          <MessageSquareText aria-hidden />
          Nhận xét báo cáo
          <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold text-blue">{data.pending_reviews}</span>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Sinh viên phụ trách" icon={Users} iconClass="bg-blue-soft text-blue" footer={<span>Đang theo dõi học kỳ này</span>}>
          <span className="font-heading text-[40px] leading-none font-bold">{data.student_count}</span>
        </StatCard>
        <StatCard
          label="Điểm phỏng vấn trung bình"
          icon={BarChart3}
          iconClass="bg-good-soft text-good"
          footer={
            data.average_score_delta !== null && (
              <span className="flex items-center gap-1.5 font-medium text-good">
                <TrendingUp className="size-4" aria-hidden />+{data.average_score_delta} điểm so với vòng đầu (trung bình)
              </span>
            )
          }
        >
          <span className="font-heading text-[40px] leading-none font-bold">{data.average_score ?? "—"}</span>
          <span className="text-sm text-ink-2">/100</span>
        </StatCard>
        <StatCard
          label="Tỷ lệ sinh viên hoạt động"
          icon={Sparkles}
          iconClass="bg-violet-soft text-violet"
          footer={
            <div className="grid w-full gap-1.5">
              <div className="relative h-2 rounded-full bg-surface">
                <div className="h-full rounded-full bg-violet" style={{ width: `${data.active_rate}%` }} />
                <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${data.active_target}%` }} aria-hidden />
              </div>
              <span className="flex justify-between">
                <span>Trong 7 ngày qua</span>
                <span>Mục tiêu: ≥ {data.active_target}%</span>
              </span>
            </div>
          }
        >
          <span className="font-heading text-[40px] leading-none font-bold">{data.active_rate}%</span>
        </StatCard>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="grid gap-4">
          <PanelHeader
            icon={LineChart}
            title="Điểm phỏng vấn trung bình theo tuần"
            aside={<span className="text-xs text-ink-2">Điểm gần nhất của mỗi sinh viên</span>}
          />
          {data.weekly_scores.length > 0 ? (
            <ScoreLineChart points={data.weekly_scores} unit="điểm TB" className="h-60" />
          ) : (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-2">Chưa có buổi phỏng vấn nào được chấm.</p>
          )}
        </Panel>
        <FlaggedStudents students={data.flagged_students} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ScoreBands data={data} />
        <RecentFeedback items={data.recent_feedback} />
      </div>
    </div>
  )
}

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
    <Panel className="flex flex-col justify-between gap-5 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{label}</p>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", iconClass)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <p className="flex items-baseline gap-1">{children}</p>
      <div className="flex text-xs text-ink-2">{footer}</div>
    </Panel>
  )
}

function FlaggedStudents({ students }: { students: Overview["flagged_students"] }) {
  return (
    <Panel className="grid gap-4">
      <PanelHeader
        icon={Flag}
        title="Sinh viên cần chú ý"
        aside={
          <Badge variant="bad" className="h-auto px-2 py-0.5">
            {students.length} sinh viên
          </Badge>
        }
      />
      <p className="-mt-2 text-xs text-ink-2">Tự động gắn cờ khi 2 vòng phỏng vấn liên tiếp không tăng điểm.</p>
      {students.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-good-soft/60 p-4 text-sm text-good">
          <BadgeCheck className="size-4" aria-hidden />
          Không có sinh viên nào cần chú ý.
        </p>
      ) : (
        <ul className="grid gap-2">
          {students.map((s) => (
            <li key={s.id}>
              <Link
                href={`/advisor/students/${encodeURIComponent(s.id)}`}
                className="flex items-center gap-3 rounded-xl bg-bad-soft/40 p-3 transition-colors hover:bg-bad-soft/70"
              >
                <UserAvatar name={s.full_name} src={s.avatar_url} className="size-9" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-heading text-sm font-bold text-ink">{s.full_name}</span>
                  <FlagDetail student={s} />
                </span>
                <ScoreDelta student={s} />
                <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const BAND_STYLE = [
  { dot: "bg-bad", bar: "bg-bad", text: "text-bad" },
  { dot: "bg-warn", bar: "bg-warn", text: "text-warn" },
  { dot: "bg-good", bar: "bg-good", text: "text-good" },
]

function ScoreBands({ data }: { data: Overview }) {
  const total = data.score_bands.reduce((sum, b) => sum + b.count, 0)
  return (
    <Panel className="grid gap-5">
      <PanelHeader
        icon={BarChart3}
        title="Phân bố điểm gần nhất"
        aside={<span className="text-xs text-ink-2">{total} sinh viên có điểm</span>}
      />
      <ul className="grid gap-4">
        {data.score_bands.map((b, i) => {
          const pct = total ? Math.round((b.count / total) * 100) : 0
          const style = BAND_STYLE[i] ?? BAND_STYLE[1]
          return (
            <li key={b.label} className="grid gap-1.5">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className={cn("flex items-center gap-2 font-medium", style.text)}>
                  <span className={cn("size-2 rounded-full", style.dot)} aria-hidden />
                  {b.min} – {b.max} điểm · {b.label}
                </span>
                <span className="font-semibold text-ink">
                  {b.count} SV ({pct}%)
                </span>
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      {data.csat !== null && (
        <p className="flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-2">
          <Star className="size-4 text-gold" aria-hidden />
          Sinh viên đánh giá trải nghiệm (CSAT): <strong className="text-ink">{data.csat.toFixed(1)} / 5</strong> (mục tiêu ≥ 4.0)
        </p>
      )}
    </Panel>
  )
}

function RecentFeedback({ items }: { items: Overview["recent_feedback"] }) {
  const seenIn24h = items.filter((f) => f.seen_at && new Date(f.seen_at).getTime() - new Date(f.sent_at).getTime() < 86_400_000).length
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={MessageSquareText} title="Nhận xét đã gửi gần đây" />
      {items.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-center text-sm text-ink-2">Bạn chưa gửi nhận xét nào.</p>
      ) : (
        <ul className="grid gap-2">
          {items.map((f) => (
            <li key={f.id}>
              <Link
                href={`/advisor/students/${encodeURIComponent(f.student_id)}`}
                className="flex gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-blue-soft/50"
              >
                <UserAvatar name={f.student_name} src={null} className="size-9" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center justify-between gap-x-2">
                    <span className="font-heading text-sm font-bold text-ink">{f.student_name}</span>
                    {f.seen_at ? (
                      <span className="flex items-center gap-1 text-xs text-good">
                        <CheckCheck className="size-3.5" aria-hidden />
                        Đã xem {formatRelativeTime(f.seen_at).toLowerCase()}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-ink-2">
                        <Clock className="size-3.5" aria-hidden />
                        Chưa xem ({formatRelativeTime(f.sent_at).toLowerCase()})
                      </span>
                    )}
                  </span>
                  <span className="truncate text-sm text-ink-2">“{f.excerpt}”</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <p className="border-t border-line pt-3 text-xs text-ink-2">
          Sinh viên đã xem trong 24 giờ: <strong className="text-ink">{Math.round((seenIn24h / items.length) * 100)}%</strong>
        </p>
      )}
    </Panel>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải tổng quan">
      <Skeleton className="h-20 rounded-[20px]" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    </div>
  )
}
