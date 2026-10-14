"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { AlertCircle, FileUp, Heart, Star } from "lucide-react"

import { MatchBadge } from "@/components/common/match-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { JdRecommendationItem } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Một khối trong vùng (DESIGN.md 3.6): tiêu đề 16px không phụ đề, nội dung là các dòng kẻ mảnh, dòng chân ở đáy.
 * Không viền bao quanh; flex cột để dòng chân của các khối cạnh nhau thẳng hàng.
 */
export function Widget({
  id,
  title,
  footer,
  className,
  children,
}: {
  id: string
  title: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col", className)}>
      <h3 id={id} className="mb-1.5 text-base font-semibold text-ink">
        {title}
      </h3>
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-3.5">{footer}</div>}
    </section>
  )
}

interface HeartButtonProps {
  saved: boolean
  title: string
  onToggle: () => void
  className?: string
}

/** Nút lưu vị trí (trái tim). aria-pressed cho trình đọc màn hình biết trạng thái đã lưu. */
export function HeartButton({ saved, title, onToggle, className }: HeartButtonProps) {
  return (
    <button
      type="button"
      aria-label={`Lưu ${title}`}
      aria-pressed={saved}
      onClick={onToggle}
      className={cn(
        "relative z-[1] grid size-10 shrink-0 place-items-center rounded-full transition-[color,background-color,transform] duration-150 hover:bg-surface active:scale-[.92]",
        saved ? "text-bad" : "text-ink-3 hover:text-ink-2",
        className,
      )}
    >
      <Heart className={cn("size-[18px]", saved && "fill-current")} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

export function RecommendedStar({ className }: { className?: string }) {
  return (
    <>
      <Star className={cn("size-[13px] shrink-0 fill-blue text-blue", className)} strokeWidth={1.5} aria-hidden />
      <span className="sr-only">Được gợi ý.</span>
    </>
  )
}

type ChipTone = "neutral" | "good" | "plain" | "warn"

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "border-line-strong bg-surface text-ink-2",
  good: "border-good-line bg-good-soft text-good",
  plain: "border-line-strong bg-card text-ink-2",
  warn: "border-warn-line bg-warn-soft text-warn",
}

export function SkillChip({ name, tone = "neutral" }: { name: string; tone?: ChipTone }) {
  return (
    <span className={cn("inline-flex max-w-full rounded-badge border px-2 py-0.5 text-xs leading-5 font-medium", CHIP_TONE[tone])}>
      <span className="truncate">{name}</span>
    </span>
  )
}

function SkillGroup({ label, skills, tone }: { label: string; skills: string[]; tone: ChipTone }) {
  if (skills.length === 0) return null
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
      <p className="text-xs font-medium text-ink-3">
        {label} <span className="tabular-nums">({skills.length})</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <SkillChip key={s} name={s} tone={tone} />
        ))}
      </div>
    </div>
  )
}

export interface MatchSummaryProps {
  match: { item: JdRecommendationItem; rank: number } | undefined
  /** false: SV chưa có CV sẵn sàng. */
  hasCv: boolean
  loading: boolean
  error: Error | undefined
  onRetry: () => void
}

/** Mức phù hợp ước tính của một vị trí với CV: nhãn (không hiện điểm, DESIGN.md 8.1) và kỹ năng theo trạng thái. */
export function MatchSummary({ match, hasCv, loading, error, onRetry }: MatchSummaryProps) {
  if (!hasCv) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-ink-2">Tải CV lên để xem vị trí này hợp với bạn đến đâu.</p>
        <Button variant="soft" className="h-10 w-fit rounded-full px-4" render={<Link href="/student/cv" />} nativeButton={false}>
          <FileUp aria-hidden />
          Tải CV để xem mức phù hợp
        </Button>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="grid gap-3" aria-busy="true" aria-label="Đang ước tính mức phù hợp">
        <Skeleton className="h-[22px] w-28 rounded-badge" />
        <div className="flex flex-wrap gap-1.5">
          {[64, 88, 52, 76, 60].map((w) => (
            <Skeleton key={w} className="h-6 rounded-badge" style={{ width: w }} />
          ))}
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="grid gap-2.5">
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          Không tải được mức phù hợp.
        </p>
        <Button variant="soft" className="h-9 w-fit rounded-full px-4" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    )
  }
  if (!match) {
    return (
      <div className="grid gap-1">
        <p className="text-sm font-medium text-ink">Chưa nằm trong Top gợi ý cho CV của bạn.</p>
        <p className="text-[13px] text-ink-3">Phân tích chi tiết để xem điểm cho vị trí này.</p>
      </div>
    )
  }
  const { item, rank } = match
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {item.match_label && <MatchBadge label={item.match_label} />}
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2">
          <Star className="size-3.5 fill-blue text-blue" strokeWidth={1.5} aria-hidden />
          Gợi ý <span className="tabular-nums">#{rank}</span>
        </span>
      </div>
      <SkillGroup label="Đã có" skills={item.matched_skills} tone="good" />
      <SkillGroup label="Chỉ liệt kê" skills={item.partial_skills} tone="plain" />
      <SkillGroup label="Còn thiếu" skills={item.missing_skills} tone="warn" />
      <p className="text-xs text-ink-3">Ước tính nhanh theo kỹ năng. Xem điểm chi tiết khi phân tích.</p>
    </div>
  )
}
