import Link from "next/link"
import {
  ArrowRight,
  Award,
  BarChart3,
  Clock,
  FileSearch,
  FileText,
  Flag,
  Flame,
  HeartHandshake,
  History,
  Info,
  Lightbulb,
  MessageSquareText,
  MessagesSquare,
  Mic,
  PlayCircle,
  ScanText,
  Sparkles,
  TrendingUp,
  Upload,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { Panel, PanelHeader } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { features } from "@/lib/features"
import { formatRelativeTime } from "@/lib/format"
import { STAR_KEYS, STAR_LABELS, STAR_LEVEL_STYLE, starAverage, starLevel } from "@/lib/star"
import type { ActivityItem, StudentOverview } from "@/lib/types"
import { cn } from "@/lib/utils"

// ---------- Banner chào + mục tiêu ----------

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

export function GreetingBanner({ fullName, overview }: { fullName: string; overview: StudentOverview }) {
  const { target, current_match_score: match } = overview
  return (
    <Panel className="relative overflow-hidden p-8">
      {/* Vệt màu trang trí góc phải (Figma: Gradient+Blur) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full bg-gradient-to-bl from-violet-soft via-blue-soft/60 to-transparent blur-3xl"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-[28px] leading-9 font-bold">
            {greeting(new Date())}, {callName(fullName)}!
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-ink-2">
            <Flag className="size-3.5 shrink-0 text-blue" aria-hidden />
            {target ? (
              <span>
                Mục tiêu hiện tại: <span className="text-ink">Ứng tuyển vị trí {target.title}</span>
                {target.company && ` tại ${target.company}`}
              </span>
            ) : (
              <span>
                Bạn chưa chọn vị trí mục tiêu.{" "}
                <Link href="/student/analysis/new" className="font-medium text-blue hover:underline">
                  Chọn JD để bắt đầu
                </Link>
              </span>
            )}
          </p>
        </div>
        {match !== null && (
          <div className="flex items-center gap-2 rounded-full bg-blue-soft/70 px-4 py-2.5 text-xs font-medium backdrop-blur-sm">
            <span className="relative grid size-4 place-items-center" aria-hidden>
              <span className="absolute inset-0 rounded-full bg-good/20" />
              <span className="size-2.5 rounded-full bg-good" />
            </span>
            <span className="text-ink-2">Trạng thái CV:</span>
            <span className="font-semibold text-good">Đã khớp {match}% với JD mục tiêu</span>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ---------- 3 thẻ số liệu ----------

interface StatCardProps {
  label: string
  icon: LucideIcon
  value: ReactNode
  unit: string
  chip?: ReactNode
}

function StatCard({ label, icon: Icon, value, unit, chip }: StatCardProps) {
  return (
    <Panel className="flex flex-col justify-between gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue">
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="flex items-baseline gap-1">
          <span className="font-heading text-[32px] leading-9 font-bold tracking-[-0.025em] text-ink">{value}</span>
          <span className="text-[13px] text-ink-2">{unit}</span>
        </p>
        {chip}
      </div>
    </Panel>
  )
}

function Chip({ icon: Icon, tone, children }: { icon: LucideIcon; tone: "blue" | "violet" | "good"; children: ReactNode }) {
  return (
    <Badge variant={tone} className="h-auto gap-1 px-2 py-0.5">
      <Icon aria-hidden />
      {children}
    </Badge>
  )
}

export function StatCards({ overview }: { overview: StudentOverview }) {
  const { cv_version_count, cv_latest_at, interview_count, streak_days, latest_score, score_delta } = overview
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="CV đã tối ưu"
        icon={FileText}
        value={cv_version_count}
        unit="phiên bản"
        chip={
          cv_latest_at && (
            <Chip icon={Upload} tone="blue">
              Bản mới nhất: {formatRelativeTime(cv_latest_at).toLowerCase()}
            </Chip>
          )
        }
      />
      <StatCard
        label="Buổi phỏng vấn đã hoàn thành"
        icon={MessagesSquare}
        value={interview_count}
        unit="buổi"
        chip={
          streak_days > 1 && (
            <Chip icon={Flame} tone="violet">
              Chuỗi {streak_days} ngày
            </Chip>
          )
        }
      />
      <StatCard
        label="Điểm phỏng vấn gần nhất"
        icon={Award}
        value={latest_score ?? "—"}
        unit={latest_score !== null ? "/100 (STAR)" : "chưa có"}
        chip={
          score_delta !== null && (
            <Chip icon={TrendingUp} tone={score_delta >= 0 ? "good" : "violet"}>
              {score_delta >= 0 ? "+" : ""}
              {score_delta} điểm so với đầu
            </Chip>
          )
        }
      />
    </div>
  )
}

// ---------- 2 thẻ hành động chính ----------

interface ActionCardProps {
  tone: "blue" | "violet"
  icon: LucideIcon
  tag: { icon?: LucideIcon; label: string }
  title: string
  description: string
  cta: { href: string; label: string; icon?: LucideIcon }
  note: { icon: LucideIcon; text: string }
}

function ActionCard({ tone, icon: Icon, tag, title, description, cta, note }: ActionCardProps) {
  const isBlue = tone === "blue"
  const TagIcon = tag.icon
  const CtaIcon = cta.icon
  const NoteIcon = note.icon
  return (
    <Panel
      className={cn(
        "relative flex flex-col justify-between gap-6 overflow-hidden",
        !isBlue && "bg-gradient-to-b from-card to-blue-soft/30",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-12 -right-12 size-48 rounded-full",
          isBlue ? "bg-blue/5" : "bg-violet/10",
        )}
      />
      <div className="relative grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cn(
              "grid size-12 place-items-center rounded-xl",
              isBlue ? "bg-blue-soft text-blue" : "bg-violet-soft text-violet",
            )}
          >
            <Icon className="size-6" aria-hidden />
          </span>
          <Badge variant={tone} className="h-auto px-2.5 py-1">
            {TagIcon && <TagIcon aria-hidden />}
            {tag.label}
          </Badge>
        </div>
        <div className="grid gap-1.5">
          <h2 className="font-heading text-xl font-bold">{title}</h2>
          <p className="text-sm leading-[22px] text-ink-2">{description}</p>
        </div>
      </div>
      <div className="relative grid gap-2">
        <Button
          variant={isBlue ? "default" : "violet"}
          size="brand"
          className="w-full"
          nativeButton={false}
          render={<Link href={cta.href} />}
        >
          {CtaIcon && <CtaIcon aria-hidden />}
          {cta.label}
          <ArrowRight aria-hidden />
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-2">
          <NoteIcon className="size-3.5 shrink-0" aria-hidden />
          {note.text}
        </p>
      </div>
    </Panel>
  )
}

export function ActionCards({ overview }: { overview: StudentOverview }) {
  const target = overview.target?.title
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ActionCard
        tone="blue"
        icon={ScanText}
        tag={{ label: "Đối chiếu CV với JD" }}
        title="Tối ưu hoá CV với JD mới"
        description="Tải lên CV và dán mô tả công việc (JD) để AI phân tích khoảng cách kỹ năng, chuẩn hoá từ khoá theo tiêu chí lọc hồ sơ ATS."
        cta={{ href: "/student/analysis/new", label: "Bắt đầu phân tích CV" }}
        note={{ icon: Info, text: "Khuyến nghị: định dạng PDF hoặc DOCX, dung lượng dưới 10MB" }}
      />
      <ActionCard
        tone="violet"
        icon={Mic}
        tag={{ icon: Sparkles, label: "Phòng giả lập STAR" }}
        title="Luyện phỏng vấn mô phỏng AI (STAR)"
        description={
          target
            ? `Thực hành trả lời các câu hỏi tình huống cho vị trí ${target} với AI Coach, nhận chấm điểm chi tiết và gợi ý tái cấu trúc câu trả lời.`
            : "Thực hành trả lời các câu hỏi tình huống theo vị trí bạn chọn với AI Coach, nhận chấm điểm chi tiết và gợi ý tái cấu trúc câu trả lời."
        }
        cta={{ href: "/student/interview/new", label: "Vào phòng phỏng vấn thử", icon: PlayCircle }}
        note={{ icon: Clock, text: "Thời gian ước tính: 15–20 phút · AI phản hồi ngay sau mỗi câu" }}
      />
    </div>
  )
}

// ---------- Hoạt động gần đây ----------

const activityStyle: Record<ActivityItem["kind"], { icon: LucideIcon; className: string }> = {
  interview: { icon: MessagesSquare, className: "bg-violet-soft text-violet" },
  cv_optimized: { icon: Upload, className: "bg-blue-soft text-blue" },
  advisor_comment: { icon: MessageSquareText, className: "bg-violet-soft text-violet" },
  gap_analysis: { icon: FileSearch, className: "bg-blue-soft text-blue" },
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Panel className="grid grid-cols-1 content-start gap-4">
      <PanelHeader
        icon={History}
        title="Hoạt động gần đây & Tiến bộ"
        aside={
          items.length > 0 && (
            <Link href="/student/history" className="text-xs font-medium text-blue hover:underline">
              Xem toàn bộ
            </Link>
          )
        }
      />
      {items.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl bg-surface px-6 py-10 text-center">
          <History className="size-6 text-ink-3" aria-hidden />
          <p className="text-sm font-medium text-ink">Chưa có hoạt động nào</p>
          <p className="max-w-sm text-xs text-ink-2">
            Tải CV lên và chạy phân tích đầu tiên, các hoạt động của bạn sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => {
            const { icon: Icon, className } = activityStyle[item.kind]
            return (
              <li key={item.id} className="flex gap-3 rounded-xl bg-surface p-3">
                <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", className)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold break-words text-ink">{item.title}</p>
                    <time dateTime={item.occurred_at} className="shrink-0 text-xs text-ink-2">
                      {formatRelativeTime(item.occurred_at)}
                    </time>
                  </div>
                  <p className="text-[13px] leading-[18px] text-ink-2">{item.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Tiến độ STAR + lời khuyên cố vấn ----------

export function StarProgress({ overview }: { overview: StudentOverview }) {
  const { star_average: star, star_notes: notes } = overview
  return (
    <Panel className="grid grid-cols-1 gap-4">
      <PanelHeader
        icon={BarChart3}
        title="Tiến độ kỹ năng STAR"
        aside={
          star && (
            <Badge variant="neutral" className="h-auto px-2 py-0.5">
              Trung bình: {starAverage(star).toFixed(1)}%
            </Badge>
          )
        }
      />
      {star ? (
        <ul className="grid gap-4">
          {STAR_KEYS.map((key) => {
            const score = star[key]
            const level = STAR_LEVEL_STYLE[starLevel(score)]
            const note = notes[key]
            return (
              <li key={key} className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-ink">
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-md bg-blue-soft text-[11px] font-bold",
                        key === "situation" || key === "task" ? "text-blue" : "text-violet",
                      )}
                    >
                      {STAR_LABELS[key].letter}
                    </span>
                    {STAR_LABELS[key].label}
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-xs whitespace-nowrap">
                    {note ? (
                      <span className={cn("font-medium", level.text)}>{note}</span>
                    ) : (
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", level.badge)}>{level.label}</span>
                    )}
                    <span className="font-semibold text-ink">{score}%</span>
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-blue-soft"
                  role="progressbar"
                  aria-label={STAR_LABELS[key].label}
                  aria-valuenow={score}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${score}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="grid justify-items-center gap-2 rounded-xl bg-surface px-6 py-8 text-center">
          <BarChart3 className="size-6 text-ink-3" aria-hidden />
          <p className="text-sm font-medium text-ink">Chưa có dữ liệu STAR</p>
          <p className="text-xs text-ink-2">Hoàn thành buổi phỏng vấn thử đầu tiên để xem tiến độ từng tiêu chí.</p>
        </div>
      )}
    </Panel>
  )
}

export function AdvisorTip({ tip }: { tip: NonNullable<StudentOverview["advisor_tip"]> }) {
  return (
    <section className="grid gap-2 rounded-[20px] bg-blue-soft p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-blue">
        <Lightbulb className="size-4" aria-hidden />
        Lời khuyên tuần này từ Cố vấn
      </h2>
      <p className="text-[13px] leading-[21px] text-ink">{tip.text}</p>
      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <span className="text-ink-2">Gợi ý bởi {tip.advisor_name}</span>
        {features.advisorChat && (
          <Link href="/student/share" className="inline-flex items-center gap-0.5 font-medium text-blue hover:underline">
            Nhắn cố vấn
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
    </section>
  )
}

// ---------- Dải cuối trang ----------

export function SafeSpaceBanner() {
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4 p-4 md:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
          <HeartHandshake className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <h2 className="font-heading text-base font-bold">Không gian an toàn để hoàn thiện kỹ năng</h2>
          <p className="text-xs text-ink-2">
            Mọi phiên phỏng vấn và bản chỉnh sửa đều là cơ hội thử nghiệm không rủi ro. Hãy tự tin trả lời theo cách tự
            nhiên nhất của bạn!
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" className="bg-blue-soft px-4" nativeButton={false} render={<Link href="/student/cv" />}>
          Xem danh mục CV
        </Button>
        <Button className="px-4" nativeButton={false} render={<Link href="/student/interview/new" />}>
          Luyện tập ngay
        </Button>
      </div>
    </Panel>
  )
}
