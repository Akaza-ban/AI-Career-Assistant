"use client"

import Link from "next/link"
import { useCallback } from "react"
import { AlertCircle, ArrowLeft, ArrowRight, Bot, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { CapabilityCheckCard } from "@/components/student/optimizer/capability-check-card"
import { SuggestionCard } from "@/components/student/optimizer/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { suggestionCounts } from "@/lib/cv-document"
import type { CapabilityAnswerRequest, CvDocLine, OptimizerSession, Suggestion } from "@/lib/types"
import { useApi } from "@/lib/use-api"

// Figma: frame "Trình tối ưu CV" (18:903). PRD US-SV-03.
export function CvOptimizer({ analysisId }: { analysisId: string }) {
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data: session, error, reload } = useApi(fetchSession)

  async function decide(s: Suggestion, decision: "accept" | "edit" | "reject", editedText?: string) {
    try {
      const res = await api.decideSuggestion(s.id, { decision, edited_text: editedText })
      if (res.new_cv_version) {
        toast.success(`Đã tạo phiên bản CV ${res.new_cv_version.label}`, {
          description: "Bản trước vẫn được giữ nguyên trong CV của tôi.",
        })
      } else {
        toast.info("Đã bỏ qua gợi ý. CV giữ nguyên.")
      }
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được lựa chọn.")
    }
  }

  async function provideContext(s: Suggestion, answer: string) {
    try {
      await api.provideSuggestionContext(s.id, answer)
      toast.success("Đã nhận ngữ cảnh. Hãy xem lại gợi ý mới.")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được ngữ cảnh.")
    }
  }

  async function answerCheck(id: string, body: CapabilityAnswerRequest) {
    try {
      await api.answerCapabilityCheck(id, body)
      toast.success(body.learning_note ? "Đã thêm vào mục Kỹ năng đang phát triển" : "Đã ghi nhận câu trả lời")
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được câu trả lời.")
    }
  }

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không mở được trình tối ưu</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải trình tối ưu">
        <Skeleton className="h-28 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[720px] rounded-[20px]" />
          <Skeleton className="h-[560px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  const bySuggestionLine = new Map(session.suggestions.map((s) => [s.line_id, s]))
  const counts = suggestionCounts(session.suggestions)
  const reviewed = session.suggestions.length - counts.pending
  const pendingChecks = session.capability_checks.filter((c) => c.status === "pending")
  const answeredChecks = session.capability_checks.filter((c) => c.status !== "pending")
  const pendingSuggestions = session.suggestions.filter((s) => s.status === "pending")
  const doneSuggestions = session.suggestions.filter((s) => s.status !== "pending")
  const exportHref = `/student/analysis/${encodeURIComponent(analysisId)}/export`

  function renderLine(line: CvDocLine) {
    const s = bySuggestionLine.get(line.id)
    if (!s) return undefined
    return <AnnotatedLine line={line} suggestion={s} />
  }

  return (
    <div className="grid gap-6">
      <Link
        href={`/student/analysis/${encodeURIComponent(analysisId)}`}
        className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-blue hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Quay lại kết quả phân tích
      </Link>

      <OptimizerHeader session={session} reviewed={reviewed} total={session.suggestions.length} exportHref={exportHref} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Panel className="min-w-0">
          <CvDocumentView
            doc={session.document}
            renderLine={renderLine}
            sectionAside={(sectionId) => {
              const n = session.document.sections
                .find((sec) => sec.id === sectionId)
                ?.entries.flatMap((e) => e.lines)
                .filter((l) => bySuggestionLine.get(l.id)?.status === "pending").length
              return n ? <Badge variant="warn">Có {n} đề xuất tối ưu</Badge> : null
            }}
          />
        </Panel>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <Panel className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-soft text-violet">
                <Bot className="size-5" aria-hidden />
              </span>
              <div className="grid">
                <p className="font-heading font-bold">Cố vấn AI Career Coach</p>
                <p className="text-xs text-ink-2">
                  {pendingSuggestions.length + pendingChecks.length > 0
                    ? `${pendingSuggestions.length + pendingChecks.length} mục chờ bạn duyệt`
                    : "Bạn đã duyệt hết các gợi ý"}
                </p>
              </div>
            </div>
            <span className="size-2.5 rounded-full bg-good" aria-hidden />
          </Panel>

          {pendingSuggestions.map((s) => (
            <SuggestionCard
              key={`${s.id}-${s.status}-${s.proposed_text}`}
              suggestion={s}
              onDecide={(d, text) => decide(s, d, text)}
              onProvideContext={(answer) => provideContext(s, answer)}
            />
          ))}
          {pendingChecks.map((c) => (
            <CapabilityCheckCard key={c.id} check={c} onAnswer={(body) => answerCheck(c.id, body)} />
          ))}
          {(doneSuggestions.length > 0 || answeredChecks.length > 0) && (
            <p className="pt-2 text-xs font-semibold tracking-[0.06em] text-ink-3 uppercase">Đã xử lý</p>
          )}
          {doneSuggestions.map((s) => (
            <SuggestionCard
              key={`${s.id}-${s.status}`}
              suggestion={s}
              onDecide={(d, text) => decide(s, d, text)}
              onProvideContext={(answer) => provideContext(s, answer)}
            />
          ))}
          {answeredChecks.map((c) => (
            <CapabilityCheckCard key={`${c.id}-${c.status}`} check={c} onAnswer={(body) => answerCheck(c.id, body)} />
          ))}
        </aside>
      </div>
    </div>
  )
}

