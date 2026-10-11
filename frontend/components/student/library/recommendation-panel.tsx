"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, ChevronDown, FileUp, Lightbulb } from "lucide-react"

import { MatchBadge } from "@/components/common/match-badge"
import { Zone } from "@/components/common/zone"
import { HeartButton } from "@/components/student/library/library-bits"
import { levelText, metaLine, type SavedState } from "@/components/student/library/library-data"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { CareerAdvice, JdRecommendationItem, RecommendJdsResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLLAPSED = 3

interface RecommendationPanelProps {
  /** undefined: đang tải danh sách CV. */
  hasCv: boolean | undefined
  data: RecommendJdsResponse | undefined
  error: Error | undefined
  loading: boolean
  onRetry: () => void
  saved: SavedState
  detailHref: (jdId: string) => string
  /** Điện thoại: chạm một gợi ý mở sheet mức phù hợp. */
  onOpen: (jdId: string) => void
}

/**
 * Vùng "Phù hợp nhất với CV của bạn" (DESIGN.md 3.6): thẻ gợi ý đặt thẳng trong vùng (thẻ trắng có viền vì SV lưu
 * từng vị trí), lời khuyên AI là một khối không viền bên dưới.
 */
export function RecommendationPanel(props: RecommendationPanelProps) {
  const { hasCv, data, error, loading, onRetry } = props
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()

  // Có CV nhưng không có gợi ý nào: ẩn vùng, chỉ để một dòng thông báo (WIREFRAMES C2).
  if (data && data.recommendations.length === 0) {
    return <p className="text-sm text-ink-2">Chưa tìm được vị trí phù hợp với CV này. Bạn vẫn có thể xem mọi vị trí bên dưới.</p>
  }

  const busy = hasCv === undefined || (hasCv && (loading || (!data && !error)))
  const recs = data?.recommendations ?? []
  const shown = expanded ? recs : recs.slice(0, COLLAPSED)
  const note = busy ? "Đang tìm vị trí phù hợp với CV…" : hasCv && !error ? "Ước tính nhanh theo kỹ năng" : null

  return (
    <Zone
      id={titleId}
      title="Phù hợp nhất với CV của bạn"
      aside={
        (note || recs.length > COLLAPSED) && (
          <div className="flex items-baseline gap-4">
            {note && <span className="text-[13px] text-ink-3 max-sm:hidden">{note}</span>}
            {recs.length > COLLAPSED && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 text-sm font-semibold text-blue hover:text-accent-strong"
              >
                {expanded ? "Thu gọn" : `Xem cả ${recs.length} gợi ý`}
              </button>
            )}
          </div>
        )
      }
    >
      <div aria-busy={busy || undefined}>
        {busy ? (
          <RecSkeleton />
        ) : hasCv === false ? (
          <NoCvCard />
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-4 sm:px-5">
            <AlertCircle className="size-5 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-sm font-semibold text-ink">Không tải được gợi ý vị trí.</p>
              <p className="text-[13px] text-ink-3">{error.message}</p>
            </div>
            <Button variant="soft" className="h-9 rounded-full px-4" onClick={onRetry}>
              Thử lại
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
              {shown.map((rec, i) => (
                <RecCard key={rec.jd_id} rec={rec} rank={i + 1} {...props} />
              ))}
            </div>
            <ol className="-mt-3 md:hidden">
              {shown.map((rec, i) => (
                <li key={rec.jd_id} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() => props.onOpen(rec.jd_id)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold text-ink-2 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{rec.title}</span>
                      <span className="block truncate text-[13px] text-ink-3">
                        {rec.missing_skills.length ? `Thiếu: ${rec.missing_skills.join(", ")}` : "Đã có đủ kỹ năng chính"}
                      </span>
                    </span>
                    {rec.match_label && <MatchBadge label={rec.match_label} />}
                  </button>
                </li>
              ))}
            </ol>
            {data?.advice && recs[0] && <AdviceRow advice={data.advice} target={recs[0].title} />}
          </>
        )}
      </div>
    </Zone>
  )
}

