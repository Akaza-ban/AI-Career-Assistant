"use client"

import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Check,
  FileSearch,
  FileText,
  Hourglass,
  Loader2,
  MessagesSquare,
  Mic,
  PauseCircle,
  PlayCircle,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react"

import { Panel, PanelHeader, SectionHeader } from "@/components/common/panel"
import { IMPORTANCE_META } from "@/components/student/analysis/jd-picker-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ANALYSIS_STEPS, MATCH_LABEL_META, formatPercent } from "@/lib/analysis"
import { formatDate, formatRelativeTime } from "@/lib/format"
import {
  LABEL_META,
  QUESTION_COUNT,
  SECONDS_PER_QUESTION,
  STAR_META,
  STAR_ORDER,
  TREND_THRESHOLD,
  formatScore,
  mmss,
  trendOf,
} from "@/lib/interview"
import type { AnalysisRow, InterviewRow, NextStep, SessionScore, StudentOverview } from "@/lib/types"
import { cn } from "@/lib/utils"

const signed = (n: number) => `${n > 0 ? "+" : ""}${formatScore(n)}`

// ---------- Lời chào ----------

function greeting(now: Date): string {
  const hour = now.getHours()
  if (hour < 11) return "Chào buổi sáng"
  if (hour < 14) return "Chào buổi trưa"
  if (hour < 18) return "Chào buổi chiều"
  return "Chào buổi tối"
}

/** Tên gọi = từ cuối và từ áp cuối của họ tên ("Nguyễn Minh Anh" → "Minh Anh"). */
function callName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.slice(-2).join(" ")
}

/** SV mới: chưa có CV, chưa phân tích, chưa phỏng vấn. */
export function isNewStudent(overview: StudentOverview): boolean {
  return overview.cv_count === 0 && overview.recent_analyses.length === 0 && overview.interview_count === 0
}

const DAY_MS = 24 * 60 * 60 * 1000
const INACTIVE_DAYS = 7
const SESSION_MINUTES = (QUESTION_COUNT * SECONDS_PER_QUESTION) / 60

/**
 * Câu động viên dưới lời chào, chọn theo hoạt động thật của SV (xét từ trên xuống, gặp trường hợp nào dùng câu đó).
 * Chỉ nói xu hướng, không lặp lại con số đã có ở 4 thẻ số liệu.
 */
function encouragement(overview: StudentOverview, now: Date): string {
  const { interview_count, interview_week_count, latest_interview: latest, in_progress } = overview
  if (isNewStudent(overview)) return "Chào mừng bạn đến với CareerX. Bắt đầu từ bước đầu tiên bên dưới nhé."

  const activity = [
    overview.cv_latest_at,
    overview.latest_match?.completed_at,
    latest?.completed_at,
    ...overview.recent_analyses.map((a) => a.created_at),
  ].flatMap((iso) => (iso ? [new Date(iso).getTime()] : []))
  const busy = in_progress.interview !== null || in_progress.analyses.length > 0
  const idleDays = activity.length > 0 ? Math.floor((now.getTime() - Math.max(...activity)) / DAY_MS) : 0
  if (!busy && idleDays >= INACTIVE_DAYS) {
    return `Đã ${idleDays} ngày bạn chưa quay lại. Bắt nhịp lại với bước tiếp theo bên dưới nhé.`
  }

  if (interview_count === 0) {
    return "Bạn đã bắt đầu rồi. Hoàn thành từng bước bên dưới để sẵn sàng cho buổi phỏng vấn thử đầu tiên."
  }
  if (interview_week_count > 0) {
    // Cùng ngưỡng với nhãn "Cải thiện rõ rệt" ở thẻ Điểm STAR gần nhất.
    return latest?.delta != null && latest.delta >= TREND_THRESHOLD
      ? "Điểm STAR của bạn đang đi lên. Giữ nhịp luyện đều mỗi tuần nhé."
      : "Mỗi buổi luyện là một lần trả lời rõ ràng hơn. Tiếp tục nhé."
  }
  return `Một buổi phỏng vấn thử khoảng ${SESSION_MINUTES} phút là đủ để giữ nhịp tuần này.`
}

