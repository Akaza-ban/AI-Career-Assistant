"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CircleCheck,
  Clock,
  FileCheck2,
  Info,
  Lock,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Panel, SectionHeader } from "@/components/common/panel"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { CapabilityCheckCard } from "@/components/student/optimizer/capability-check-card"
import { SuggestionCard } from "@/components/student/optimizer/suggestion-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MATCH_LABEL_META, formatPercent } from "@/lib/analysis"
import { ApiError, api } from "@/lib/api"
import { draftDocument, learningSkills, suggestionCounts } from "@/lib/cv-document"
import { formatWhen } from "@/lib/format"
import type { CapabilityAnswerRequest, CvDocLine, OptimizerSession, Suggestion, SuggestionDecisionRequest } from "@/lib/types"
import { useApi } from "@/lib/use-api"

// Figma: frame "Trình tối ưu CV" (18:903). PRD US-SV-03, US-SV-05, mục 6.
export function CvOptimizer({ analysisId }: { analysisId: string }) {
  const router = useRouter()
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data, error, reload } = useApi(fetchSession)
  // Mỗi thao tác trả về trạng thái mới của trình tối ưu: dùng luôn, không tải lại cả trang.
  const [updated, setUpdated] = useState<OptimizerSession>()
  const session = updated ?? data
  const [confirmOpen, setConfirmOpen] = useState(false)
  const analysisHref = `/student/analysis/${encodeURIComponent(analysisId)}`
  const exportHref = `${analysisHref}/export`

  async function decide(s: Suggestion, decision: SuggestionDecisionRequest["decision"], editedText?: string) {
    try {
      setUpdated(await api.decideSuggestion(analysisId, s.id, { decision, edited_text: editedText }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được lựa chọn.")
    }
  }

  async function provideContext(s: Suggestion, answer: string) {
    try {
      setUpdated(await api.provideSuggestionContext(analysisId, s.id, answer))
      toast.success("Đã nhận ngữ cảnh. Hãy xem lại gợi ý mới.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được ngữ cảnh.")
    }
  }

  /** Báo lỗi rồi ném lại để thẻ giữ nguyên nội dung SV đang nhập. */
  async function answerCheck(id: string, body: CapabilityAnswerRequest) {
    try {
      setUpdated(await api.answerCapabilityCheck(analysisId, id, body))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được câu trả lời.")
      throw err
    }
  }

  async function finalize() {
    try {
      const result = await api.finalizeOptimization(analysisId)
      setUpdated(result)
      toast.success(`Đã tạo phiên bản CV ${result.result_cv?.label ?? "mới"}`, {
        description: "Bản trước vẫn được giữ nguyên trong CV của tôi.",
      })
      router.push(exportHref)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tạo được phiên bản mới.")
      throw err
    }
  }

  if (error) {
    const blocked = error instanceof ApiError && error.status === 409
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không mở được trình tối ưu</p>
        <p className="max-w-md text-sm text-ink-2">{error.message}</p>
        {blocked ? (
          <Button variant="soft" nativeButton={false} render={<Link href={analysisHref} />}>
            <ArrowLeft aria-hidden />
            Quay lại kết quả phân tích
          </Button>
        ) : (
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
        )}
      </Panel>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-8" aria-busy="true" aria-label="Đang tải trình tối ưu">
        <Skeleton className="h-24 rounded-[20px]" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[720px] rounded-[20px]" />
          <Skeleton className="h-[560px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  const editable = session.status === "draft"
  const bySuggestionLine = new Map(session.suggestions.map((s) => [s.line_id, s]))
  const counts = suggestionCounts(session.suggestions)
  const learning = learningSkills(session)
  const changeCount = counts.accepted + counts.edited + learning.length
  const pendingSuggestions = session.suggestions.filter((s) => s.status === "pending")
  const doneSuggestions = session.suggestions.filter((s) => s.status !== "pending")
  const pendingChecks = session.capability_checks.filter((c) => c.status === "pending")
  const answeredChecks = session.capability_checks.filter((c) => c.status !== "pending")
  // Kỹ năng đang học hiện ngay trong bản xem trước để SV thấy đúng nội dung sẽ vào phiên bản mới.
  const preview = { ...session.document, developing_skills: draftDocument(session).developing_skills }

  function renderLine(line: CvDocLine) {
    const s = bySuggestionLine.get(line.id)
    return s ? <AnnotatedLine line={line} suggestion={s} /> : undefined
  }

  return (
    <div className="grid gap-8">
      <OptimizerHeader
        session={session}
        reviewed={session.suggestions.length - counts.pending}
        changeCount={changeCount}
        exportHref={exportHref}
        onFinalize={() => setConfirmOpen(true)}
      />

      {!editable && <FinalizedBanner session={session} exportHref={exportHref} />}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="grid min-w-0 gap-3">
          <SectionHeader
            title="Bản xem trước CV"
            aside={
              <span className="hidden text-xs text-ink-2 md:inline">Dòng tô vàng là dòng có gợi ý, bấm để tới gợi ý tương ứng</span>
            }
          />
          <Panel>
            <CvDocumentView
              doc={preview}
              renderLine={renderLine}
              sectionAside={(sectionId) => {
                const n = session.document.sections
                  .find((sec) => sec.id === sectionId)
                  ?.lines.filter((l) => bySuggestionLine.get(l.id)?.status === "pending").length
                return n ? <Badge variant="warn">Có {n} đề xuất tối ưu</Badge> : null
              }}
            />
          </Panel>
        </section>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <div className="grid gap-2">
            <SectionHeader
              title="Gợi ý tối ưu"
              aside={
                <span className="text-xs text-ink-2">
                  {!editable
                    ? "Đã hoàn tất"
                    : pendingSuggestions.length + pendingChecks.length > 0
                      ? `${pendingSuggestions.length + pendingChecks.length} mục chờ bạn xem`
                      : "Đã xem hết"}
                </span>
              }
            />
            {/* PRD mục 6.4: giữ nguyên văn */}
            <p className="flex items-start gap-2 rounded-xl bg-blue-soft/50 px-3 py-2.5 text-xs leading-5 text-ink-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-blue" aria-hidden />
              Các nội dung do AI đề xuất cần được kiểm tra trước khi sử dụng. Bạn chịu trách nhiệm đảm bảo thông tin phản ánh
              chính xác kinh nghiệm, kỹ năng và thành tích thực tế của mình.
            </p>
          </div>

          {session.suggestions.length === 0 && <NoSuggestions session={session} />}
          {session.pending_review_count > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-card p-3 text-xs leading-5 text-ink-2">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
              {session.pending_review_count} gợi ý chưa đủ căn cứ trong CV nên đang chờ cố vấn xem lại, chưa hiển thị ở đây.
            </p>
          )}

          {pendingSuggestions.map((s) => (
            <SuggestionCard
              key={`${s.id}-${s.status}-${s.proposed_text}`}
              suggestion={s}
              editable={editable}
              onDecide={(d, text) => decide(s, d, text)}
              onProvideContext={(answer) => provideContext(s, answer)}
            />
          ))}

          {session.capability_checks.length > 0 && (
            <h3 className="pt-4 font-heading text-base font-bold text-ink">Kỹ năng JD yêu cầu mà CV chưa thể hiện</h3>
          )}
          {pendingChecks.map((c) => (
            <CapabilityCheckCard key={c.id} check={c} editable={editable} onAnswer={(body) => answerCheck(c.id, body)} />
          ))}
          {answeredChecks.map((c) => (
            <CapabilityCheckCard
              key={`${c.id}-${c.status}-${c.learning_note ?? ""}-${c.context ?? ""}`}
              check={c}
              editable={editable}
              onAnswer={(body) => answerCheck(c.id, body)}
            />
          ))}

          {doneSuggestions.length > 0 && (
            <h3 className="pt-4 font-heading text-base font-bold text-ink">Gợi ý đã xử lý</h3>
          )}
          {doneSuggestions.map((s) => (
            <SuggestionCard
              key={`${s.id}-${s.status}`}
              suggestion={s}
              editable={editable}
              onDecide={(d, text) => decide(s, d, text)}
              onProvideContext={(answer) => provideContext(s, answer)}
            />
          ))}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hoàn tất và tạo phiên bản CV mới?"
        description={
          <>
            Phiên bản mới gồm {counts.accepted} gợi ý đã chấp nhận, {counts.edited} câu bạn sửa tay
            {learning.length > 0 && ` và ${learning.length} kỹ năng đang học`}.
            {counts.pending > 0 && ` ${counts.pending} gợi ý chưa xem sẽ giữ nguyên câu gốc.`} Phiên bản mới được thêm vào
            cùng CV, bản {session.cv.label} vẫn được giữ trong lịch sử phiên bản. Sau khi hoàn tất, bạn không đổi được các
            lựa chọn trong lượt tối ưu này nữa.
          </>
        }
        confirmLabel="Hoàn tất & tạo phiên bản"
        onConfirm={finalize}
      />
    </div>
  )
}

function OptimizerHeader({
  session,
  reviewed,
  changeCount,
  exportHref,
  onFinalize,
}: {
  session: OptimizerSession
  reviewed: number
  changeCount: number
  exportHref: string
  onFinalize: () => void
}) {
  const label = session.match_label ? MATCH_LABEL_META[session.match_label] : null
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 py-2">
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <Badge variant="violet">Trình tối ưu CV</Badge>
          <Badge variant="neutral" className="bg-blue-soft">
            Phiên bản {session.cv.label}
          </Badge>
        </div>
        <h1 className="truncate font-heading text-[32px] leading-10 font-bold" title={session.cv.file_name}>
          {session.cv.file_name}
        </h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-ink ring-1 ring-line">
            <Briefcase className="size-3.5 shrink-0 text-blue" aria-hidden />
            <span>
              Tối ưu cho: <strong className="font-semibold">{session.jd.title}</strong>
              {session.jd.company && <span className="text-ink-2"> · {session.jd.company}</span>}
            </span>
          </span>
          {session.match_score !== null && (
            <span className="flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-ink ring-1 ring-line">
              Độ khớp lúc phân tích: <strong className="font-semibold">{formatPercent(session.match_score)}%</strong>
              {label && <Badge variant={label.badge}>{label.text}</Badge>}
            </span>
          )}
          {session.suggestions.length > 0 && (
            <span className="flex items-center rounded-lg bg-card px-2.5 py-1.5 text-ink-2 ring-1 ring-line">
              Đã xem&nbsp;<strong className="font-semibold text-ink">{reviewed}/{session.suggestions.length}</strong>&nbsp;gợi ý
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-lg bg-blue-soft px-2.5 py-1.5 font-medium text-blue">
            <ShieldCheck className="size-3.5" aria-hidden />
            Không bịa kinh nghiệm
          </span>
        </div>
      </div>
      {session.status === "draft" ? (
        <span className="grid justify-items-end gap-1">
          <Button size="brand" onClick={onFinalize} disabled={changeCount === 0}>
            <FileCheck2 aria-hidden />
            Hoàn tất & tạo phiên bản mới
          </Button>
          {changeCount === 0 && (
            <span className="text-[11px] text-ink-3">Áp dụng ít nhất một gợi ý hoặc ghi kỹ năng đang học</span>
          )}
        </span>
      ) : (
        <Button size="brand" nativeButton={false} render={<Link href={exportHref} />}>
          Xem & xuất CV
          <ArrowRight aria-hidden />
        </Button>
      )}
    </header>
  )
}

function FinalizedBanner({ session, exportHref }: { session: OptimizerSession; exportHref: string }) {
  return (
    <p className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-good/30 bg-good-soft/50 px-5 py-3 text-sm text-ink">
      <span className="flex items-start gap-2">
        <Lock className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
        <span>
          Bạn đã hoàn tất{session.finalized_at && ` ${formatWhen(session.finalized_at).toLowerCase()}`}
          {session.result_cv
            ? `, tạo phiên bản ${session.result_cv.label}. `
            : ". Phiên bản tạo ra đã bị xoá khỏi CV của tôi. "}
          Muốn tối ưu tiếp, hãy phân tích lại phiên bản mới với JD này.
        </span>
      </span>
      {session.result_cv && (
        <Link href={exportHref} className="font-medium text-blue hover:underline">
          Xem phiên bản mới
        </Link>
      )}
    </p>
  )
}

function NoSuggestions({ session }: { session: OptimizerSession }) {
  return (
    <Panel className="grid gap-2 p-4 text-sm">
      <p className="flex items-center gap-2 font-heading font-bold text-ink">
        <Sparkles className="size-4 text-violet" aria-hidden />
        Chưa có gợi ý diễn đạt lại
      </p>
      <p className="text-[13px] leading-5 text-ink-2">
        {session.llm_used
          ? "AI chưa tìm thấy câu nào trong CV có thể diễn đạt rõ hơn cho vị trí này mà vẫn giữ đúng thông tin bạn đã viết."
          : "Lượt phân tích này được chấm bằng quy tắc dự phòng vì AI chưa sẵn sàng, nên chưa có gợi ý viết lại. Hãy phân tích lại khi AI hoạt động."}
      </p>
      {session.capability_checks.length > 0 && (
        <p className="text-[13px] leading-5 text-ink-2">Bạn vẫn có thể xác nhận các kỹ năng còn thiếu bên dưới.</p>
      )}
    </Panel>
  )
}

/** Dòng CV có gợi ý: chờ duyệt / cần ngữ cảnh / đã áp dụng (so sánh trước–sau) / đã bỏ qua. */
function AnnotatedLine({ line, suggestion: s }: { line: CvDocLine; suggestion: Suggestion }) {
  if (s.final_text !== null) {
    return (
      <div className="grid gap-2 rounded-xl border border-line p-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-violet">
            <CircleCheck className="size-3.5" aria-hidden />
            So sánh trước & sau khi tối ưu
          </span>
          <span className="rounded-md bg-surface px-2 py-0.5 text-ink-2">Căn cứ: dòng {line.line_no} CV gốc</span>
        </p>
        <p className="rounded-lg bg-bad-soft/50 p-2 text-[13px] text-ink-2">
          <span className="block text-[11px] font-semibold tracking-wide text-bad uppercase">Bản gốc của bạn</span>
          <s className="decoration-bad/60">{s.original_text}</s>
        </p>
        <p className="rounded-lg bg-violet-soft/60 p-2 text-[13px] text-ink">
          <span className="block text-[11px] font-semibold tracking-wide text-violet uppercase">
            {s.status === "edited" ? "Bản bạn đã sửa tay" : "Đề xuất tối ưu (đã được bạn chấp nhận)"}
          </span>
          {s.final_text}
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