function OptimizerHeader({
  session,
  reviewed,
  total,
  exportHref,
}: {
  session: OptimizerSession
  reviewed: number
  total: number
  exportHref: string
}) {
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <div className="grid min-w-0 gap-2">
        <h1 className="truncate font-heading text-2xl font-bold" title={session.cv.file_name}>
          {session.cv.file_name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="neutral" className="h-auto bg-blue-soft px-2.5 py-0.5">
            Phiên bản {session.cv.label}
          </Badge>
          <span className="text-ink-2">
            Tối ưu cho: <strong className="font-semibold text-ink">{session.jd.title}</strong>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {session.ats_score !== null && (
          <span className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2">
            <ScoreRing score={session.ats_score} size={36} strokeWidth={3.5} labelClassName="text-xs" />
            <span className="text-xs">
              <span className="block font-semibold text-ink">Điểm ATS: {session.ats_score}/100</span>
              <span className="text-ink-2">Tính lại sau khi xuất CV</span>
            </span>
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-xl bg-blue-soft px-3 py-2 text-xs font-medium text-blue">
          <ShieldCheck className="size-4" aria-hidden />
          Không bịa kinh nghiệm
        </span>
        <span className="rounded-xl bg-surface px-3 py-2 text-xs text-ink-2">
          Đã duyệt <strong className="text-ink">{reviewed}/{total}</strong> gợi ý
        </span>
        <Button size="brand" nativeButton={false} render={<Link href={exportHref} />}>
          Xuất CV hoàn thiện
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </Panel>
  )
}

/** Dòng CV có gợi ý: chờ duyệt / cần ngữ cảnh / đã áp dụng (so sánh trước–sau) / đã bỏ qua. */
function AnnotatedLine({ line, suggestion: s }: { line: CvDocLine; suggestion: Suggestion }) {
  if (s.status === "accepted" || s.status === "edited") {
    return (
      <div className="grid gap-2 rounded-xl border border-line p-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-violet">
            <Sparkles className="size-3.5" aria-hidden />
            So sánh trước & sau khi tối ưu
          </span>
          <span className="rounded-md bg-surface px-2 py-0.5 text-ink-2">Nguồn trích dẫn: dòng {line.line_no} CV gốc</span>
        </p>
        <p className="rounded-lg bg-bad-soft/50 p-2 text-[13px] text-ink-2">
          <span className="block text-[11px] font-semibold tracking-wide text-bad uppercase">Bản gốc của bạn</span>
          <s className="decoration-bad/60">{s.original_text}</s>
        </p>
        <p className="rounded-lg bg-violet-soft/60 p-2 text-[13px] text-ink">
          <span className="block text-[11px] font-semibold tracking-wide text-violet uppercase">
            {s.status === "edited" ? "Bản bạn đã sửa tay" : "Đề xuất tối ưu (đã được bạn phê duyệt)"}
          </span>
          {s.proposed_text}
        </p>
      </div>
    )
  }
  if (s.status === "rejected") {
    return (
      <span>
        {line.text} <Badge variant="neutral">Đã bỏ qua gợi ý</Badge>
      </span>
    )
  }
  return (
    <a
      href={`#sg-${s.id}`}
      className="group block rounded-lg bg-warn-soft/40 px-2 py-1 decoration-warn/60 decoration-dashed underline-offset-4 hover:underline"
    >
      {line.text}{" "}
      <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-warn">
        {s.needs_context ? <MessageSquareQuote className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
        {s.needs_context ? "Cần bạn bổ sung ngữ cảnh" : "Có gợi ý"}
      </span>
    </a>
  )
}