// Đặt thẳng trên nền trang, có khoảng thở rộng.
export function GreetingBanner({ fullName, overview }: { fullName: string; overview: StudentOverview }) {
  const now = new Date()
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-6">
      <div className="grid gap-1.5">
        <h1 className="font-heading text-[32px] leading-10 font-bold">
          {greeting(now)}, {callName(fullName)}!
        </h1>
        <p className="flex items-start gap-2 text-base text-ink-2">
          <Sparkles className="mt-1 size-4 shrink-0 text-gold" aria-hidden />
          {encouragement(overview, now)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" className="h-10 px-4" nativeButton={false} render={<Link href="/student/analysis/new" />}>
          <ScanText aria-hidden />
          Phân tích CV với JD
        </Button>
        <Button variant="violet" className="h-10 px-4" nativeButton={false} render={<Link href="/student/interview/new" />}>
          <Mic aria-hidden />
          Luyện phỏng vấn
        </Button>
      </div>
    </div>
  )
}

// ---------- Việc đang dở ----------

/** Đếm ngược tại chỗ từ số giây backend trả về lúc tải trang. */
function useCountdown(initial: number | null, running: boolean): number | null {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (!running || initial === null) return
    const endsAt = Date.now() + initial * 1000
    const timer = setInterval(() => setLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000))), 1000)
    return () => clearInterval(timer)
  }, [initial, running])
  return left
}

function InterviewInProgress({ interview }: { interview: NonNullable<StudentOverview["in_progress"]["interview"]> }) {
  const left = useCountdown(interview.seconds_left, !interview.paused)
  const status = interview.paused ? (
    <span className="flex items-center gap-1 text-violet">
      <PauseCircle className="size-3.5" aria-hidden />
      Đang tạm dừng
    </span>
  ) : left === 0 ? (
    <span className="font-medium text-bad">Câu hiện tại đã hết giờ, hãy quay lại ngay để không bị huỷ buổi</span>
  ) : left !== null ? (
    <span>
      Còn <strong className="font-heading text-ink tabular-nums">{mmss(left)}</strong> cho câu hiện tại
    </span>
  ) : null

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-violet-soft/50 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
        <Mic className="size-5" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm font-semibold text-ink">
          Phỏng vấn thử: {interview.jd.title} · Câu {interview.current_index}/{interview.question_count}
        </p>
        <p className="text-xs text-ink-2">{status}</p>
      </div>
      <Button
        variant="violet"
        className="h-9 px-4"
        nativeButton={false}
        render={<Link href={`/student/interview/${encodeURIComponent(interview.id)}`} />}
      >
        <PlayCircle aria-hidden />
        Quay lại phòng
      </Button>
    </li>
  )
}

function AnalysisInProgress({ analysis }: { analysis: AnalysisRow }) {
  const index = ANALYSIS_STEPS.findIndex((s) => s.key === analysis.current_step)
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-blue-soft/50 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-soft text-blue">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-sm font-semibold text-ink">
          Đang phân tích CV {analysis.cv_label} với {analysis.jd.title}
        </p>
        <p className="text-xs text-ink-2">
          {index >= 0 ? `Bước ${index + 1}/${ANALYSIS_STEPS.length}: ${ANALYSIS_STEPS[index].title}` : "Đang chuẩn bị"}
        </p>
      </div>
      <Button
        variant="soft"
        className="h-9 px-4"
        nativeButton={false}
        render={<Link href={`/student/analysis/${encodeURIComponent(analysis.id)}`} />}
      >
        Xem tiến độ
      </Button>
    </li>
  )
}

export function InProgressPanel({ inProgress }: { inProgress: StudentOverview["in_progress"] }) {
  if (!inProgress.interview && inProgress.analyses.length === 0) return null
  return (
    <Panel className="grid gap-3 p-5">
      <PanelHeader icon={Hourglass} title="Đang dở" />
      <ul className="grid gap-2">
        {inProgress.interview && <InterviewInProgress interview={inProgress.interview} />}
        {inProgress.analyses.map((a) => (
          <AnalysisInProgress key={a.id} analysis={a} />
        ))}
      </ul>
    </Panel>
  )
}

