"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import {
  AlertCircle,
  Clock,
  Gauge,
  Info,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  Mic2,
  RotateCcw,
  Send,
  Sparkles,
  ThumbsUp,
  Timer,
  TrendingUp,
} from "lucide-react"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { useProfile } from "@/components/shell/profile-context"
import { UserAvatar } from "@/components/shell/user-avatar"
import { StarRadar } from "@/components/student/interview/star-radar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { STAR_KEYS, STAR_LABELS, STAR_LEVEL_STYLE, scoreVerdict, starLevel } from "@/lib/star"
import type { InterviewReport as Report, QuestionEvaluation } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const NEEDS_WORK = 75

// Figma: frame "Báo cáo Phỏng vấn STAR" (18:1335). Task B3, PRD US-SV-04 / US-SV-06.
export function InterviewReport({ sessionId }: { sessionId: string }) {
  const profile = useProfile()
  const fetchReport = useCallback(() => api.getInterviewReport(sessionId), [sessionId])
  const { data: report, error, reload } = useApi(fetchReport)

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được báo cáo phỏng vấn</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!report) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải báo cáo">
        <Skeleton className="h-36 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <Skeleton className="h-96 rounded-[20px]" />
          <Skeleton className="h-96 rounded-[20px]" />
        </div>
        <Skeleton className="h-[480px] rounded-[20px]" />
      </div>
    )
  }

  const retryHref = `/student/interview/new?jd=${encodeURIComponent(report.jd.id)}`
  const overall = scoreVerdict(report.total_score)

  return (
    <div className="grid gap-6">
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid min-w-0 flex-1 gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="violet" className="h-auto px-2.5 py-0.5">
              <Mic2 aria-hidden />
              Mô phỏng AI STAR
            </Badge>
            {profile && (
              <Badge variant="neutral" className="h-auto px-2.5 py-0.5">
                Ứng viên: {profile.full_name}
              </Badge>
            )}
            <Badge variant="blue" className="h-auto px-2.5 py-0.5">
              Vị trí: {report.jd.title}
            </Badge>
          </div>
          <h1 className="font-heading text-[28px] leading-9 font-bold">
            Báo cáo đánh giá phỏng vấn thử: {report.round_title}
          </h1>
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
              {report.questions.length}/{report.questions.length} câu hỏi hoàn tất
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" className="h-10" nativeButton={false} render={<Link href="/student/share" />}>
            <Send aria-hidden />
            Gửi cố vấn
          </Button>
          <Button className="h-10 px-5" nativeButton={false} render={<Link href={retryHref} />}>
            <RotateCcw aria-hidden />
            Luyện lại các câu điểm thấp
          </Button>
        </div>
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_3fr]">
        <Panel className="grid gap-5">
          <PanelHeader
            icon={Gauge}
            title="Điểm đánh giá tổng quan"
            aside={<span className={cn("rounded-full px-3 py-1 text-xs font-semibold", overall.badge)}>{overall.label}</span>}
          />
          <div className="grid justify-items-center gap-1">
            <ScoreRing score={report.total_score} size={148} strokeWidth={12} labelClassName="text-5xl" />
            <p className="text-sm text-ink-2">trên 100 điểm</p>
          </div>
          <div className="grid gap-1.5 rounded-xl bg-blue-soft/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue">
              <TrendingUp className="size-4" aria-hidden />
              Nhận định chuyên môn
            </p>
            <p className="text-sm leading-6 text-ink">{report.summary}</p>
          </div>
        </Panel>

        <Panel className="grid gap-4">
          <PanelHeader icon={Sparkles} title="Độ chuẩn hoá theo mô hình STAR" aside={<span className="text-xs text-ink-2">Thang điểm 100</span>} />
          <div className="grid items-center gap-4 md:grid-cols-[1fr_1.2fr]">
            <StarRadar star={report.star} />
            <ul className="grid gap-2">
              {STAR_KEYS.map((key) => {
                const score = report.star[key]
                const level = STAR_LEVEL_STYLE[starLevel(score)]
                const weak = starLevel(score) === "weak"
                return (
                  <li key={key} className={cn("grid gap-0.5 rounded-xl p-3", weak ? "bg-bad-soft/50" : "bg-surface")}>
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <span className={cn("size-2 rounded-full", level.bar)} aria-hidden />
                        {STAR_LABELS[key].letter} – {STAR_LABELS[key].label.replace(/^\w+ \((.*)\)$/, "$1")}
                      </span>
                      <span className={cn("font-heading font-bold", level.text)}>{score}/100</span>
                    </span>
                    {report.star_notes[key] && <span className="text-xs text-ink-2">{report.star_notes[key]}</span>}
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="text-xs text-ink-3">Phương pháp đánh giá: chuẩn hoá STAR theo rubric của hệ thống.</p>
        </Panel>
      </div>

      {report.advisor_review && <AdvisorReviewCard report={report} />}

      <QuestionList questions={report.questions} retryHref={retryHref} />

      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold">
            <Send className="size-4 text-violet" aria-hidden />
            Chia sẻ kết quả phỏng vấn
          </h2>
          <p className="text-sm text-ink-2">
            Bật chia sẻ để cố vấn phụ trách xem báo cáo này và để lại nhận xét. Bạn có thể thu hồi quyền bất cứ lúc nào.
          </p>
        </div>
        <Button variant="soft" className="h-10" nativeButton={false} render={<Link href="/student/share" />}>
          Mở Chia sẻ với Cố vấn
        </Button>
      </Panel>

      <FeedbackWidget
        variant="stars"
        responseId={report.response_id}
        activity="interview"
        title="Bạn đánh giá buổi phỏng vấn AI này có hữu ích không?"
      />

      <p className="flex items-start justify-center gap-1.5 rounded-xl bg-surface px-4 py-3 text-center text-xs text-ink-2">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Báo cáo do AI tổng hợp theo rubric STAR, mang tính tham khảo để nâng cao năng lực ứng tuyển và không đảm bảo kết quả
        tuyển dụng.
      </p>
    </div>
  )
}

function AdvisorReviewCard({ report }: { report: Report }) {
  const review = report.advisor_review!
  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={review.advisor_name} src={null} className="size-11" />
          <div className="grid">
            <p className="flex flex-wrap items-center gap-2 font-heading font-bold">
              {review.advisor_name}
              <Badge variant="blue">Cố vấn nghề nghiệp</Badge>
            </p>
            <p className="text-xs text-ink-2">Đã thẩm định báo cáo {formatRelativeTime(review.reviewed_at).toLowerCase()}</p>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-xl bg-blue-soft/60 text-center text-xs">
          {review.score !== null && (
            <span className="grid px-4 py-2">
              <span className="text-ink-2">Điểm cố vấn thẩm định</span>
              <span className="font-heading text-lg font-bold text-blue">{review.score}/100</span>
            </span>
          )}
          <span className="grid border-l border-line px-4 py-2">
            <span className="text-ink-2">Điểm AI mô phỏng</span>
            <span className="font-heading text-lg font-bold text-ink">{report.total_score}/100</span>
          </span>
        </div>
      </div>
      <blockquote className="flex gap-2 rounded-xl bg-surface p-4 text-sm leading-6 text-ink">
        <MessageSquareQuote className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />“{review.comment}”
      </blockquote>
    </Panel>
  )
}

function QuestionList({ questions, retryHref }: { questions: QuestionEvaluation[]; retryHref: string }) {
  const [filter, setFilter] = useState<"all" | "needs">("all")
  const needs = questions.filter((q) => q.score < NEEDS_WORK)
  const visible = filter === "all" ? questions : needs

  return (
    <section className="grid gap-4" aria-labelledby="question-list-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="question-list-title" className="font-heading text-xl font-bold">
            Chi tiết đánh giá từng câu hỏi
          </h2>
          <p className="text-sm text-ink-2">Tổng quan phân tích {questions.length} câu hỏi phỏng vấn theo tiêu chí STAR.</p>
        </div>
        <div role="tablist" aria-label="Lọc câu hỏi" className="flex gap-1 rounded-xl bg-surface p-1 text-xs">
          {[
            { value: "all" as const, label: `Tất cả (${questions.length})` },
            { value: "needs" as const, label: `Cần cải thiện (${needs.length})` },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={filter === t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium",
                filter === t.value ? "bg-card text-ink shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Panel className="py-8 text-center text-sm text-ink-2">Không có câu nào dưới {NEEDS_WORK} điểm. Làm tốt lắm!</Panel>
      ) : (
        visible.map((q) => <QuestionCard key={q.question_id} q={q} retryHref={retryHref} />)
      )}
    </section>
  )
}

function QuestionCard({ q, retryHref }: { q: QuestionEvaluation; retryHref: string }) {
  const v = scoreVerdict(q.score)
  const low = q.score < NEEDS_WORK
  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg font-heading text-sm font-bold",
              low ? "bg-bad-soft text-bad" : "bg-good-soft text-good",
            )}
          >
            {String(q.index).padStart(2, "0")}
          </span>
          <div className="grid min-w-0 gap-0.5">
            <p className="text-xs text-ink-2">Kỹ năng: {q.skill}</p>
            <p className="font-heading font-bold text-ink">“{q.question}”</p>
          </div>
        </div>
        <span className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold", v.badge)}>
          {q.score}/100 · {v.label}
        </span>
      </div>

      <div className="grid gap-1 rounded-xl bg-surface p-4">
        <p className="flex items-center justify-between gap-2 text-xs text-ink-2">
          <span className="font-semibold">Trích đoạn câu trả lời của bạn</span>
          {q.answer_seconds !== null && (
            <span>
              Thời gian trả lời: {Math.floor(q.answer_seconds / 60)} phút {q.answer_seconds % 60} giây
            </span>
          )}
        </p>
        <p className="text-sm leading-6 text-ink italic">“{q.answer_excerpt}”</p>
      </div>

      {low && q.diagnosis ? (
        <div className="grid gap-3 rounded-xl border border-violet/20 bg-violet-soft/30 p-4">
          <p className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-heading font-bold text-violet">
              <Sparkles className="size-4" aria-hidden />
              Phân tích từ AI Career Coach (STAR Diagnostic)
            </span>
            {q.gap_label && <Badge variant="violet">{q.gap_label}</Badge>}
          </p>
          <p className="text-sm leading-6 text-ink">{q.diagnosis}</p>
          {q.sample_answer && (
            <div className="grid gap-1 rounded-lg bg-card p-3">
              <p className="text-xs font-semibold text-violet">Mẫu câu trả lời gợi ý theo cấu trúc STAR</p>
              <p className="text-[13px] leading-6 text-ink-2">“{q.sample_answer}”</p>
              <p className="text-xs text-ink-3">Chỉ tham khảo cấu trúc. Hãy dùng trải nghiệm và số liệu thật của bạn.</p>
            </div>
          )}
          <Button variant="violet" className="h-9 justify-self-end" nativeButton={false} render={<Link href={retryHref} />}>
            <RotateCcw aria-hidden />
            Luyện lại câu hỏi này
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid content-start gap-1.5 rounded-xl bg-surface p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-good">
              <ThumbsUp className="size-4" aria-hidden />
              Điểm mạnh nổi bật
            </p>
            <ul className="grid gap-1 text-[13px] leading-5 text-ink">
              {q.strengths.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-1.5 rounded-xl bg-blue-soft/40 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue">
              <Lightbulb className="size-4" aria-hidden />
              Gợi ý hoàn thiện thêm
            </p>
            <ul className="grid gap-1 text-[13px] leading-5 text-ink">
              {q.improvements.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  )
}
