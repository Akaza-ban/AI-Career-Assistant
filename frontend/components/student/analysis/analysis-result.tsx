"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { AiProgress } from "@/components/common/ai-progress"
import { PageHeader } from "@/components/common/page-header"
import { FallbackBanner } from "@/components/student/analysis/analysis-result-sections"
import { ResultActionBar } from "@/components/student/analysis/result-action-bar"
import { ResultScoreCard } from "@/components/student/analysis/result-score-card"
import { ResultSkills } from "@/components/student/analysis/result-skills"
import { ResultSuggestions } from "@/components/student/analysis/result-suggestions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ANALYSIS_STEPS } from "@/lib/analysis"
import { api } from "@/lib/api"
import type { GapAnalysis } from "@/lib/types"
import { useApi } from "@/lib/use-api"

/** Chu kỳ hỏi lại tiến độ khi backend còn đang phân tích. */
const POLL_MS = 1500
/** Sau mốc này đổi câu chữ "lâu hơn bình thường" (DESIGN.md mục 9). */
const SLOW_MS = 15_000

// Bản mẫu "Kết quả phân tích" (DESIGN.md mục 7, WIREFRAMES A7). PRD US-SV-02 / US-SV-05, mục 5.2.
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
      <section
        role="alert"
        className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card"
      >
        <AlertCircle className="size-7 text-bad" aria-hidden />
        <h1 className="font-heading text-lg font-bold text-ink">Không tải được kết quả phân tích</h1>
        <p className="text-sm text-ink-2">{error.message}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button size="brand" onClick={reload}>
            Thử lại
          </Button>
          <Button variant="soft" size="brand" nativeButton={false} render={<Link href="/student" />}>
            Về Tổng quan
          </Button>
        </div>
      </section>
    )
  }

  if (!analysis) {
    return (
      <div className="grid gap-14 md:gap-16" aria-busy="true" aria-label="Đang tải kết quả phân tích">
        <div className="grid gap-3 pt-8 pb-2 md:pt-12">
          <Skeleton className="h-9 w-2/3 max-w-md rounded-xl md:h-[46px]" />
          <Skeleton className="h-6 w-1/2 max-w-sm rounded-lg" />
        </div>
        {[176, 420].map((h) => (
          <div key={h} className="grid gap-7">
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="rounded-card" style={{ height: h }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    // Bố cục vùng và khối kiểu Stripe (DESIGN.md 3.6): tiêu đề trang, rồi các vùng cách nhau 56–64px, không thẻ bao.
    <div className="grid gap-14 md:gap-16">
      <div className="grid gap-6">
        <ResultHeader analysis={analysis} />
        {analysis.status === "completed" && !analysis.llm_used && <FallbackBanner />}
      </div>

      {analysis.status === "processing" && <ProcessingView analysis={analysis} />}
      {analysis.status === "failed" && <FailedView analysis={analysis} />}
      {analysis.status === "completed" && (
        <>
          <ResultScoreCard analysis={analysis} />
          <ResultSkills analysis={analysis} />
          <ResultSuggestions analysis={analysis} />
          <div className="grid gap-7 border-t border-line pt-8">
            {/* US-SV-06: khảo sát CSAT sau mỗi lượt phân tích; bỏ thẻ bao để khớp bố cục vùng */}
            <FeedbackWidget
              variant="stars"
              responseId={analysis.response_id}
              activity="gap_analysis"
              title="Bạn chấm lượt phân tích này mấy sao?"
              className="rounded-none border-0 bg-transparent p-0 shadow-none [&>div:first-child]:basis-60"
            />
          </div>
          <ResultActionBar analysis={analysis} />
        </>
      )}
    </div>
  )
}

function ResultHeader({ analysis }: { analysis: GapAnalysis }) {
  // US-SV-02 AC1: kết quả gắn với đúng cặp (phiên bản CV, JD)
  const against = `so với ${analysis.cv_file_name} ${analysis.cv_label}`
  return (
    <PageHeader
      title={analysis.jd.title}
      description={
        <span className="break-words">{analysis.jd.company ? `${analysis.jd.company} · ${against}` : against}</span>
      }
      actions={analysis.jd.source === "pasted" ? <Badge variant="neutral">JD tự dán</Badge> : undefined}
    />
  )
}

function ProcessingView({ analysis }: { analysis: GapAnalysis }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])

  const index = ANALYSIS_STEPS.findIndex((s) => s.key === analysis.current_step)
  return (
    <AiProgress
      className="rounded-none! border-0 border-b bg-transparent px-0 pt-0 pb-8 sm:px-0 sm:pt-0"
      title="Đang phân tích…"
      description={
        slow
          ? "Lâu hơn bình thường một chút… Bạn cứ ở lại trang này, kết quả sẽ tự hiện khi xong."
          : "Thường mất 20–60 giây. Bạn cứ ở lại trang này, kết quả sẽ tự hiện khi xong."
      }
      steps={ANALYSIS_STEPS.map((s) => s.title)}
      current={Math.max(0, index)}
    />
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
    <section
      role="alert"
      className="flex flex-col items-center gap-3 border-y border-line px-4 py-12 text-center"
    >
      <span className="grid size-11 place-items-center rounded-full bg-bad-soft text-bad">
        <AlertCircle className="size-5" aria-hidden />
      </span>
      <h2 className="text-[22px] leading-7 font-semibold text-ink">Phân tích chưa hoàn tất</h2>
      <p className="max-w-md text-[15px] leading-6 text-ink-2">{analysis.error_message ?? "Có lỗi xảy ra trong lúc phân tích."}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button size="brand" onClick={retry} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Chạy lại
        </Button>
        <Button
          variant="soft"
          size="brand"
          nativeButton={false}
          render={<Link href={`/student/analysis/new?cv=${encodeURIComponent(analysis.cv_version_id)}`} />}
        >
          Chọn lại CV / JD
        </Button>
      </div>
    </section>
  )
}
