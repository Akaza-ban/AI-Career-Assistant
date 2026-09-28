"use client"

import Link from "next/link"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  FileCheck2,
  HeartHandshake,
  LineChart,
  PieChart,
  Radar,
  Star,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { STATUS_META } from "@/components/advisor/student-status"
import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreLineChart } from "@/components/common/score-line-chart"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { features } from "@/lib/features"
import { STAR_KEYS, STAR_LABELS, STAR_LEVEL_STYLE, starLevel } from "@/lib/star"
import type { CohortProgress as Progress, CohortRange } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const RANGES: { value: CohortRange; label: string }[] = [
  { value: "30d", label: "30 ngày" },
  { value: "90d", label: "90 ngày" },
  { value: "term", label: "Học kỳ này" },
]

const ALL = "all"
const TARGET = { value: 75, label: "Mục tiêu" }

// Figma: frame "Theo dõi tiến bộ" (18:7149). PRD US-ADV-01, KPI "cải thiện điểm phỏng vấn trung bình".
export function CohortProgress() {
  const [range, setRange] = useState<CohortRange>("30d")
  const [cohort, setCohort] = useState(ALL)
  const [major, setMajor] = useState(ALL)
  const fetchProgress = useCallback(() => api.getCohortProgress({ range, cohort, major }), [range, cohort, major])
  const { data, error, reload } = useApi(fetchProgress)
  const { data: students } = useApi(api.listAssignedStudents)

  const cohorts = useMemo(() => [...new Set((students ?? []).map((s) => s.cohort))].sort(), [students])
  const majors = useMemo(() => [...new Set((students ?? []).map((s) => s.major))].sort(), [students])

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-xl gap-2">
          <h1 className="flex items-center gap-2 font-heading text-[28px] leading-9 font-bold">
            <TrendingUp className="size-7 text-blue" aria-hidden />
            Theo dõi tiến bộ
          </h1>
          <p className="text-sm text-ink-2">
            Mức tăng điểm phỏng vấn STAR, điểm ATS của CV và các tiêu chí cần hỗ trợ trên toàn nhóm sinh viên bạn phụ trách.
          </p>
        </div>
        <div className="grid justify-items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <FilterSelect
              label="Khoá"
              value={cohort}
              onChange={setCohort}
              items={[{ value: ALL, label: "Khoá: Tất cả" }, ...cohorts.map((c) => ({ value: c, label: `Khoá ${c}` }))]}
            />
            <FilterSelect
              label="Ngành"
              value={major}
              onChange={setMajor}
              items={[{ value: ALL, label: "Ngành: Tất cả" }, ...majors.map((m) => ({ value: m, label: m }))]}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div role="group" aria-label="Khoảng thời gian" className="flex rounded-xl bg-blue-soft/60 p-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={range === r.value}
                  onClick={() => setRange(r.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    range === r.value ? "bg-card text-blue shadow-card" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {features.progressPdf && (
              <Button variant="outline" className="h-9" onClick={() => toast.info("Đang tạo báo cáo…")}>
                <Download aria-hidden />
                Xuất báo cáo
              </Button>
            )}
          </div>
        </div>
      </header>

      {error ? (
        <Panel className="grid justify-items-center gap-3 py-12 text-center">
          <AlertCircle className="size-8 text-bad" aria-hidden />
          <p className="font-heading font-bold">Không tải được báo cáo tiến bộ</p>
          <p className="text-sm text-ink-2">{error.message}</p>
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
        </Panel>
      ) : !data ? (
        <ProgressSkeleton />
      ) : data.student_count === 0 ? (
        <Panel className="py-12 text-center text-sm text-ink-2">Không có sinh viên nào khớp bộ lọc.</Panel>
      ) : (
        <ProgressBody data={data} />
      )}
    </div>
  )
}

function ProgressBody({ data }: { data: Progress }) {
  const activePct = Math.round((data.active_count / data.student_count) * 100)
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sinh viên đang sử dụng" icon={Users} iconClass="bg-blue-soft text-blue">
          <p className="flex items-baseline gap-1">
            <span className="font-heading text-[32px] leading-9 font-bold">{data.active_count}</span>
            <span className="text-sm text-ink-2">/{data.student_count}</span>
            <span className="ml-1 text-sm font-semibold text-blue">({activePct}%)</span>
          </p>
          <div className="grid gap-1">
            <div className="relative h-2 rounded-full bg-surface">
              <div className="h-full rounded-full bg-blue" style={{ width: `${activePct}%` }} />
              <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `${data.active_target}%` }} aria-hidden />
            </div>
            <p className={cn("text-xs", activePct >= data.active_target ? "text-good" : "text-ink-2")}>
              Mục tiêu ≥ {data.active_target}% {activePct >= data.active_target && "· Đạt"}
            </p>
          </div>
        </Kpi>
        <Kpi label="Điểm phỏng vấn TB" icon={TrendingUp} iconClass="bg-good-soft text-good">
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-ink-2">{data.first_average ?? "—"}</span>
            <span className="text-ink-3" aria-hidden>→</span>
            <span className="font-heading text-[32px] leading-9 font-bold text-good">{data.latest_average ?? "—"}</span>
            <span className="text-sm text-ink-2">/100</span>
          </p>
          {data.first_average !== null && data.latest_average !== null && (
            <Badge variant="good" className="h-auto justify-self-start px-2 py-0.5">
              +{data.latest_average - data.first_average} điểm so với vòng đầu
            </Badge>
          )}
        </Kpi>
        <Kpi label="Độ hài lòng (CSAT)" icon={Star} iconClass="bg-violet-soft text-violet">
          <p className="flex items-baseline gap-1">
            <span className="font-heading text-[32px] leading-9 font-bold">{data.csat?.toFixed(1) ?? "—"}</span>
            <span className="text-sm text-ink-2">/ 5.0</span>
          </p>
          <p className={cn("text-xs", data.csat !== null && data.csat >= data.csat_target ? "text-good" : "text-ink-2")}>
            Mục tiêu ≥ {data.csat_target.toFixed(1)}
            {data.csat !== null && data.csat >= data.csat_target && " · Đạt"}
          </p>
        </Kpi>
        <Kpi label="Điểm ATS TB sau tối ưu" icon={FileCheck2} iconClass="bg-blue-soft text-blue">
          <p className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-ink-2">{data.ats_before ?? "—"}</span>
            <span className="text-ink-3" aria-hidden>→</span>
            <span className="font-heading text-[32px] leading-9 font-bold text-blue">{data.ats_after ?? "—"}</span>
          </p>
          {data.ats_before !== null && data.ats_after !== null && (
            <p className="text-xs font-medium text-good">+{data.ats_after - data.ats_before} điểm sau khi áp dụng gợi ý</p>
          )}
        </Kpi>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="grid gap-4">
          <PanelHeader
            icon={LineChart}
            title="Điểm phỏng vấn trung bình theo thời gian"
            aside={
              <span className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className="w-4 border-t border-dashed border-ink-3" aria-hidden />
                {TARGET.label} ({TARGET.value})
              </span>
            }
          />
          <ScoreLineChart points={data.weekly_scores} target={TARGET} unit="điểm TB" className="h-64" />
        </Panel>
        <StarCard data={data} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ByMajorCard data={data} />
        <DistributionCard data={data} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <TopImprovers data={data} />
        <NeedsSupport data={data} />
      </div>
    </>
  )
}

