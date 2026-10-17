"use client"

import { useState } from "react"
import { AlertCircle, ChevronDown, TimerOff } from "lucide-react"

import { InterviewFeedback, plainText } from "@/components/common/interview-feedback"
import { OutOfFive, ThinBar, score1 } from "@/components/advisor/profile/profile-bits"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { STAR_META, STAR_ORDER } from "@/lib/interview"
import type { AdvisorInterviewReport, InterviewTurn } from "@/lib/types"
import { cn } from "@/lib/utils"

// Cột trái của dialog nhận xét (bản vẽ NhanXetPV): điểm AI, S/T/A/R và từng câu dạng accordion.

interface ReportPaneProps {
  report: AdvisorInterviewReport | null | undefined
  error: Error | null | undefined
  onRetry: () => void
  /** Điểm tổng của buổi, có sẵn từ danh sách nên hiện ngay khi báo cáo đang tải. */
  overall: number
}

export function ReportPane({ report, error, onRetry, overall }: ReportPaneProps) {
  if (error) {
    return (
      <div className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-7 text-bad" strokeWidth={1.75} aria-hidden />
        <p className="max-w-sm text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" size="brand" onClick={onRetry}>
          Thử lại
        </Button>
      </div>
    )
  }
  return (
    <div className="grid">
      <ScoreRow overall={overall} report={report} />
      {!report ? (
        <div className="grid gap-3 pt-4" aria-busy="true" aria-label="Đang tải báo cáo">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-[10px]" />
          ))}
        </div>
      ) : (
        <>
          <TurnAccordion turns={report.turns} />
          {report.guidance.length > 0 && (
            <section aria-labelledby="report-guidance" className="pt-6">
              <h3 id="report-guidance" className="text-base font-semibold text-ink">
                Hướng dẫn hệ thống đã gửi sinh viên
              </h3>
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-ink-2">
                {report.guidance.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ScoreRow({ overall, report }: { overall: number; report: AdvisorInterviewReport | null | undefined }) {
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-line pb-5">
      <div>
        <p className="text-[13px] text-ink-3">Điểm AI</p>
        <OutOfFive score={overall} className="block text-4xl leading-[42px] font-semibold text-ink [&>span]:text-base [&>span]:font-medium" />
      </div>
      <dl className="grid min-w-[240px] flex-1 grid-cols-4 gap-4">
        {STAR_ORDER.map((key) => {
          const value = report?.star[key]
          const weak = report?.weakest === key
          return (
            <div key={key} className="min-w-0">
              <dt className="text-[13px] text-ink-3" title={STAR_META[key].label}>
                {STAR_META[key].letter}
                <span className="sr-only"> {STAR_META[key].label}</span>
              </dt>
              <dd className="font-semibold text-ink tabular-nums">
                {value !== undefined ? score1(value) : "—"}
                {weak && <span className="sr-only"> (yếu nhất)</span>}
              </dd>
              <ThinBar value={(value ?? 0) / 5} tone={weak ? "warn" : "accent"} className="mt-1.5" />
            </div>
          )
        })}
      </dl>
    </div>
  )
}

/** Mỗi lần chỉ mở một câu; mặc định mở câu đầu. */
function TurnAccordion({ turns }: { turns: InterviewTurn[] }) {
  const [open, setOpen] = useState<string | null>(turns[0]?.id ?? null)
  return (
    <ol>
      {turns.map((turn) => {
        const expanded = open === turn.id
        const panelId = `turn-${turn.id}`
        return (
          <li key={turn.id} className="border-b border-line">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : turn.id)}
              className="-mx-2.5 flex w-[calc(100%+20px)] items-center gap-3.5 rounded-lg px-2.5 py-4 text-left transition-colors hover:bg-panel"
            >
              <span className="w-5 shrink-0 text-sm font-semibold text-ink-3 tabular-nums">{turn.index}</span>
              <span className="min-w-0 flex-1 font-medium text-ink">{plainText(turn.question)}</span>
              <span className="shrink-0 font-semibold text-ink tabular-nums">{turn.score === null ? "—" : score1(turn.score)}</span>
              <ChevronDown
                className={cn("size-4 shrink-0 text-ink-3 transition-transform duration-200", expanded && "rotate-180")}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {expanded && (
              <div id={panelId} className="grid gap-3.5 pb-[18px] sm:pl-[34px]">
                {turn.timed_out && (
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-warn">
                    <TimerOff className="size-3.5" strokeWidth={1.75} aria-hidden />
                    Hết giờ ở câu này
                  </p>
                )}
                <div>
                  <p className="mb-1 text-[13px] text-ink-3">Câu trả lời</p>
                  {turn.answer ? (
                    <p className="leading-6 whitespace-pre-line text-ink-2">{turn.answer}</p>
                  ) : (
                    <p className="text-ink-3 italic">Hết giờ khi chưa có câu trả lời.</p>
                  )}
                </div>
                {turn.star && (
                  <p className="text-[13px] text-ink-3 tabular-nums">
                    {STAR_ORDER.map((key) => `${STAR_META[key].letter} ${score1(turn.star![key])}`).join(" · ")}
                  </p>
                )}
                {turn.feedback && (
                  <div>
                    <p className="mb-1 text-[13px] text-ink-3">Nhận xét AI</p>
                    <InterviewFeedback text={turn.feedback} />
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
