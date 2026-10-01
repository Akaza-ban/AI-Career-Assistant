"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  CircleCheck,
  Clock,
  Home,
  Lightbulb,
  ListChecks,
  MessageSquareHeart,
  MessageSquareText,
  Mic2,
  RotateCcw,
  ShieldCheck,
  Timer,
  TimerOff,
  TrendingUp,
} from "lucide-react"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Panel } from "@/components/common/panel"
import { ResultDisclaimer } from "@/components/student/analysis/analysis-result-sections"
import { CsatDialog } from "@/components/student/interview/csat-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { LABEL_META, STAR_META, STAR_ORDER, formatScore, trendOf } from "@/lib/interview"
import type { InterviewReport as Report, InterviewTurn, ReportAdvisorReview } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Figma: frame "Báo cáo Phỏng vấn STAR" (18:1335). PRD US-SV-04 / US-SV-06, S7 + S7b.
export function InterviewReport({ sessionId }: { sessionId: string }) {
  const fetchReport = useCallback(() => api.getInterviewReport(sessionId), [sessionId])
  const { data: report, error, reload } = useApi(fetchReport)

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được kết quả phỏng vấn</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!report) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải kết quả">
        <Skeleton className="h-36 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-[20px]" />
          <Skeleton className="h-72 rounded-[20px]" />
        </div>
        <Skeleton className="h-[480px] rounded-[20px]" />
      </div>
    )
  }

  return <ReportView report={report} />
}