// ---------- 4 thẻ số liệu ----------

interface StatCardProps {
  label: string
  icon: LucideIcon
  iconClass?: string
  value: ReactNode
  unit: ReactNode
  aside?: ReactNode
  footer: ReactNode
}

function StatCard({ label, icon: Icon, iconClass = "bg-blue-soft text-blue", value, unit, aside, footer }: StatCardProps) {
  return (
    <Panel className="flex flex-col justify-between gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", iconClass)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="font-heading text-[32px] leading-9 font-bold tracking-[-0.025em] text-ink">{value}</span>
          <span className="text-[13px] text-ink-2">{unit}</span>
        </p>
        {aside}
      </div>
      <div className="min-h-4 text-xs text-ink-2">{footer}</div>
    </Panel>
  )
}

/** Đường điểm các buổi gần nhất của cùng vị trí (thang 0–5). */
function Sparkline({ points }: { points: SessionScore[] }) {
  if (points.length < 2) return null
  const w = 84
  const h = 30
  const values = points.map((p) => p.score)
  const min = Math.min(...values)
  const range = Math.max(Math.max(...values) - min, 1)
  const coords = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, h - 4 - ((v - min) / range) * (h - 8)])
  const [lastX, lastY] = coords[coords.length - 1]
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`Điểm ${points.length} buổi gần nhất: ${values.map(formatScore).join(", ")}`}
    >
      <polyline
        points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--violet)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--violet)" />
    </svg>
  )
}

export function StatCards({ overview }: { overview: StudentOverview }) {
  const { cv_count, cv_latest_at, interview_count, interview_week_count, latest_match: match, latest_interview: latest } = overview
  const matchLabel = match?.label ? MATCH_LABEL_META[match.label] : null
  const trend = latest?.delta !== null && latest?.delta !== undefined ? trendOf(latest.delta) : null

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Phiên bản CV"
        icon={FileText}
        value={cv_count}
        unit="phiên bản"
        footer={cv_latest_at ? `Bản mới nhất: ${formatRelativeTime(cv_latest_at).toLowerCase()}` : "Chưa tải CV nào"}
      />
      <StatCard
        label="Độ khớp JD gần nhất"
        icon={FileSearch}
        value={match?.score != null ? `${formatPercent(match.score)}%` : "—"}
        unit={matchLabel ? <Badge variant={matchLabel.badge}>{matchLabel.text}</Badge> : "chưa phân tích"}
        footer={match && <span className="line-clamp-1">{`${match.jd.title} · CV ${match.cv_label}`}</span>}
      />
      <StatCard
        label="Phỏng vấn đã hoàn thành"
        icon={MessagesSquare}
        iconClass="bg-violet-soft text-violet"
        value={interview_count}
        unit="buổi"
        footer={interview_count > 0 ? `${interview_week_count} buổi trong tuần này` : "Chưa có buổi nào"}
      />
      <StatCard
        label="Điểm STAR gần nhất"
        icon={Award}
        iconClass="bg-violet-soft text-violet"
        value={latest ? formatScore(latest.score) : "—"}
        unit={
          latest ? (
            <span className="flex items-center gap-1.5">
              /5
              <Badge variant="neutral" className={LABEL_META[latest.label].badge}>
                {LABEL_META[latest.label].text}
              </Badge>
            </span>
          ) : (
            "chưa có"
          )
        }
        aside={latest && <Sparkline points={latest.trend} />}
        footer={
          latest &&
          (trend && latest.delta !== null ? (
            <span className="line-clamp-2">
              <strong className={trend.className}>{signed(latest.delta)}</strong> so với buổi đầu ·{" "}
              <span className={trend.className}>{trend.text}</span>
            </span>
          ) : (
            <span className="line-clamp-1">Buổi đầu tiên cho vị trí {latest.jd.title}</span>
          ))
        }
      />
    </div>
  )
}

// ---------- Bước tiếp theo ----------

const JOURNEY: { kind: NextStep["kind"]; label: string }[] = [
  { kind: "upload_cv", label: "Tải CV" },
  { kind: "analyze", label: "Phân tích CV–JD" },
  { kind: "interview", label: "Luyện phỏng vấn" },
  { kind: "improve", label: "Cải thiện điểm STAR" },
]

