"use client"

import { useCallback } from "react"
import { AlertCircle, CalendarDays, Lightbulb, Timer, TimerOff } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatWhen } from "@/lib/format"
import { LABEL_META, STAR_META, STAR_ORDER, formatScore } from "@/lib/interview"
import type { AdvisorInterviewReport, AdvisorInterviewRow, InterviewTurn } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

interface ReportDialogProps {
  studentId: string
  studentName: string
  /** Buổi đang xem; null = đóng. */
  item: AdvisorInterviewRow | null
  onClose: () => void
}

/** Báo cáo đầy đủ của một buổi SV đã chia sẻ: câu hỏi, câu trả lời, điểm S/T/A/R và nhận xét AI từng câu. */
export function ReportDialog({ studentId, studentName, item, onClose }: ReportDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] grid-rows-[auto_minmax(0,1fr)] p-0 sm:max-w-3xl">
        {item && <ReportBody key={item.id} studentId={studentId} studentName={studentName} item={item} />}
      </DialogContent>
    </Dialog>
  )
}

function ReportBody({ studentId, studentName, item }: Omit<ReportDialogProps, "item" | "onClose"> & { item: AdvisorInterviewRow }) {
  const fetchReport = useCallback(() => api.getAdvisorInterviewReport(studentId, item.id), [studentId, item.id])
  const { data: report, error, reload } = useApi(fetchReport)
  const label = LABEL_META[item.label]
  return (
    <>
      <DialogHeader className="border-b border-line px-6 pt-5 pb-4">
        <DialogTitle className="pr-8">Báo cáo phỏng vấn của {studentName}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-ink">
            {item.jd.title}
            {item.jd.company && ` · ${item.jd.company}`}
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatWhen(item.completed_at)}
          </span>
          <span className="flex items-center gap-1">
            <Timer className="size-3.5" aria-hidden />
            {Math.max(1, Math.round(item.duration_seconds / 60))} phút
          </span>
          <span className="flex items-center gap-1.5">
            <strong className={cn("font-heading", label.className)}>{formatScore(item.overall_score)}/5</strong>
            <Badge variant="neutral" className={label.badge}>
              {label.text}
            </Badge>
          </span>
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto px-6 pb-6">
        {error ? (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <AlertCircle className="size-7 text-bad" aria-hidden />
            <p className="text-sm text-ink-2">{error.message}</p>
            <Button variant="soft" onClick={reload}>
              Thử lại
            </Button>
          </div>
        ) : !report ? (
          <div className="grid gap-3" aria-busy="true" aria-label="Đang tải báo cáo">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <ReportContent report={report} />
        )}
      </div>
    </>
  )
}

function ReportContent({ report }: { report: AdvisorInterviewReport }) {
  return (
    <div className="grid gap-5">
      <section className="grid gap-2" aria-label="Điểm theo tiêu chí">
        <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Điểm theo tiêu chí (AI chấm)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STAR_ORDER.map((key) => (
            <div
              key={key}
              className={cn("grid gap-0.5 rounded-xl bg-surface p-3", key === report.weakest && "bg-warn-soft/60 ring-1 ring-warn/30")}
            >
              <span className="text-xs text-ink-2">
                <strong className="text-blue">{STAR_META[key].letter}</strong> {STAR_META[key].label}
              </span>
              <span className="font-heading text-lg font-bold text-ink">{formatScore(report.star[key])}/5</span>
              {key === report.weakest && <span className="text-[11px] font-semibold text-warn">Yếu nhất</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3" aria-label="Các câu trả lời">
        <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">
          {report.turns.length} câu hỏi{report.timed_out_count > 0 && ` · ${report.timed_out_count} câu hết giờ`}
        </p>
        {report.turns.map((turn) => (
          <TurnBlock key={turn.id} turn={turn} />
        ))}
      </section>

      {report.guidance.length > 0 && (
        <section className="grid gap-2 rounded-xl bg-blue-soft/40 p-4" aria-label="Hướng dẫn AI đã gửi sinh viên">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lightbulb className="size-4 text-warn" aria-hidden />
            Hướng dẫn hệ thống đã gửi sinh viên
          </p>
          <ul className="grid list-disc gap-1 pl-5 text-sm leading-6 text-ink-2">
            {report.guidance.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TurnBlock({ turn }: { turn: InterviewTurn }) {
  return (
    <article className="grid gap-3 rounded-xl border border-line p-4">
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
            {turn.score === null ? "—" : `${formatScore(turn.score)}/5`}
          </Badge>
        </span>
      </div>
      <p className="text-sm leading-6 font-medium text-ink">{turn.question}</p>
      <div className="grid gap-1 rounded-xl bg-surface p-3">
        <p className="text-xs font-semibold text-ink-2">Câu trả lời của sinh viên</p>
        {turn.answer ? (
          <p className="text-sm leading-6 whitespace-pre-line text-ink">{turn.answer}</p>
        ) : (
          <p className="text-sm text-ink-2 italic">Hết giờ khi chưa có câu trả lời.</p>
        )}
      </div>
      {turn.star && (
        <div className="flex flex-wrap gap-1.5">
          {STAR_ORDER.map((key) => (
            <span key={key} className="rounded-md bg-card px-2 py-0.5 text-xs text-ink ring-1 ring-line">
              <strong className="text-blue">{STAR_META[key].letter}</strong> {STAR_META[key].label}: {formatScore(turn.star![key])}
            </span>
          ))}
        </div>
      )}
      {turn.feedback && (
        <p className="text-sm leading-6 text-ink-2">
          <span className="font-semibold text-ink">Nhận xét AI: </span>
          {turn.feedback}
        </p>
      )}
    </article>
  )
}
