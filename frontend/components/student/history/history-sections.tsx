"use client"

import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileCheck2,
  FileText,
  Flag,
  Flame,
  History,
  LineChart,
  MessageSquareText,
  MessagesSquare,
  Radar as RadarIcon,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { Panel, PanelHeader } from "@/components/common/panel"
import { peakIndex, ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { StarRadar } from "@/components/student/interview/star-radar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatRelativeTime, formatTime, isToday } from "@/lib/format"
import { scoreVerdict } from "@/lib/star"
import type { CvComparison, InterviewHistoryItem, ProgressMilestone, StudentProgress } from "@/lib/types"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")
/** "07/09" */
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}
/** "07/09/2026" */
const fullDate = (iso: string) => `${shortDate(iso)}/${new Date(iso).getFullYear()}`
const signed = (n: number, digits = 0) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`

/** "Hôm nay, 09:30" · "3 ngày trước" · "14/10/2024" */
function whenLabel(iso: string): string {
  return isToday(iso) ? `Hôm nay, ${formatTime(iso)}` : formatRelativeTime(iso)
}

// ---------- 4 thẻ số liệu ----------

interface MetricCardProps {
  label: string
  icon: LucideIcon
  iconClass: string
  children: ReactNode
  footer: ReactNode
}

function MetricCard({ label, icon: Icon, iconClass, children, footer }: MetricCardProps) {
  return (
    <Panel className="grid content-between gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", iconClass)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <div className="grid gap-2">
        <div className="flex items-baseline gap-1 font-heading">{children}</div>
        <div className="text-xs text-ink-2">{footer}</div>
      </div>
    </Panel>
  )
}

const bigNumber = "text-[32px] leading-9 font-bold tracking-[-0.025em]"

export function ProgressMetrics({ progress }: { progress: StudentProgress }) {
  const { first_session: first, latest_score: latest, session_count, streak_days, cv_comparison: cv } = progress
  const delta = first && latest !== null && session_count > 1 ? latest - first.score : null
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Điểm buổi đầu tiên"
        icon={History}
        iconClass="bg-surface text-ink-2"
        footer={
          first && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warn" aria-hidden />
              Mốc mở đầu: {fullDate(first.completed_at)}
            </span>
          )
        }
      >
        <span className={cn(bigNumber, "text-ink")}>{first?.score ?? "—"}</span>
        <span className="text-[13px] text-ink-2">/100</span>
      </MetricCard>

      <MetricCard
        label="Điểm gần nhất"
        icon={TrendingUp}
        iconClass="bg-good-soft text-good"
        footer={
          delta !== null && (
            <Badge variant={delta >= 0 ? "good" : "warn"} className="h-auto px-2 py-0.5">
              {signed(delta)} điểm so với buổi đầu
            </Badge>
          )
        }
      >
        <span className={cn(bigNumber, "text-good")}>{latest ?? "—"}</span>
        <span className="text-[13px] text-ink-2">/100</span>
      </MetricCard>

      <MetricCard
        label="Số buổi đã luyện"
        icon={MessagesSquare}
        iconClass="bg-violet-soft text-violet"
        footer={
          streak_days > 1 ? (
            <span className="flex items-center gap-1 font-medium text-violet">
              <Flame className="size-3.5" aria-hidden />
              Chuỗi {streak_days} ngày luyện đều đặn
            </span>
          ) : (
            "Luyện đều mỗi tuần để thấy tiến bộ rõ hơn"
          )
        }
      >
        <span className={cn(bigNumber, "text-ink")}>{session_count}</span>
        <span className="text-[15px] font-semibold text-ink">buổi</span>
      </MetricCard>

      <MetricCard
        label="Độ khớp CV với JD"
        icon={FileText}
        iconClass="bg-blue-soft text-blue"
        footer={
          cv && (
            <span className="flex items-center gap-1 font-medium text-good">
              <CircleCheck className="size-3.5" aria-hidden />
              {signed(cv.match_after - cv.match_before)}% sau khi tối ưu CV
            </span>
          )
        }
      >
        {cv ? (
          <>
            <span className="text-xl font-semibold text-ink-2">{cv.match_before}%</span>
            <ArrowRight className="mx-1 size-4 self-center text-ink-3" aria-hidden />
            <span className={cn(bigNumber, "text-blue")}>{cv.match_after}%</span>
          </>
        ) : (
          <span className={cn(bigNumber, "text-ink-3")}>—</span>
        )}
      </MetricCard>
    </div>
  )
}

// ---------- Biểu đồ điểm qua các buổi ----------

export function ScoreTrendChart({ progress }: { progress: StudentProgress }) {
  const points: ScorePoint[] = useMemo(
    () =>
      [...progress.interviews].reverse().map((item, i) => ({
        label: `Buổi ${i + 1}`,
        sub: isToday(item.completed_at) ? "Hôm nay" : shortDate(item.completed_at),
        detail: item.round_title,
        value: item.total_score,
      })),
    [progress.interviews],
  )
  const peak = points[peakIndex(points)]
  const last = points.length - 1
  const perSession = points.length > 1 ? (points[last].value - points[0].value) / (points.length - 1) : null
  const spanDays = points.length > 1
    ? Math.round(
        (new Date(progress.interviews[0].completed_at).getTime() -
          new Date(progress.interviews[last].completed_at).getTime()) /
          86_400_000,
      )
    : 0
  const target =
    progress.target_score !== null ? { value: progress.target_score, label: progress.target_label ?? "Mục tiêu" } : null

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold">
            <LineChart className="size-[18px] text-blue" aria-hidden />
            Điểm phỏng vấn qua các buổi
          </h2>
          <p className="text-xs text-ink-2">Điểm tổng theo phương pháp STAR, thang 100</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-blue" aria-hidden />
            Điểm đạt được
          </span>
          {target && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-ink-3" aria-hidden />
              {target.label} ({target.value})
            </span>
          )}
          {points.length > 1 && (
            <span className="flex items-center gap-1.5 font-medium text-violet">
              <span className="size-2 rounded-full bg-violet" aria-hidden />
              Cao nhất: {peak.value} ({peak.label})
            </span>
          )}
        </div>
      </div>

      <ScoreLineChart points={points} target={target} highlight unit="điểm STAR" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-blue" aria-hidden />
          Tăng trưởng trung bình:{" "}
          <strong className="text-ink">{perSession !== null ? `${signed(perSession, 1)} điểm/buổi` : "chưa đủ dữ liệu"}</strong>
        </span>
        {spanDays > 0 && <span>Khoảng thời gian: {spanDays} ngày luyện tập</span>}
      </div>
    </Panel>
  )
}

// ---------- So sánh STAR buổi đầu và buổi gần nhất ----------

export function StarCompareCard({ progress }: { progress: StudentProgress }) {
  const { star_first: first, star_latest: latest, star_insight: insight } = progress
  return (
    <Panel className="grid content-start gap-3">
      <PanelHeader icon={RadarIcon} title="So sánh 4 tiêu chí STAR" />
      {latest ? (
        <>
          <p className="-mt-2 text-xs text-ink-2">Buổi đầu tiên so với buổi gần nhất</p>
          <StarRadar star={latest} compare={first} className="h-60" />
          <div className="flex flex-wrap justify-center gap-4 text-xs text-ink-2">
            {first && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-ink-3" aria-hidden />
                Buổi đầu ({progress.first_session && shortDate(progress.first_session.completed_at)})
              </span>
            )}
            <span className="flex items-center gap-1.5 font-medium text-violet">
              <span className="h-2 w-4 rounded-sm bg-violet" aria-hidden />
              Buổi gần nhất
            </span>
          </div>
          {insight && (
            <p className="flex gap-2 rounded-xl bg-violet-soft/60 p-3 text-xs leading-5 text-ink">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
              <span>
                <strong className="text-violet">Nhận xét từ AI Coach: </strong>
                {insight}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="rounded-xl bg-surface p-4 text-center text-sm text-ink-2">
          Cần ít nhất 2 buổi phỏng vấn để so sánh các tiêu chí STAR.
        </p>
      )}
    </Panel>
  )
}

// ---------- So sánh phiên bản CV ----------

function CompareBar({
  label,
  before,
  after,
  unit,
  barClass,
  chipClass,
}: {
  label: string
  before: number
  after: number
  unit: string
  barClass: string
  chipClass: string
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-ink-2">
            {before}
            {unit}
          </span>
          <ArrowRight className="size-3.5 text-ink-3" aria-hidden />
          <strong className="text-ink">
            {after}
            {unit}
          </strong>
          <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", chipClass)}>
            {signed(after - before)}
            {unit === "%" ? "%" : ""}
          </span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface">
        <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-30", barClass)} style={{ width: `${after}%` }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full", barClass)} style={{ width: `${before}%` }} />
      </div>
    </div>
  )
}

const KEYWORDS_SHOWN = 4

export function CvComparisonCard({ comparison: cv }: { comparison: CvComparison | null }) {
  const [showAll, setShowAll] = useState(false)
  if (!cv) {
    return (
      <Panel className="grid content-center justify-items-center gap-3 text-center">
        <FileText className="size-8 text-ink-3" aria-hidden />
        <p className="font-heading font-bold">Chưa có phiên bản CV tối ưu</p>
        <p className="max-w-sm text-sm text-ink-2">Phân tích CV với một JD rồi áp dụng gợi ý để thấy thay đổi giữa các phiên bản.</p>
        <Button variant="soft" nativeButton={false} render={<Link href="/student/analysis/new" />}>
          Phân tích CV & JD
        </Button>
      </Panel>
    )
  }
  const keywords = showAll ? cv.keywords_added : cv.keywords_added.slice(0, KEYWORDS_SHOWN)
  const hidden = cv.keywords_added.length - KEYWORDS_SHOWN
  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold">
            <FileCheck2 className="size-[18px] text-blue" aria-hidden />
            So sánh phiên bản CV (v{cv.from.version} và v{cv.to.version})
          </h2>
          <p className="text-xs text-ink-2">Đối chiếu với JD {cv.jd_title}</p>
        </div>
        {cv.analysis_id && (
          <Link
            href={`/student/analysis/${encodeURIComponent(cv.analysis_id)}`}
            className="flex items-center gap-1 text-sm font-medium text-blue hover:underline"
          >
            Xem chi tiết phân tích
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-xl bg-surface p-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-5 shrink-0 text-ink-2" aria-hidden />
          <div className="grid min-w-0">
            <span className="truncate text-sm font-medium text-ink">{cv.from.file_name}</span>
            <span className="text-xs text-ink-2">Bản gốc (v{cv.from.version})</span>
          </div>
        </div>
        <ArrowRight className="size-4 text-ink-3" aria-hidden />
        <div className="flex min-w-0 items-center gap-2">
          <FileCheck2 className="size-5 shrink-0 text-violet" aria-hidden />
          <div className="grid min-w-0">
            <span className="truncate text-sm font-medium text-violet">{cv.to.file_name}</span>
            <span className="text-xs text-ink-2">Bản đã tối ưu (v{cv.to.version})</span>
          </div>
        </div>
      </div>

      <CompareBar label="Điểm ATS" before={cv.ats_before} after={cv.ats_after} unit="/100" barClass="bg-blue" chipClass="bg-good-soft text-good" />
      <CompareBar label="Độ khớp với JD" before={cv.match_before} after={cv.match_after} unit="%" barClass="bg-violet" chipClass="bg-violet-soft text-violet" />

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-ink">Từ khoá chuyên môn có bằng chứng</span>
          <span className="flex items-center gap-1.5">
            <span className="text-ink-2">{cv.keywords_before} từ khoá</span>
            <ArrowRight className="size-3.5 text-ink-3" aria-hidden />
            <strong className="text-ink">{cv.keywords_after} từ khoá</strong>
            <span className="rounded-md bg-violet-soft px-1.5 py-0.5 text-xs font-semibold text-violet">
              {signed(cv.keywords_after - cv.keywords_before)}
            </span>
          </span>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Từ khoá được bổ sung">
          {keywords.map((k) => (
            <li key={k} className="flex items-center gap-1 rounded-full bg-good-soft px-2.5 py-1 text-xs font-medium text-good">
              <CircleCheck className="size-3.5" aria-hidden />
              {k}
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-blue-soft hover:text-blue"
              >
                {showAll ? "Thu gọn" : `+${hidden} từ khác`}
              </button>
            </li>
          )}
        </ul>
      </div>

      <p className="mt-auto flex items-start gap-1.5 border-t border-line pt-3 text-xs text-ink-2">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
        Chỉ tính từ khoá có dẫn chứng trong nội dung CV, không tính từ khoá được chèn thêm mà không có kinh nghiệm tương ứng.
      </p>
    </Panel>
  )
}

// ---------- Cột mốc ----------

const MILESTONE_STYLE: Record<ProgressMilestone["kind"], { icon: LucideIcon; ring: string }> = {
  interview: { icon: MessagesSquare, ring: "border-good text-good" },
  advisor_comment: { icon: MessageSquareText, ring: "border-violet text-violet" },
  cv_export: { icon: FileCheck2, ring: "border-blue text-blue" },
  start: { icon: Flag, ring: "border-ink-3 text-ink-2" },
}

export function MilestoneTimeline({ milestones }: { milestones: ProgressMilestone[] }) {
  return (
    <Panel className="grid content-start gap-4">
      <PanelHeader
        icon={Flag}
        title="Cột mốc học tập & tiến bộ"
        aside={<span className="text-xs text-ink-2">{milestones.length} sự kiện</span>}
      />
      {milestones.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-center text-sm text-ink-2">Chưa có cột mốc nào trong khoảng thời gian này.</p>
      ) : (
        <ol className="grid">
          {milestones.map((m, i) => {
            const style = MILESTONE_STYLE[m.kind]
            const Icon = style.icon
            return (
              <li key={m.id} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                {i < milestones.length - 1 && (
                  <span className="absolute top-8 bottom-1 left-[13px] w-0.5 rounded bg-line" aria-hidden />
                )}
                <span className={cn("grid size-7 place-items-center rounded-full border-2 bg-card", style.ring)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="grid gap-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-heading text-sm font-bold text-ink">{m.title}</p>
                    <time
                      dateTime={m.occurred_at}
                      className={cn("text-xs", i === 0 ? "font-medium text-blue" : "text-ink-2")}
                    >
                      {whenLabel(m.occurred_at)}
                    </time>
                  </div>
                  <p className="text-xs leading-5 text-ink-2">{m.description}</p>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <p className="flex items-start gap-1.5 border-t border-line pt-3 text-xs text-ink-2">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
        Cột mốc được ghi lại tự động từ hoạt động của bạn trên hệ thống.
      </p>
    </Panel>
  )
}

// ---------- Nhật ký các buổi phỏng vấn ----------

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-xs text-ink-3">—</span>
  const w = 72
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 8)
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / range) * (h - 4)).toFixed(1)}`)
    .join(" ")
  const diff = values[values.length - 1] - values[0]
  const stroke = diff >= 4 ? "var(--good)" : diff <= -4 ? "var(--warn)" : "var(--blue)"
  const trend = diff >= 4 ? "tăng dần" : diff <= -4 ? "giảm dần" : "ổn định"
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Điểm các câu ${trend}`}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PAGE_SIZE = 5
const ALL = "all"

export function InterviewLog({ interviews }: { interviews: InterviewHistoryItem[] }) {
  const [query, setQuery] = useState("")
  const [position, setPosition] = useState(ALL)
  const [page, setPage] = useState(0)

  const positions = useMemo(() => [...new Set(interviews.map((i) => i.jd.title))], [interviews])
  const positionItems = [
    { value: ALL, label: "Tất cả vị trí" },
    ...positions.map((p) => ({ value: p, label: p })),
  ]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return interviews.filter(
      (i) =>
        (position === ALL || i.jd.title === position) &&
        (!q || [i.jd.title, i.jd.company ?? "", i.round_title].some((s) => s.toLowerCase().includes(q))),
    )
  }, [interviews, query, position])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <Panel className="grid gap-4 p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
        <div className="grid gap-0.5">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold">
            <MessagesSquare className="size-[18px] text-blue" aria-hidden />
            Nhật ký các buổi phỏng vấn thử
          </h2>
          <p className="text-xs text-ink-2">Điểm STAR, vòng phỏng vấn và báo cáo chi tiết của từng buổi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder="Tìm theo vị trí, công ty..."
              aria-label="Tìm buổi phỏng vấn"
              className="h-9 border-transparent bg-surface pl-9"
            />
          </div>
          <Select
            items={positionItems}
            value={position}
            onValueChange={(v) => {
              setPosition(String(v))
              setPage(0)
            }}
          >
            <SelectTrigger className="h-9 min-w-48 border-transparent bg-surface" aria-label="Lọc theo vị trí">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-6 py-3">Thời gian</th>
              <th scope="col" className="px-3 py-3">Vị trí mục tiêu</th>
              <th scope="col" className="px-3 py-3">Vòng phỏng vấn</th>
              <th scope="col" className="hidden px-3 py-3 text-center min-[1360px]:table-cell">Số câu</th>
              <th scope="col" className="px-3 py-3">Điểm STAR</th>
              <th scope="col" className="hidden px-3 py-3 min-[1360px]:table-cell">Xu hướng</th>
              <th scope="col" className="px-6 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-ink-2">
                  Không có buổi phỏng vấn nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              rows.map((item) => {
                const v = scoreVerdict(item.total_score)
                return (
                  <tr key={item.id} className="hover:bg-surface/60">
                    <td className="px-6 py-3.5">
                      <p className="font-medium whitespace-nowrap text-ink">{whenLabel(item.completed_at)}</p>
                      <p className="text-xs text-ink-2">
                        {Math.max(1, Math.round(item.duration_seconds / 60))} phút
                        <span className="hidden min-[1360px]:inline"> thực hành</span>
                        <span className="min-[1360px]:hidden"> · {item.question_count} câu</span>
                      </p>
                    </td>
                    <td className="min-w-44 px-3 py-3.5">
                      <p className="font-medium text-ink min-[1360px]:whitespace-nowrap">{item.jd.title}</p>
                      {item.jd.company && <p className="text-xs text-ink-2">{item.jd.company}</p>}
                    </td>
                    <td className="min-w-40 px-3 py-3.5">
                      <Badge variant="neutral" className="h-auto rounded-md px-2 py-0.5 text-left whitespace-normal min-[1360px]:whitespace-nowrap">
                        {item.round_title}
                      </Badge>
                    </td>
                    <td className="hidden px-3 py-3.5 text-center text-ink min-[1360px]:table-cell">{item.question_count}</td>
                    <td className="px-3 py-3.5">
                      <span className="flex flex-col items-start gap-1 whitespace-nowrap min-[1360px]:flex-row min-[1360px]:items-center min-[1360px]:gap-2">
                        <strong className={cn("font-heading", v.className)}>{item.total_score}/100</strong>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", v.badge)}>{v.label}</span>
                      </span>
                    </td>
                    <td className="hidden px-3 py-3.5 min-[1360px]:table-cell">
                      <Sparkline values={item.question_scores} />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="flex flex-col items-end gap-1 min-[1360px]:flex-row min-[1360px]:items-center min-[1360px]:justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue hover:bg-blue-soft hover:text-blue"
                          nativeButton={false}
                          render={<Link href={`/student/interview/${encodeURIComponent(item.id)}/report`} />}
                        >
                          Xem báo cáo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-violet hover:bg-violet-soft hover:text-violet"
                          nativeButton={false}
                          render={<Link href={`/student/interview/new?jd=${encodeURIComponent(item.jd.id)}`} />}
                        >
                          <RotateCcw aria-hidden />
                          Luyện lại
                        </Button>
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3 text-xs text-ink-2">
        <span>
          Hiển thị {rows.length} / {filtered.length} buổi phỏng vấn
        </span>
        {pageCount > 1 && (
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Trang trước" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-12 text-center font-medium text-ink">
              {current + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Trang sau"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </span>
        )}
      </div>
    </Panel>
  )
}