function ReportView({ report }: { report: Report }) {
  const retryHref = `/student/interview/new?jd=${encodeURIComponent(report.jd.id)}`
  const label = LABEL_META[report.label]

  return (
    <div className="grid gap-6">
      <Panel className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="violet" className="h-auto px-2.5 py-0.5">
            <Mic2 aria-hidden />
            Mô phỏng AI STAR
          </Badge>
          <Badge variant="blue" className="h-auto px-2.5 py-0.5">
            Vị trí: {report.jd.title}
          </Badge>
        </div>
        <h1 className="font-heading text-[28px] leading-9 font-bold">Kết quả phỏng vấn thử</h1>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="flex items-center gap-1">
            <Clock className="size-4" aria-hidden />
            Hoàn thành {formatRelativeTime(report.completed_at).toLowerCase()}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-4" aria-hidden />
            Thời lượng: {Math.max(1, Math.round(report.duration_seconds / 60))} phút
          </span>
          <span className="flex items-center gap-1">
            <ListChecks className="size-4" aria-hidden />
            {report.turns.length} câu hỏi
            {report.timed_out_count > 0 && ` · ${report.timed_out_count} câu hết giờ`}
          </span>
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Điểm tổng + so sánh với buổi đầu tiên cùng vị trí */}
        <Panel className="grid content-start gap-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Điểm tổng (thang 0–5)</p>
          <div className="flex items-end gap-3">
            <span className={cn("font-heading text-5xl leading-none font-extrabold", label.className)}>
              {formatScore(report.overall_score)}
            </span>
            <span className="pb-1 text-lg font-semibold text-ink-3">/5</span>
            <Badge variant="neutral" className={cn("mb-1 h-auto px-2.5 py-0.5", label.badge)}>
              {label.text}
            </Badge>
          </div>
          <p className="text-sm text-ink-2">Điểm tổng là trung bình điểm STAR của {report.turns.length} câu trả lời.</p>
          {report.comparison ? (
            <Comparison report={report} />
          ) : (
            <p className="rounded-xl bg-surface p-3 text-sm text-ink-2">
              Đây là buổi đầu tiên cho vị trí này. Hoàn thành thêm buổi để theo dõi tiến bộ.
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <ShieldCheck className="size-3.5 text-blue" aria-hidden />
            Đây là luyện tập, không tính điểm chính thức.
          </p>
        </Panel>

        {/* 4 thanh S/T/A/R, đánh dấu tiêu chí yếu nhất */}
        <Panel className="grid content-start gap-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Điểm theo tiêu chí STAR</p>
          <ul className="grid gap-3.5">
            {STAR_ORDER.map((key) => {
              const score = report.star[key]
              const weakest = key === report.weakest
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
                  <div className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", weakest ? "bg-warn" : "bg-blue")}
                      style={{ width: `${(score / 5) * 100}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      {report.advisor_review && <AdvisorReviewCard review={report.advisor_review} />}

      {/* Hướng dẫn cải thiện: chỉ khung trả lời, không viết sẵn câu trả lời chứa thành tích SV chưa nêu */}
      <Panel className="grid gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-soft text-violet">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          Hướng dẫn cải thiện
        </h2>
        <ul className="grid gap-2">
          {report.guidance.map((g) => (
            <li key={g} className="flex gap-2.5 rounded-xl bg-surface p-3 text-sm leading-6 text-ink">
              <CircleCheck className="mt-1 size-4 shrink-0 text-violet" aria-hidden />
              {g}
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-2">Hệ thống chỉ gợi ý cách trình bày, không viết sẵn câu trả lời cho bạn.</p>
      </Panel>

      <section className="grid gap-3" aria-labelledby="turns-title">
        <h2 id="turns-title" className="font-heading text-lg font-bold">
          Chi tiết từng câu
        </h2>
        {report.turns.map((turn) => (
          <TurnCard key={turn.id} turn={turn} />
        ))}
      </section>

      <Actions report={report} retryHref={retryHref} />
      <ResultDisclaimer />
    </div>
  )
}

/** Nhận xét của cố vấn phụ trách; mở báo cáo là tính đã xem (cố vấn thấy "SV đã xem"). */
function AdvisorReviewCard({ review }: { review: ReportAdvisorReview }) {
  useEffect(() => {
    if (!review.read) void api.markAdvisorFeedbackRead(review.id).catch(() => undefined)
  }, [review.id, review.read])

  return (
    <Panel className="grid gap-3 border-violet/25 bg-violet-soft/40">
      <p className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-soft text-violet">
            <MessageSquareText className="size-4" aria-hidden />
          </span>
          Nhận xét của cố vấn
        </span>
        <span className="text-xs text-ink-2">
          {review.advisor_name} · {formatRelativeTime(review.updated_at).toLowerCase()}
        </span>
      </p>
      <blockquote className="text-sm leading-6 whitespace-pre-line text-ink">&ldquo;{review.comment}&rdquo;</blockquote>
      <p className="text-xs text-ink-2">Điểm AI của buổi này giữ nguyên; nhận xét giúp bạn biết nên luyện gì tiếp.</p>
    </Panel>
  )
}

function Comparison({ report }: { report: Report }) {
  const c = report.comparison!
  const trend = trendOf(c.delta)
  return (
    <div className="grid gap-1 rounded-xl bg-surface p-3 text-sm">
      <p className="flex flex-wrap items-center gap-1.5 text-ink">
        <TrendingUp className="size-4 text-blue" aria-hidden />
        So với buổi đầu tiên ({formatDate(c.first_completed_at)}):
        <strong>
          {formatScore(c.first_score)} → {formatScore(report.overall_score)}
        </strong>
        <span className={cn("font-semibold", trend.className)}>
          ({c.delta > 0 ? "+" : ""}
          {formatScore(c.delta)})
        </span>
      </p>
      <p className={cn("text-xs font-medium", trend.className)}>{trend.text}</p>
    </div>
  )
}

function TurnCard({ turn }: { turn: InterviewTurn }) {
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <Panel className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading font-bold text-ink">
          Câu {turn.index} · {turn.theme}
        </p>
        <span className="flex items-center gap-2">
          {turn.timed_out && (
            <Badge variant="warn">
              <TimerOff aria-hidden />
              Hết giờ
            </Badge>
          )}
          <Badge variant="blue" className="h-auto px-2.5 py-0.5 text-sm">
            {formatScore(turn.score ?? 0)}/5
          </Badge>
        </span>
      </div>
      <p className="text-sm leading-6 font-medium text-ink">{turn.question}</p>
      <div className="grid gap-1 rounded-xl bg-blue-soft/40 p-3">
        <p className="text-xs font-semibold text-ink-2">Câu trả lời của bạn</p>
        {turn.answer ? (
          <>
            <p className={cn("text-sm leading-6 whitespace-pre-line text-ink", !showAnswer && "line-clamp-3")}>{turn.answer}</p>
            {turn.answer.length > 240 && (
              <button
                type="button"
                onClick={() => setShowAnswer((v) => !v)}
                className="justify-self-start text-xs font-medium text-blue hover:underline"
              >
                {showAnswer ? "Thu gọn" : "Xem toàn bộ câu trả lời"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-2 italic">Hết giờ khi chưa có câu trả lời.</p>
        )}
      </div>
      {turn.star && (
        <div className="flex flex-wrap gap-1.5">
          {STAR_ORDER.map((key) => (
            <span key={key} className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink ring-1 ring-line">
              <strong className="text-blue">{STAR_META[key].letter}</strong> {STAR_META[key].label}: {formatScore(turn.star![key])}
            </span>
          ))}
        </div>
      )}
      {turn.feedback && <p className="text-sm leading-6 text-ink-2">{turn.feedback}</p>}
      <FeedbackWidget variant="thumbs" responseId={turn.id} />
    </Panel>
  )
}

function Actions({ report, retryHref }: { report: Report; retryHref: string }) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState<number | null>(null)
  const fetchCsat = useCallback(() => api.getFeedback(report.response_id, "csat"), [report.response_id])
  const { data: saved } = useApi(fetchCsat)
  const rated = submitted ?? saved?.value ?? null

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-card to-violet-soft/50">
      <div className="grid gap-1">
        <h2 className="font-heading text-lg font-bold">Bước tiếp theo</h2>
        <p className="text-sm text-ink-2">
          {rated ? `Bạn đã đánh giá buổi này ${rated} sao. Cảm ơn bạn!` : "Luyện thêm để cải thiện tiêu chí yếu nhất, hoặc cho chúng tôi biết cảm nhận của bạn."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" className="h-10" nativeButton={false} render={<Link href="/student" />}>
          <Home aria-hidden />
          Về trang chủ
        </Button>
        <Button variant="soft" className="h-10" nativeButton={false} render={<Link href={retryHref} />}>
          <RotateCcw aria-hidden />
          Luyện lại
        </Button>
        <Button variant="violet" className="h-10 px-5" onClick={() => setOpen(true)} disabled={rated !== null}>
          <MessageSquareHeart aria-hidden />
          {rated ? "Đã đánh giá" : "Tiếp tục khảo sát"}
        </Button>
      </div>
      <CsatDialog
        responseId={report.response_id}
        activity="interview"
        open={open}
        onOpenChange={setOpen}
        onSubmitted={setSubmitted}
      />
    </Panel>
  )
}