function Kpi({ label, icon: Icon, iconClass, children }: { label: string; icon: LucideIcon; iconClass: string; children: ReactNode }) {
  return (
    <Panel className="grid content-start gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{label}</p>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", iconClass)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      {children}
    </Panel>
  )
}

function StarCard({ data }: { data: Progress }) {
  const star = data.star_average
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={Radar} title="Tiêu chí STAR trung bình" />
      {!star ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-ink-2">Chưa có dữ liệu STAR.</p>
      ) : (
        <>
          <ul className="grid gap-3">
            {STAR_KEYS.map((key) => {
              const score = star[key]
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
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", level.badge)}>{level.label}</span>
                      <span className={cn("font-semibold", level.text)}>{score}%</span>
                    </span>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${score}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {data.star_weakest && (
            <div className="grid gap-1 rounded-xl border border-bad/20 bg-bad-soft/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-bad">
                <AlertTriangle className="size-4" aria-hidden />
                Điểm yếu chung: {STAR_LABELS[data.star_weakest.key].label}
              </p>
              <p className="text-xs leading-5 text-ink">{data.star_weakest.note}</p>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

const MAJOR_COLORS = ["bg-blue", "bg-violet", "bg-good", "bg-warn"]

function ByMajorCard({ data }: { data: Progress }) {
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={BarChart3} title="So sánh theo ngành" aside={<span className="text-xs text-ink-2">Điểm gần nhất trung bình</span>} />
      <ul className="grid gap-3">
        {data.by_major.map((m, i) => (
          <li key={m.major} className="grid gap-2 rounded-xl bg-surface p-4">
            <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-ink">
                <span className={cn("size-2.5 rounded-full", MAJOR_COLORS[i % MAJOR_COLORS.length])} aria-hidden />
                {m.major}
                <span className="text-xs font-normal text-ink-2">· {m.student_count} SV</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs font-semibold text-good">
                  {m.delta >= 0 ? "+" : ""}
                  {m.delta} điểm
                </span>
                <span className="font-heading font-bold text-ink">
                  {m.average}
                  <span className="text-xs font-normal text-ink-2">/100</span>
                </span>
              </span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-card">
              <div className={cn("h-full rounded-full", MAJOR_COLORS[i % MAJOR_COLORS.length])} style={{ width: `${m.average}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function DistributionCard({ data }: { data: Progress }) {
  const { high, stable, low, insufficient } = data.distribution
  const total = high + stable + low
  const groups = [
    { label: "Tiến bộ nhiều", note: "Tăng ≥ 15 điểm", count: high, bar: "bg-good", box: "bg-good-soft/60", text: "text-good" },
    { label: "Tiến bộ ổn định", note: "Tăng 5 – 14 điểm", count: stable, bar: "bg-blue", box: "bg-blue-soft/60", text: "text-blue" },
    { label: "Cần can thiệp", note: "Tăng < 5 điểm hoặc giảm", count: low, bar: "bg-bad", box: "bg-bad-soft/60", text: "text-bad" },
  ]
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={PieChart} title="Phân bố mức tiến bộ" aside={<span className="text-xs text-ink-2">{total} SV có ≥ 2 vòng</span>} />
      <div className="flex h-3 overflow-hidden rounded-full bg-surface" role="img" aria-label={groups.map((g) => `${g.label} ${g.count}`).join(", ")}>
        {groups.map((g) => (
          <div key={g.label} className={g.bar} style={{ width: total ? `${(g.count / total) * 100}%` : 0 }} />
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {groups.map((g) => (
          <li key={g.label} className={cn("grid gap-1 rounded-xl p-3", g.box)}>
            <p className={cn("flex items-center gap-1.5 text-sm font-semibold", g.text)}>
              <span className={cn("size-2 rounded-full", g.bar)} aria-hidden />
              {g.label}
            </p>
            <p className="text-sm text-ink">
              <strong className="font-heading text-xl">{g.count}</strong> SV ({total ? Math.round((g.count / total) * 100) : 0}%)
            </p>
            <p className="text-xs text-ink-2">{g.note}</p>
          </li>
        ))}
      </ul>
      {insufficient > 0 && (
        <p className="text-xs text-ink-2">{insufficient} sinh viên chưa đủ 2 vòng hoặc chưa chia sẻ dữ liệu nên chưa được xếp nhóm.</p>
      )}
    </Panel>
  )
}

function TopImprovers({ data }: { data: Progress }) {
  return (
    <Panel className="grid gap-4 p-0">
      <div className="px-6 pt-6">
        <PanelHeader icon={Award} title="Top sinh viên tiến bộ nhiều nhất" aside={<span className="text-xs text-ink-2">Vòng đầu → gần nhất</span>} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase">
            <tr>
              <th scope="col" className="px-6 py-2.5">Sinh viên</th>
              <th scope="col" className="px-3 py-2.5">Ngành</th>
              <th scope="col" className="px-3 py-2.5">Điểm</th>
              <th scope="col" className="px-6 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.top_improvers.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-3">
                  <span className="flex items-center gap-2.5">
                    <UserAvatar name={s.full_name} src={s.avatar_url} className="size-8" />
                    <span className="grid">
                      <span className="font-medium text-ink">{s.full_name}</span>
                      <span className="text-xs text-ink-2">{s.student_code}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3 py-3 text-ink-2">{s.subtitle.split(" - ")[0]}</td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-ink-2">
                      {s.first_score} → <strong className="text-ink">{s.latest_score}</strong>
                    </span>
                    <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-xs font-semibold text-good">+{s.score_delta}</span>
                  </span>
                </td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <Link href={`/advisor/students/${encodeURIComponent(s.id)}`} className="text-sm font-medium text-blue hover:underline">
                    Xem hồ sơ
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

const SUPPORT_META: Record<Progress["needs_support"][number]["kind"], { label: string; className: string; action: "profile" | "email" }> = {
  flagged: { label: STATUS_META.flagged.label, className: STATUS_META.flagged.className, action: "profile" },
  low_score: { label: "Điểm thấp", className: "bg-warn-soft text-warn", action: "profile" },
  inactive: { label: "Ít tương tác", className: "bg-violet-soft text-violet", action: "email" },
  not_shared: { label: "Chưa chia sẻ", className: STATUS_META.not_shared.className, action: "email" },
}

function NeedsSupport({ data }: { data: Progress }) {
  return (
    <Panel className="grid gap-4 p-0">
      <div className="px-6 pt-6">
        <PanelHeader
          icon={HeartHandshake}
          title="Sinh viên cần hỗ trợ thêm"
          aside={
            <Badge variant="bad" className="h-auto px-2 py-0.5">
              {data.needs_support.length} sinh viên
            </Badge>
          }
        />
      </div>
      {data.needs_support.length === 0 ? (
        <p className="mx-6 mb-6 flex items-center gap-2 rounded-xl bg-good-soft/60 p-4 text-sm text-good">
          <CheckCircle2 className="size-4" aria-hidden />
          Không có sinh viên nào cần hỗ trợ thêm.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-sm">
            <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase">
              <tr>
                <th scope="col" className="px-6 py-2.5">Sinh viên</th>
                <th scope="col" className="px-3 py-2.5">Vấn đề</th>
                <th scope="col" className="px-6 py-2.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.needs_support.map(({ student: s, issue, kind }) => {
                const meta = SUPPORT_META[kind]
                return (
                  <tr key={s.id}>
                    <td className="px-6 py-3">
                      <span className="grid">
                        <span className="font-medium text-ink">{s.full_name}</span>
                        <span className="text-xs text-ink-2">{s.subtitle}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="grid justify-items-start gap-1">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", meta.className)}>{meta.label}</span>
                        <span className="text-xs text-ink-2">{issue}</span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      {meta.action === "profile" ? (
                        <Link href={`/advisor/students/${encodeURIComponent(s.id)}`} className="text-sm font-medium text-blue hover:underline">
                          Xem hồ sơ
                        </Link>
                      ) : (
                        <a href={`mailto:${s.email}`} className="text-sm font-medium text-blue hover:underline">
                          Gửi email
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger className="h-9 min-w-44 border-transparent bg-card shadow-card" aria-label={label}>
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

function ProgressSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải báo cáo">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Skeleton className="h-80 rounded-[20px]" />
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    </div>
  )
}