function Journey({ current }: { current: NextStep["kind"] }) {
  const index = JOURNEY.findIndex((s) => s.kind === current)
  return (
    <ol className="relative flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs" aria-label="Lộ trình chuẩn bị">
      {JOURNEY.map((step, i) => (
        <li key={step.kind} className="flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
              i < index && "bg-good-soft text-good",
              i === index && "bg-blue text-white",
              i > index && "bg-surface text-ink-3",
            )}
            aria-current={i === index ? "step" : undefined}
          >
            {i < index ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}
            {step.label}
          </span>
          {i < JOURNEY.length - 1 && <ArrowRight className="size-3 text-ink-3" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}

function QuotaNote({ remaining, resetsAt }: { remaining: number; resetsAt: string }) {
  return remaining > 0 ? (
    <p className="text-xs text-ink-2">Tuần này còn {remaining} buổi có chấm điểm cho vị trí này.</p>
  ) : (
    <p className="text-xs font-medium text-warn">
      Bạn đã dùng hết lượt luyện vị trí này trong tuần. Lượt mới mở lại ngày {formatDate(resetsAt)}.
    </p>
  )
}

function stepContent(step: NextStep): { title: string; body: ReactNode; cta: { href: string; label: string; icon: LucideIcon }; disabled?: boolean; extra?: ReactNode } {
  switch (step.kind) {
    case "upload_cv":
      return {
        title: "Tải CV đầu tiên của bạn",
        body: "Hệ thống cần CV (PDF hoặc DOCX, tối đa 5MB) để đối chiếu với vị trí bạn muốn ứng tuyển và gợi ý cách trình bày rõ hơn.",
        cta: { href: "/student/cv", label: "Tải CV lên", icon: Upload },
      }
    case "analyze":
      return {
        title: `Phân tích CV ${step.cv_label} với một JD`,
        body: "Chọn một JD trong thư viện hoặc dán JD bạn quan tâm để xem độ khớp, kỹ năng đã có bằng chứng và kỹ năng còn thiếu.",
        cta: { href: `/student/analysis/new?cv=${encodeURIComponent(step.cv_version_id)}`, label: "Bắt đầu phân tích", icon: ScanText },
      }
    case "interview":
      return {
        title: `Luyện phỏng vấn cho vị trí ${step.jd.title}`,
        body: (
          <>
            {step.match_score !== null && `CV của bạn khớp ${formatPercent(step.match_score)}% với vị trí này. `}
            Trả lời 4 câu hỏi tình huống theo khung STAR, mỗi câu 5 phút, để chuẩn bị cho vòng phỏng vấn.
          </>
        ),
        cta: { href: `/student/interview/new?jd=${encodeURIComponent(step.jd.id)}`, label: "Vào phòng phỏng vấn", icon: PlayCircle },
        disabled: step.quota_remaining === 0,
        extra: <QuotaNote remaining={step.quota_remaining} resetsAt={step.quota_resets_at} />,
      }
    case "improve": {
      const meta = STAR_META[step.criterion]
      return {
        title: `Cải thiện tiêu chí ${meta.label} (${formatScore(step.criterion_score)}/5)`,
        body: (
          <>
            Đây là tiêu chí thấp nhất ở buổi gần nhất cho vị trí {step.jd.title}. {step.guidance}
          </>
        ),
        cta: { href: `/student/interview/new?jd=${encodeURIComponent(step.jd.id)}`, label: "Luyện lại vị trí này", icon: PlayCircle },
        disabled: step.quota_remaining === 0,
        extra: (
          <div className="grid gap-1">
            <QuotaNote remaining={step.quota_remaining} resetsAt={step.quota_resets_at} />
            <Link
              href={`/student/interview/${encodeURIComponent(step.session_id)}/report`}
              className="inline-flex items-center gap-1 justify-self-start text-xs font-medium text-blue hover:underline"
            >
              Xem báo cáo buổi gần nhất
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        ),
      }
    }
  }
}

export function NextStepCard({ step, className }: { step: NextStep; className?: string }) {
  const { title, body, cta, disabled, extra } = stepContent(step)
  const CtaIcon = cta.icon
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionHeader title="Bước tiếp theo nên làm" />
      <Panel className="relative flex flex-1 flex-col gap-4 overflow-hidden bg-gradient-to-br from-card to-blue-soft/40">
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-blue/5" />
        <Journey current={step.kind} />
        <div className="relative grid gap-1.5">
          <h3 className="font-heading text-xl font-bold">{title}</h3>
          <p className="text-sm leading-6 text-ink-2">{body}</p>
        </div>
        <div className="relative mt-auto flex flex-wrap items-end justify-between gap-3">
          {extra ?? <span />}
          {disabled ? (
            <Button size="brand" disabled>
              <CtaIcon aria-hidden />
              {cta.label}
            </Button>
          ) : (
            <Button size="brand" nativeButton={false} render={<Link href={cta.href} />}>
              <CtaIcon aria-hidden />
              {cta.label}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </Panel>
    </section>
  )
}

// ---------- Kỹ năng nên học thêm ----------

export function SkillsCard({ skills, className }: { skills: StudentOverview["skills_to_learn"]; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionHeader
        title="Kỹ năng nên học thêm"
        aside={
          skills && (
            <Link
              href={`/student/analysis/${encodeURIComponent(skills.analysis_id)}`}
              className="shrink-0 text-sm font-medium text-blue hover:underline"
            >
              Xem phân tích
            </Link>
          )
        }
      />
      <Panel className="grid flex-1 grid-cols-1 content-start gap-4">
        {!skills ? (
          <EmptyNote icon={BookOpen} title="Chưa có dữ liệu" text="Phân tích CV với một JD để biết kỹ năng nào vị trí đó cần mà CV chưa thể hiện." />
        ) : skills.skills.length === 0 ? (
          <EmptyNote
            icon={Check}
            title="Không thiếu kỹ năng nào"
            text={`CV đã có bằng chứng cho mọi yêu cầu của vị trí ${skills.jd.title}.`}
          />
        ) : (
          <>
            <p className="text-xs text-ink-2">Từ lần phân tích gần nhất với {skills.jd.title}.</p>
            <ul className="flex flex-wrap gap-2">
              {skills.skills.map((skill) => (
                <li
                  key={skill.name}
                  className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium text-ink"
                >
                  {skill.name}
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", IMPORTANCE_META[skill.importance].chip)}>
                    {IMPORTANCE_META[skill.importance].label}
                  </span>
                </li>
              ))}
            </ul>
            {skills.total_missing > skills.skills.length && (
              <p className="text-xs text-ink-2">và {skills.total_missing - skills.skills.length} kỹ năng khác trong báo cáo phân tích.</p>
            )}
            <p className="flex items-start gap-1.5 border-t border-line pt-3 text-xs text-ink-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
              Chỉ đưa kỹ năng vào CV khi bạn đã thực sự học và có kinh nghiệm dùng nó.
            </p>
          </>
        )}
      </Panel>
    </section>
  )
}

function EmptyNote({ icon: Icon, title, text, className }: { icon: LucideIcon; title: string; text: string; className?: string }) {
  return (
    <div className={cn("grid content-center justify-items-center gap-2 rounded-xl bg-surface px-6 py-8 text-center", className)}>
      <Icon className="size-6 text-ink-3" aria-hidden />
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-sm text-xs text-ink-2">{text}</p>
    </div>
  )
}

// ---------- Hoạt động gần đây ----------

function AnalysisStatus({ row }: { row: AnalysisRow }) {
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
    <span className="flex items-center gap-2">
      <strong className="font-heading text-ink">{formatPercent(row.match_score)}%</strong>
      {label && <Badge variant={label.badge}>{label.text}</Badge>}
    </span>
  )
}

// Tiêu đề và "Xem tất cả" nằm ngoài ô; trong ô là danh sách kẻ dòng, không lồng thêm ô cho từng mục.
function RecentList({ title, empty, children }: { title: string; empty: ReactNode; children: ReactNode[] }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        title={title}
        aside={
          children.length > 0 && (
            <Link href="/student/history" className="shrink-0 text-sm font-medium text-blue hover:underline">
              Xem tất cả
            </Link>
          )
        }
      />
      <Panel className="flex-1 overflow-hidden p-0">
        {children.length === 0 ? empty : <ul className="divide-y divide-line">{children}</ul>}
      </Panel>
    </section>
  )
}

function RecentItem({ href, title, meta, aside }: { href: string; title: string; meta: ReactNode; aside: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="line-clamp-2 text-sm font-semibold break-words text-ink">{title}</p>
          <p className="text-xs text-ink-2">{meta}</p>
        </div>
        <span className="shrink-0">{aside}</span>
      </Link>
    </li>
  )
}

export function RecentAnalyses({ items }: { items: AnalysisRow[] }) {
  return (
    <RecentList
      title="Phân tích gần đây"
      empty={
        <EmptyNote
          icon={FileSearch}
          title="Chưa có lượt phân tích"
          text="Các lượt đối chiếu CV với JD sẽ hiện ở đây."
          className="h-full bg-transparent"
        />
      }
    >
      {items.map((row) => (
        <RecentItem
          key={row.id}
          href={`/student/analysis/${encodeURIComponent(row.id)}`}
          title={row.jd.title}
          meta={`CV ${row.cv_label} · ${formatRelativeTime(row.created_at)}`}
          aside={<AnalysisStatus row={row} />}
        />
      ))}
    </RecentList>
  )
}

export function RecentInterviews({ items }: { items: InterviewRow[] }) {
  return (
    <RecentList
      title="Phỏng vấn gần đây"
      empty={
        <EmptyNote
          icon={MessagesSquare}
          title="Chưa có buổi phỏng vấn"
          text="Báo cáo các buổi phỏng vấn thử sẽ hiện ở đây."
          className="h-full bg-transparent"
        />
      }
    >
      {items.map((row) => {
        const label = LABEL_META[row.label]
        return (
          <RecentItem
            key={row.id}
            href={`/student/interview/${encodeURIComponent(row.id)}/report`}
            title={row.jd.title}
            meta={
              <>
                {formatRelativeTime(row.completed_at)}
                {row.timed_out_count > 0 && ` · ${row.timed_out_count} câu hết giờ`}
              </>
            }
            aside={
              <span className="flex items-center gap-2">
                <strong className={cn("font-heading", label.className)}>{formatScore(row.overall_score)}/5</strong>
                <Badge variant="neutral" className={label.badge}>
                  {label.text}
                </Badge>
              </span>
            }
          />
        )
      })}
    </RecentList>
  )
}

// ---------- Trung bình STAR ----------

export function StarAverageCard({ star, className }: { star: StudentOverview["star"]; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionHeader title="Điểm trung bình STAR" />
      <Panel className="grid flex-1 grid-cols-1 content-start gap-4 p-5">
        {!star ? (
          <EmptyNote
            icon={BarChart3}
            title="Chưa có dữ liệu STAR"
            text="Hoàn thành buổi phỏng vấn thử đầu tiên để xem điểm từng tiêu chí."
            className="h-full bg-transparent"
          />
        ) : (
          <>
            <p className="text-xs text-ink-2">Trung bình {star.session_count} buổi gần nhất, thang 0–5</p>
            <ul className="grid gap-3.5">
              {STAR_ORDER.map((key) => {
                const score = star.average[key]
                const weakest = key === star.weakest
                return (
                  <li key={key} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium text-ink">
                        <span className="grid size-6 place-items-center rounded-md bg-blue-soft text-xs font-bold text-blue">
                          {STAR_META[key].letter}
                        </span>
                        {STAR_META[key].label}
                        {weakest && <Badge variant="warn">Yếu nhất</Badge>}
                      </span>
                      <span className="font-heading font-bold text-ink">{formatScore(score)}/5</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-surface"
                      role="progressbar"
                      aria-label={STAR_META[key].label}
                      aria-valuenow={score}
                      aria-valuemin={0}
                      aria-valuemax={5}
                    >
                      <div className={cn("h-full rounded-full", weakest ? "bg-warn" : "bg-blue")} style={{ width: `${(score / 5) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Panel>
    </section>
  )
}
