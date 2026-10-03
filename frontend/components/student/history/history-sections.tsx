"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, MessagesSquare, RotateCcw, TimerOff } from "lucide-react"

import { Panel, SectionHeader } from "@/components/common/panel"
import { ScoreLineChart, type ScorePoint } from "@/components/common/score-line-chart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MATCH_LABEL_META, formatPercent } from "@/lib/analysis"
import { formatDate, formatWhen } from "@/lib/format"
import { LABEL_META, STAR_META, STAR_ORDER, formatScore, labelOf, trendOf } from "@/lib/interview"
import type { AnalysisRow, CvProgress, InterviewProgress, InterviewRow } from "@/lib/types"
import { cn } from "@/lib/utils"

const pad = (n: number) => String(n).padStart(2, "0")
/** "07/09" */
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}
const signed = (n: number, format: (n: number) => string = formatScore) => `${n > 0 ? "+" : ""}${format(n)}`

function JdTitle({ jd }: { jd: { title: string; company: string | null } }) {
  return (
    <span className="grid min-w-0">
      <span className="truncate font-heading text-base font-bold text-ink">{jd.title}</span>
      {jd.company && <span className="truncate text-xs text-ink-2">{jd.company}</span>}
    </span>
  )
}

/** Tiêu đề mục đặt ngoài ô (như trang Tổng quan) kèm một dòng giải thích cách đọc số liệu. */
function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1">
      <SectionHeader title={title} />
      <p className="text-xs text-ink-2">{description}</p>
    </div>
  )
}

// ---------- Tiến bộ phỏng vấn theo vị trí (PRD mục 5.1, 2 lớp) ----------

export function DeltaLine({ label, delta }: { label: string; delta: number }) {
  const trend = trendOf(delta)
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
      <strong className={cn("font-heading", trend.className)}>{signed(delta)}</strong>
      <span className="text-ink-2">{label}</span>
      <span className={cn("text-xs font-medium", trend.className)}>· {trend.text}</span>
    </p>
  )
}

