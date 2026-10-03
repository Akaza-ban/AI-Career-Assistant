"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Briefcase, Circle, CircleCheck, FileText, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Panel } from "@/components/common/panel"
import {
  EvidenceList,
  NextActions,
  ResultDisclaimer,
  ScoreCard,
  SuggestionList,
} from "@/components/student/analysis/analysis-result-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ANALYSIS_STEPS } from "@/lib/analysis"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { GapAnalysis } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** Chu kỳ hỏi lại tiến độ khi backend còn đang phân tích. */
const POLL_MS = 1500

// Figma: frame "Phân tích CV và JD" (18:385). PRD US-SV-02 / US-SV-05, mục 5.2.
export function AnalysisResult({ id }: { id: string }) {
  const fetchAnalysis = useCallback(() => api.getGapAnalysis(id), [id])
  const { data: analysis, error, reload } = useApi(fetchAnalysis)

  // Backend chạy nền: hỏi lại cho tới khi phân tích xong hoặc lỗi.
  useEffect(() => {
    if (analysis?.status !== "processing") return
    const timer = setTimeout(reload, POLL_MS)
    return () => clearTimeout(timer)
  }, [analysis, reload])

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được kết quả phân tích</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!analysis) {
    return (
      <div className="grid gap-8" aria-busy="true" aria-label="Đang tải kết quả phân tích">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
        <Skeleton className="h-[420px] rounded-[20px]" />
      </div>
    )
  }

  return (
    <div className="grid gap-8">
      <ResultHeader analysis={analysis} />

      {analysis.status === "processing" && <ProcessingView analysis={analysis} />}
      {analysis.status === "failed" && <FailedView analysis={analysis} />}
      {analysis.status === "completed" && (
        <>
          <ScoreCard analysis={analysis} />
          <EvidenceList requirements={analysis.requirements} />
          <SuggestionList analysis={analysis} />
          <NextActions analysis={analysis} />
          {/* US-SV-06: khảo sát CSAT sau mỗi lượt phân tích */}
          <FeedbackWidget
            variant="stars"
            responseId={analysis.response_id}
            activity="gap_analysis"
            title="Bạn đánh giá kết quả phân tích này hữu ích đến mức nào?"
          />
          <ResultDisclaimer />
        </>
      )}
    </div>
  )
}

function ResultHeader({ analysis }: { analysis: GapAnalysis }) {
  const company = analysis.jd.company ? ` – ${analysis.jd.company}` : ""
  return (
    <div className="grid gap-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <Badge variant="violet">Báo cáo đối soát CV</Badge>
        {analysis.jd.source === "pasted" && <Badge variant="neutral">JD tự dán</Badge>}
        <span>{formatRelativeTime(analysis.created_at)}</span>
      </div>
      <h1 className="font-heading text-[32px] leading-10 font-bold">Kết quả phân tích CV – JD</h1>
      {/* US-SV-02 AC1: kết quả gắn với đúng cặp (phiên bản CV, JD) */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-ink ring-1 ring-line">
          <Briefcase className="size-3.5 shrink-0 text-blue" aria-hidden />
          <span>
            Vị trí: <strong className="font-semibold">{analysis.jd.title + company}</strong>
          </span>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-ink ring-1 ring-line">
          <FileText className="size-3.5 shrink-0 text-blue" aria-hidden />
          <span className="min-w-0 break-all">
            CV: <strong className="font-semibold">{analysis.cv_file_name}</strong>{" "}
            <span className="text-ink-3">({analysis.cv_label})</span>
          </span>
        </span>
      </div>
    </div>
  )
}

function ProcessingView({ analysis }: { analysis: GapAnalysis }) {
  const current = ANALYSIS_STEPS.findIndex((s) => s.key === analysis.current_step)
  return (
    <Panel className="grid gap-5" aria-live="polite" aria-busy="true">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Loader2 className="size-5 animate-spin text-violet" aria-hidden />
          Đang phân tích CV với JD
        </h2>
        <p className="text-sm text-ink-2">
          Thường mất 20–60 giây. Bạn cứ ở lại trang này, kết quả sẽ tự hiện khi xong.
        </p>
      </div>
      <ol className="grid gap-2">
        {ANALYSIS_STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "running" : "waiting"
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3",
                state === "running" ? "bg-violet-soft/60 ring-1 ring-violet/20" : state === "done" ? "bg-surface" : "",
              )}
            >
              {state === "done" ? (
                <CircleCheck className="size-5 shrink-0 text-good" aria-hidden />
              ) : state === "running" ? (
                <Loader2 className="size-5 shrink-0 animate-spin text-violet" aria-hidden />
              ) : (
                <Circle className="size-5 shrink-0 text-ink-3" aria-hidden />
              )}
              <span className="grid min-w-0 flex-1">
                <span className={cn("text-sm font-semibold", state === "waiting" ? "text-ink-2" : "text-ink")}>
                  {i + 1}. {step.title}
                </span>
                <span className="text-xs text-ink-2">{step.description}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  state === "done" ? "text-good" : state === "running" ? "text-violet" : "text-ink-3",
                )}
              >
                {state === "done" ? "Xong" : state === "running" ? "Đang chạy" : "Chờ"}
              </span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function FailedView({ analysis }: { analysis: GapAnalysis }) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  // Chạy lại với đúng CV và JD cũ (JD tự dán đã được lưu nên dùng lại bằng id).
  async function retry() {
    setRetrying(true)
    try {
      const next = await api.createGapAnalysis({ cv_version_id: analysis.cv_version_id, jd_id: analysis.jd.id })
      router.replace(`/student/analysis/${encodeURIComponent(next.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không chạy lại được. Hãy thử lại sau.")
      setRetrying(false)
    }
  }

  return (
    <Panel className="grid justify-items-center gap-3 py-10 text-center" role="alert">
      <AlertCircle className="size-8 text-bad" aria-hidden />
      <p className="font-heading text-lg font-bold">Phân tích chưa hoàn tất</p>
      <p className="max-w-md text-sm text-ink-2">{analysis.error_message ?? "Có lỗi xảy ra trong lúc phân tích."}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button onClick={retry} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Thử lại
        </Button>
        <Button
          variant="soft"
          nativeButton={false}
          render={<Link href={`/student/analysis/new?cv=${encodeURIComponent(analysis.cv_version_id)}`} />}
        >
          Chọn lại CV / JD
        </Button>
      </div>
    </Panel>
  )
}