function RecCard({
  rec,
  rank,
  saved,
  detailHref,
}: { rec: JdRecommendationItem; rank: number } & RecommendationPanelProps) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-card border border-line bg-card px-[18px] pt-[18px] pb-4 shadow-xs transition-[transform,box-shadow] duration-200 ease-out-soft motion-safe:hover:-translate-y-[3px] motion-safe:hover:shadow-float">
      <div className="flex items-center gap-2">
        {rec.match_label && <MatchBadge label={rec.match_label} />}
        <span className="text-xs text-ink-3 tabular-nums">#{rank}</span>
        <HeartButton
          saved={saved.savedIds.has(rec.jd_id)}
          title={rec.title}
          onToggle={() => saved.toggle(rec.jd_id)}
          className="-my-1.5 -mr-2 ml-auto size-[34px]"
        />
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base leading-[22px] font-semibold text-ink">{rec.title}</h3>
        <p className="truncate text-[13px] text-ink-3">{metaLine(rec.company, levelText(rec.level))}</p>
      </div>
      <p className="truncate text-[13px] text-ink-2">
        {rec.missing_skills.length ? (
          <>
            <span className="text-ink-3">Còn thiếu</span> {rec.missing_skills.join(", ")}
          </>
        ) : (
          <span className="text-ink-3">Đã có đủ kỹ năng chính</span>
        )}
      </p>
      <Link
        href={detailHref(rec.jd_id)}
        className="mt-0.5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-blue hover:text-accent-strong"
      >
        Xem chi tiết<span className="sr-only"> {rec.title}</span>
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  )
}

/**
 * Lời khuyên AI cho vị trí #1: một khối không viền (tiêu đề, nội dung, kế hoạch dạng dòng kẻ mảnh) với dòng chân
 * "Xem kế hoạch · Do AI tạo…". Không gradient (DESIGN.md mục 4).
 */
function AdviceRow({ advice, target }: { advice: CareerAdvice; target: string }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const planId = useId()
  const steps = advice.action_plan
  return (
    <section aria-labelledby={titleId} className="mt-9 flex items-start gap-3.5 md:mt-10">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-surface text-ink-2">
        <Lightbulb className="size-[17px]" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="pt-[5px] text-base leading-[22px] font-semibold text-ink">
          Lời khuyên cho {target}
        </h3>
        <p className="mt-1.5 border-b border-line pb-3.5 text-[15px] leading-6 text-ink-2">{advice.summary}</p>
        {open && (
          <ol id={planId}>
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3 border-b border-line py-2.5 text-[15px] text-ink">
                <span className="w-5 shrink-0 text-[13px] leading-6 text-ink-3 tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          {steps.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={planId}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-blue hover:text-accent-strong"
            >
              {open ? "Ẩn kế hoạch" : `Xem kế hoạch ${steps.length} bước`}
              <ChevronDown
                className={cn("size-[15px] transition-transform duration-200", open && "rotate-180")}
                strokeWidth={2}
                aria-hidden
              />
            </button>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-ink-3">Do AI tạo từ CV và JD; hãy tự kiểm chứng.</span>
        </div>
      </div>
    </section>
  )
}

/** Chưa có CV: một việc cần làm, nên giữ thẻ trắng có viền đặt thẳng trong vùng. */
function NoCvCard() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-card px-5 py-5 shadow-xs">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink-3">
        <FileUp className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-semibold text-ink">Tải CV lên để xem vị trí hợp với bạn</p>
        <p className="text-sm text-ink-3">Hệ thống so kỹ năng trong CV với từng vị trí trong thư viện.</p>
      </div>
      <Button className="h-10 rounded-full px-5" render={<Link href="/student/cv" />} nativeButton={false}>
        Tải CV lên
      </Button>
    </div>
  )
}

function RecSkeleton() {
  return (
    <>
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3 rounded-card border border-line bg-card p-[18px]">
            <Skeleton className="h-[22px] w-20 rounded-badge" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="-mt-3 md:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-1.5 border-b border-line py-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-9 flex gap-3.5 md:mt-10">
        <Skeleton className="size-8 shrink-0 rounded-[10px]" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="h-4 w-full max-w-[640px]" />
        </div>
      </div>
    </>
  )
}