/** Lớp 2: S/T/A/R buổi trước so với buổi gần nhất. */
export function StarCompare({ group }: { group: InterviewProgress }) {
  const previous = group.star_previous
  return (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">Điểm từng tiêu chí</p>
        <span className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
          {previous && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-ink-3/40" aria-hidden />
              Buổi trước
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-violet" aria-hidden />
            Buổi gần nhất
          </span>
        </span>
      </div>
      <ul className="grid gap-3">
        {STAR_ORDER.map((key) => {
          const latest = group.star_latest[key]
          const before = previous?.[key]
          const delta = before !== undefined ? Math.round((latest - before) * 100) / 100 : null
          return (
            <li key={key} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <span className="grid size-6 place-items-center rounded-md bg-blue-soft text-xs font-bold text-blue">
                    {STAR_META[key].letter}
                  </span>
                  {STAR_META[key].label}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {before !== undefined && <span className="text-ink-2">{formatScore(before)} →</span>}
                  <strong className="font-heading text-sm text-ink">{formatScore(latest)}/5</strong>
                  {delta !== null && <span className={cn("font-semibold", trendOf(delta).className)}>({signed(delta)})</span>}
                </span>
              </div>
              {before !== undefined && (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                  <div className="h-full rounded-full bg-ink-3/40" style={{ width: `${(before / 5) * 100}%` }} />
                </div>
              )}
              <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className="h-full rounded-full bg-violet" style={{ width: `${(latest / 5) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function InterviewProgressCard({ group }: { group: InterviewProgress }) {
  const points: ScorePoint[] = group.points.map((p, i) => ({
    label: `Buổi ${i + 1}`,
    sub: shortDate(p.completed_at),
    detail: formatDate(p.completed_at),
    value: p.score,
  }))
  const label = LABEL_META[labelOf(group.latest_score)]
  const single = group.session_count === 1
  // Mới có 2 buổi thì buổi trước chính là buổi đầu: chỉ hiện một dòng so sánh.
  const previousIsFirst = group.previous_session_id === group.points[0].id

  return (
    <Panel className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <JdTitle jd={group.jd} />
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{group.session_count} buổi</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-violet hover:bg-violet-soft hover:text-violet"
            nativeButton={false}
            render={<Link href={`/student/interview/new?jd=${encodeURIComponent(group.jd.id)}`} />}
          >
            <RotateCcw aria-hidden />
            Luyện lại
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Lớp 1: điểm tổng qua các buổi */}
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <p className="flex items-end gap-2">
              <span className={cn("font-heading text-4xl leading-none font-extrabold", label.className)}>
                {formatScore(group.latest_score)}
              </span>
              <span className="pb-0.5 text-sm font-semibold text-ink-3">/5</span>
              <Badge variant="neutral" className={cn("mb-0.5", label.badge)}>
                {label.text}
              </Badge>
            </p>
            {single ? (
              <p className="text-sm text-ink-2">Mới có 1 buổi trong khoảng này. Luyện thêm để theo dõi tiến bộ.</p>
            ) : (
              <div className="grid gap-0.5">
                {group.delta_from_previous !== null && <DeltaLine label="so với buổi trước" delta={group.delta_from_previous} />}
                {group.delta_from_first !== null && !previousIsFirst && (
                  <p className="text-xs text-ink-2">
                    {signed(group.delta_from_first)} so với buổi đầu trong khoảng ({formatScore(group.first_score)} →{" "}
                    {formatScore(group.latest_score)})
                  </p>
                )}
              </div>
            )}
          </div>
          {!single && <ScoreLineChart points={points} highlight max={5} unit="điểm STAR" className="h-56" />}
          <Link
            href={`/student/interview/${encodeURIComponent(group.latest_session_id)}/report`}
            className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-blue hover:underline"
          >
            Xem báo cáo buổi gần nhất
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <StarCompare group={group} />
      </div>
    </Panel>
  )
}

export function InterviewProgressSection({ groups }: { groups: InterviewProgress[] }) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        title="Tiến bộ phỏng vấn"
        description="Điểm STAR thang 0–5, so sánh trong từng vị trí. Chênh từ 0,3 điểm trở lên so với buổi trước được xem là thay đổi rõ."
      />
      {groups.length === 0 ? (
        <Panel className="grid justify-items-center gap-2 py-10 text-center">
          <MessagesSquare className="size-6 text-ink-3" aria-hidden />
          <p className="text-sm text-ink-2">Chưa có buổi phỏng vấn nào trong khoảng này.</p>
        </Panel>
      ) : (
        groups.map((group) => <InterviewProgressCard key={group.jd.id} group={group} />)
      )}
    </section>
  )
}

// ---------- Tiến bộ CV (độ khớp qua các phiên bản CV với cùng JD) ----------

function CvProgressGroup({ group }: { group: CvProgress }) {
  const last = group.points.length - 1
  return (
    <Panel className="grid content-start gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <JdTitle jd={group.jd} />
        {group.delta !== null && (
          <Badge variant={group.delta > 0 ? "good" : group.delta < 0 ? "bad" : "neutral"}>
            {group.delta === 0 ? "Không đổi" : `${signed(group.delta, formatPercent)} điểm`}
          </Badge>
        )}
      </div>
      <ul className="grid gap-2.5">
        {group.points.map((p, i) => (
          <li key={p.analysis_id}>
            <Link
              href={`/student/analysis/${encodeURIComponent(p.analysis_id)}`}
              className="grid grid-cols-[64px_minmax(0,1fr)_56px] items-center gap-3 rounded-lg px-1 py-0.5 text-sm hover:bg-surface"
              aria-label={`CV ${p.cv_label}: khớp ${formatPercent(p.match_score)}%, xem phân tích`}
            >
              <span className={cn("font-medium", i === last ? "text-ink" : "text-ink-2")}>CV {p.cv_label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface">
                <span
                  className={cn("block h-full rounded-full", i === last ? "bg-blue" : "bg-blue/35")}
                  style={{ width: `${p.match_score}%` }}
                />
              </span>
              <strong className={cn("text-right font-heading", i === last ? "text-ink" : "text-ink-2")}>
                {formatPercent(p.match_score)}%
              </strong>
            </Link>
          </li>
        ))}
      </ul>
      {group.points.length === 1 && (
        <p className="text-xs text-ink-2">Tối ưu CV rồi phân tích lại với JD này để thấy độ khớp thay đổi.</p>
      )}
    </Panel>
  )
}

export function CvProgressSection({ groups }: { groups: CvProgress[] }) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        title="Tiến bộ CV"
        description="Độ khớp CV–JD (0–100) qua các phiên bản CV với cùng một JD; mỗi phiên bản lấy lần phân tích gần nhất."
      />
      {groups.length === 0 ? (
        <Panel className="grid justify-items-center gap-3 py-8 text-center">
          <p className="text-sm text-ink-2">Chưa có lượt phân tích hoàn thành nào trong khoảng này.</p>
          <Button variant="soft" nativeButton={false} render={<Link href="/student/analysis/new" />}>
            Phân tích CV với JD
          </Button>
        </Panel>
      ) : (
        <div className="grid items-start gap-6 md:grid-cols-2">
          {groups.map((group) => (
            <CvProgressGroup key={group.jd.id} group={group} />
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- Bảng buổi phỏng vấn & lượt phân tích ----------

const PAGE_SIZE = 5

function usePage<T>(rows: T[]) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  return { rows: rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE), current, pageCount, setPage }
}

interface TablePanelProps {
  title: string
  total: number
  unit: string
  head: ReactNode
  columns: number
  empty: string
  page: ReturnType<typeof usePage>
  children: ReactNode
}

function TablePanel({ title, total, unit, head, columns, empty, page, children }: TablePanelProps) {
  return (
    <section className="grid gap-3">
      <SectionHeader title={title} aside={<span className="text-sm text-ink-2">{total} {unit}</span>} />
      <Panel className="grid overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase">{head}</thead>
            <tbody className="divide-y divide-line">
              {total === 0 ? (
                <tr>
                  <td colSpan={columns} className="px-6 py-10 text-center text-ink-2">
                    {empty}
                  </td>
                </tr>
              ) : (
                children
              )}
            </tbody>
          </table>
        </div>
        {page.pageCount > 1 && (
          <div className="flex items-center justify-end gap-1 border-t border-line px-6 py-3 text-xs text-ink-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Trang trước"
              disabled={page.current === 0}
              onClick={() => page.setPage(page.current - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="min-w-12 text-center font-medium text-ink">
              {page.current + 1} / {page.pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Trang sau"
              disabled={page.current >= page.pageCount - 1}
              onClick={() => page.setPage(page.current + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </Panel>
    </section>
  )
}

export function InterviewTable({ rows }: { rows: InterviewRow[] }) {
  const page = usePage(rows)
  return (
    <TablePanel
      title="Các buổi phỏng vấn thử"
      total={rows.length}
      unit="buổi"
      columns={5}
      empty="Không có buổi phỏng vấn nào trong khoảng này."
      page={page}
      head={
        <tr>
          <th scope="col" className="px-6 py-3">Thời gian</th>
          <th scope="col" className="px-3 py-3">Vị trí</th>
          <th scope="col" className="px-3 py-3">Điểm STAR</th>
          <th scope="col" className="px-3 py-3">Câu hết giờ</th>
          <th scope="col" className="px-6 py-3 text-right">Hành động</th>
        </tr>
      }
    >
      {page.rows.map((row) => {
        const label = LABEL_META[row.label]
        return (
          <tr key={row.id} className="hover:bg-surface/60">
            <td className="px-6 py-3.5">
              <p className="font-medium whitespace-nowrap text-ink">{formatWhen(row.completed_at)}</p>
              <p className="text-xs text-ink-2">{Math.max(1, Math.round(row.duration_seconds / 60))} phút</p>
            </td>
            <td className="min-w-44 px-3 py-3.5">
              <p className="font-medium text-ink">{row.jd.title}</p>
              {row.jd.company && <p className="text-xs text-ink-2">{row.jd.company}</p>}
            </td>
            <td className="px-3 py-3.5">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <strong className={cn("font-heading", label.className)}>{formatScore(row.overall_score)}/5</strong>
                <Badge variant="neutral" className={label.badge}>
                  {label.text}
                </Badge>
              </span>
            </td>
            <td className="px-3 py-3.5">
              {row.timed_out_count > 0 ? (
                <Badge variant="warn">
                  <TimerOff aria-hidden />
                  {row.timed_out_count} câu
                </Badge>
              ) : (
                <span className="text-ink-3">—</span>
              )}
            </td>
            <td className="px-6 py-3.5 text-right">
              <Button
                variant="ghost"
                size="sm"
                className="text-blue hover:bg-blue-soft hover:text-blue"
                nativeButton={false}
                render={<Link href={`/student/interview/${encodeURIComponent(row.id)}/report`} />}
              >
                Xem báo cáo
              </Button>
            </td>
          </tr>
        )
      })}
    </TablePanel>
  )
}

function AnalysisStatusCell({ row }: { row: AnalysisRow }) {
  if (row.status === "processing") {
    return (
      <Badge variant="blue">
        <Loader2 className="animate-spin" aria-hidden />
        Đang phân tích
      </Badge>
    )
  }
  if (row.status === "failed" || row.match_score === null) return <Badge variant="bad">Lỗi</Badge>
  const label = row.match_label ? MATCH_LABEL_META[row.match_label] : null
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <strong className="font-heading text-ink">{formatPercent(row.match_score)}%</strong>
      {label && <Badge variant={label.badge}>{label.text}</Badge>}
    </span>
  )
}

export function AnalysisTable({ rows }: { rows: AnalysisRow[] }) {
  const page = usePage(rows)
  return (
    <TablePanel
      title="Các lượt phân tích CV–JD"
      total={rows.length}
      unit="lượt"
      columns={5}
      empty="Không có lượt phân tích nào trong khoảng này."
      page={page}
      head={
        <tr>
          <th scope="col" className="px-6 py-3">Thời gian</th>
          <th scope="col" className="px-3 py-3">Vị trí</th>
          <th scope="col" className="px-3 py-3">CV</th>
          <th scope="col" className="px-3 py-3">Độ khớp</th>
          <th scope="col" className="px-6 py-3 text-right">Hành động</th>
        </tr>
      }
    >
      {page.rows.map((row) => (
        <tr key={row.id} className="hover:bg-surface/60">
          <td className="px-6 py-3.5 font-medium whitespace-nowrap text-ink">{formatWhen(row.created_at)}</td>
          <td className="min-w-44 px-3 py-3.5">
            <p className="font-medium text-ink">{row.jd.title}</p>
            {row.jd.company && <p className="text-xs text-ink-2">{row.jd.company}</p>}
          </td>
          <td className="max-w-56 px-3 py-3.5">
            <p className="font-medium text-ink">{row.cv_label}</p>
            <p className="truncate text-xs text-ink-2">{row.cv_file_name}</p>
          </td>
          <td className="px-3 py-3.5">
            <AnalysisStatusCell row={row} />
          </td>
          <td className="px-6 py-3.5 text-right">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue hover:bg-blue-soft hover:text-blue"
              nativeButton={false}
              render={<Link href={`/student/analysis/${encodeURIComponent(row.id)}`} />}
            >
              Xem phân tích
            </Button>
          </td>
        </tr>
      ))}
    </TablePanel>
  )
}
