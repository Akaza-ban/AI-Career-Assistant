"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ArrowLeft, ArrowRight, ChevronRight, Clock, FileCheck2, Lock } from "lucide-react"
import { toast } from "sonner"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { CapabilityCheckCard } from "@/components/student/optimizer/capability-check-card"
import { SuggestionCard } from "@/components/student/optimizer/suggestion-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api } from "@/lib/api"
import { draftDocument, learningSkills, suggestionCounts } from "@/lib/cv-document"
import { formatWhen } from "@/lib/format"
import type {
  CapabilityAnswerRequest,
  CvDocLine,
  CvDocument,
  CvVersion,
  OptimizerSession,
  Suggestion,
  SuggestionDecisionRequest,
} from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** "KINH NGHIỆM DỰ ÁN" → "Kinh nghiệm dự án" để ghi cạnh loại gợi ý. */
export function sectionLabel(title: string) {
  const lower = title.toLocaleLowerCase("vi")
  return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1)
}

/** Tên mục CV của từng dòng, theo id dòng. */
export function sectionByLine(doc: CvDocument) {
  return new Map(doc.sections.flatMap((sec) => sec.lines.map((l) => [l.id, sectionLabel(sec.title)] as const)))
}

/** "Hoàn tất" thêm số phụ vào bản mới nhất của CV (v1.1 → v1.2), khớp src/services/cv_versions.py. */
function nextMinorLabel(family: CvVersion[]) {
  const latest = family.reduce<CvVersion | undefined>((a, b) => (!a || b.version > a.version ? b : a), undefined)
  const m = latest && /v(\d+)\.(\d+)/.exec(latest.label)
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : undefined
}

/** Gợi ý chờ duyệt kế tiếp sau `fromId` (vòng lại đầu danh sách). */
function nextPending(suggestions: Suggestion[], fromId: string) {
  const start = suggestions.findIndex((s) => s.id === fromId)
  for (let k = 1; k <= suggestions.length; k++) {
    const s = suggestions[(start + k) % suggestions.length]
    if (s.status === "pending") return s.id
  }
  return fromId
}

// Bản vẽ ToiUu (Trình tối ưu CV). PRD US-SV-03, US-SV-05, mục 6.
export function CvOptimizer({ analysisId }: { analysisId: string }) {
  const router = useRouter()
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data, error, reload } = useApi(fetchSession)
  // Mỗi thao tác trả về trạng thái mới của trình tối ưu: dùng luôn, không tải lại cả trang.
  const [updated, setUpdated] = useState<OptimizerSession>()
  const session = updated ?? data
  const [currentId, setCurrentId] = useState<string>()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [nextLabel, setNextLabel] = useState<string>()
  const analysisHref = `/student/analysis/${encodeURIComponent(analysisId)}`
  const exportHref = `${analysisHref}/export`

  // Nhãn phiên bản sẽ tạo ("Hoàn tất & tạo v1.2") lấy từ lịch sử phiên bản của CV; lỗi thì ghi chung "phiên bản mới".
  const cvId = session?.cv.id
  useEffect(() => {
    if (!cvId) return
    let alive = true
    api
      .listCvHistory(cvId)
      .then((family) => alive && setNextLabel(nextMinorLabel(family)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [cvId])

  async function decide(s: Suggestion, decision: SuggestionDecisionRequest["decision"], editedText?: string) {
    try {
      const next = await api.decideSuggestion(analysisId, s.id, { decision, edited_text: editedText })
      setUpdated(next)
      // Xét xong một gợi ý thì chuyển sang gợi ý còn chờ kế tiếp; hoàn tác thì ở lại.
      if (decision !== "undo") setCurrentId(nextPending(next.suggestions, s.id))
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
      <section
        role="alert"
        className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card"
      >
        <AlertCircle className="size-7 text-bad" aria-hidden />
        <h1 className="text-lg font-semibold text-ink">Không mở được trình tối ưu</h1>
        <p className="text-sm text-ink-2">{error.message}</p>
        {blocked ? (
          <Button variant="soft" size="brand" nativeButton={false} render={<Link href={analysisHref} />}>
            <ArrowLeft aria-hidden />
            Quay lại kết quả phân tích
          </Button>
        ) : (
          <Button size="brand" onClick={reload}>
            Thử lại
          </Button>
        )}
      </section>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-8" aria-busy="true" aria-label="Đang tải trình tối ưu">
        <div className="grid gap-3 pt-8 pb-2 md:pt-12">
          <Skeleton className="h-9 w-2/3 max-w-md rounded-xl md:h-[46px]" />
          <Skeleton className="h-6 w-1/2 max-w-sm rounded-lg" />
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <Skeleton className="h-[640px] min-w-0 flex-[1.15_1_480px] rounded-card" />
          <Skeleton className="h-[420px] min-w-0 flex-[1_1_380px] rounded-card" />
        </div>
      </div>
    )
  }

  const editable = session.status === "draft"
  const suggestions = session.suggestions
  const byLine = new Map(suggestions.map((s) => [s.line_id, s]))
  const sections = sectionByLine(session.document)
  const counts = suggestionCounts(suggestions)
  const learning = learningSkills(session)
  const changeCount = counts.accepted + counts.edited + learning.length
  const reviewed = suggestions.length - counts.pending
  const current =
    suggestions.find((s) => s.id === currentId) ?? suggestions.find((s) => s.status === "pending") ?? suggestions[0]
  const currentIndex = current ? suggestions.indexOf(current) : -1
  const newLabel = nextLabel ?? "phiên bản mới"
  // Kỹ năng đang học hiện ngay trong bản xem trước để SV thấy đúng nội dung sẽ vào phiên bản mới.
  const preview = { ...session.document, developing_skills: draftDocument(session).developing_skills }

  function goTo(id: string) {
    setCurrentId(id)
    document.getElementById("suggestion-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  function step(delta: number) {
    const n = suggestions.length
    setCurrentId(suggestions[(currentIndex + delta + n) % n].id)
  }

  function renderLine(line: CvDocLine) {
    const s = byLine.get(line.id)
    if (!s) return undefined
    return <PaperLine line={line} suggestion={s} current={s.id === current?.id} onPick={() => goTo(s.id)} />
  }

  const finishHint =
    changeCount === 0
      ? "Áp dụng ít nhất một gợi ý hoặc ghi kỹ năng đang học"
      : counts.pending > 0
        ? `Còn ${counts.pending} gợi ý chưa xét, bạn vẫn có thể hoàn tất`
        : "Đã xét hết gợi ý"

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Trình tối ưu CV"
        description={
          <span className="break-words">
            {session.jd.title} · {session.cv.file_name} {session.cv.label}
          </span>
        }
        actions={
          suggestions.length > 0 ? (
            <div className="w-[280px] max-w-[calc(100vw-2rem)]">
              <div className="mb-1.5 flex justify-between text-[13px]">
                <span className="text-ink-2">Đã xử lý</span>
                <span className="font-semibold text-ink tabular-nums">
                  {reviewed} / {suggestions.length} gợi ý
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Gợi ý đã xử lý"
                aria-valuemin={0}
                aria-valuemax={suggestions.length}
                aria-valuenow={reviewed}
                className="h-1.5 overflow-hidden rounded-full bg-ink/[0.08]"
              >
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out-soft"
                  style={{ width: `${(reviewed / suggestions.length) * 100}%` }}
                />
              </div>
            </div>
          ) : undefined
        }
      />

      {!editable && <FinalizedNote session={session} exportHref={exportHref} />}

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="paper-title" className="min-w-0 flex-[1.15_1_480px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-ink-3">
            <h2 id="paper-title" className="flex-1 text-base font-semibold text-ink">
              Bản xem trước CV
            </h2>
            {suggestions.length > 0 && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-gold-soft shadow-[inset_3px_0_0_var(--gold)]" aria-hidden />
                  Có gợi ý
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-good-soft" aria-hidden />
                  Đã áp dụng
                </span>
              </>
            )}
          </div>
          <div className="rounded-card border border-line bg-card px-5 py-[22px] shadow-card sm:px-10 sm:py-9">
            <CvDocumentView doc={preview} renderLine={renderLine} />
          </div>
        </section>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px]">
          <div id="suggestion-panel" className="scroll-mt-24">
            {current ? (
              <SuggestionCard
                key={`${current.id}-${current.status}-${current.proposed_text}`}
                suggestion={current}
                index={currentIndex + 1}
                total={suggestions.length}
                section={sections.get(current.line_id)}
                editable={editable}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onDecide={(d, text) => decide(current, d, text)}
                onProvideContext={(answer) => provideContext(current, answer)}
              />
            ) : (
              <NoSuggestions session={session} />
            )}
          </div>

          {session.pending_review_count > 0 && (
            <p className="flex items-start gap-2 text-[13px] leading-5 text-ink-3">
              <Clock className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {session.pending_review_count} gợi ý chưa đủ căn cứ trong CV nên đang chờ cố vấn xem lại, chưa hiển thị ở đây.
            </p>
          )}

          {session.capability_checks.length > 0 && (
            <section aria-labelledby="cap-title">
              <h2 id="cap-title" className="mb-1 text-base font-semibold text-ink">
                Kỹ năng JD cần mà CV chưa thể hiện
              </h2>
              <p className="mb-2.5 text-[13px] text-ink-3">AI không tự thêm kỹ năng vào CV. Hãy trả lời trung thực.</p>
              <div className="grid gap-2.5">
                {session.capability_checks.map((c) => (
                  <CapabilityCheckCard
                    key={`${c.id}-${c.status}-${c.learning_note ?? ""}-${c.context ?? ""}`}
                    check={c}
                    editable={editable}
                    onAnswer={(body) => answerCheck(c.id, body)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <BottomActionBar>
        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2.5">
          <span className="text-sm text-ink-2 tabular-nums">
            <b className="font-semibold text-ink">{counts.accepted + counts.edited}</b> áp dụng ·{" "}
            <b className="font-semibold text-ink">{counts.rejected}</b> bỏ qua ·{" "}
            <b className="font-semibold text-ink">{learning.length}</b> kỹ năng đang học
          </span>
          <span className="hidden flex-1 sm:block" />
          {editable ? (
            <>
              <span className={cn("text-[13px] text-ink-3", changeCount > 0 && "hidden md:inline")}>{finishHint}</span>
              <Button
                size="brand"
                className="max-sm:w-full"
                disabled={changeCount === 0}
                onClick={() => setConfirmOpen(true)}
              >
                Hoàn tất & tạo {newLabel}
                <ChevronRight aria-hidden />
              </Button>
            </>
          ) : (
            session.result_cv && (
              <Button size="brand" className="max-sm:w-full" nativeButton={false} render={<Link href={exportHref} />}>
                Xem & xuất CV {session.result_cv.label}
                <ArrowRight aria-hidden />
              </Button>
            )
          )}
        </div>
      </BottomActionBar>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={FileCheck2}
        title={`Tạo CV ${newLabel}?`}
        description={`Bản ${session.cv.label} vẫn được giữ nguyên.`}
        facts={[
          { label: "Áp dụng", value: counts.accepted },
          { label: "Bạn sửa", value: counts.edited },
          ...(learning.length > 0 ? [{ label: "Đang học", value: learning.length }] : []),
          { label: "Giữ câu gốc", value: counts.pending },
        ]}
        cancelLabel="Xem lại"
        confirmLabel={`Tạo ${newLabel}`}
        onConfirm={finalize}
      />
    </div>
  )
}

/** Một dòng CV có gợi ý trên bản xem trước: tô vàng khi chờ xét, xanh khi đã áp dụng; bấm để mở gợi ý. */
function PaperLine({
  line,
  suggestion: s,
  current,
  onPick,
}: {
  line: CvDocLine
  suggestion: Suggestion
  current: boolean
  onPick: () => void
}) {
  const pending = s.status === "pending"
  const applied = s.final_text !== null
  const tag = s.status === "edited" ? "Bạn đã sửa" : s.status === "accepted" ? "Đã áp dụng" : s.status === "rejected" ? "Đã bỏ qua" : null
  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={current || undefined}
      aria-label={`${line.text}. ${pending ? "Có gợi ý, bấm để xem" : (tag ?? "")}`}
      className={cn(
        "-mx-2.5 block w-[calc(100%+20px)] rounded-lg px-2.5 py-[5px] text-left transition-[background-color,box-shadow] duration-200 ease-out-soft",
        pending && "bg-gold-soft hover:bg-gold-soft/70",
        applied && "bg-good-soft",
        !pending && !applied && "hover:bg-panel",
        pending
          ? current
            ? "shadow-[inset_3px_0_0_var(--gold),0_0_0_2px_var(--ink)]"
            : "shadow-[inset_3px_0_0_var(--gold)]"
          : current && "shadow-[0_0_0_2px_var(--ink)]",
      )}
    >
      <span>{applied ? s.final_text : line.text}</span>
      {tag && (
        <span
          className={cn(
            "ml-2 inline-flex items-center rounded-md px-[7px] text-[11px] leading-[18px] font-medium whitespace-nowrap",
            applied ? "bg-card text-good" : "bg-surface text-ink-3",
          )}
        >
          {tag}
        </span>
      )}
    </button>
  )
}

function FinalizedNote({ session, exportHref }: { session: OptimizerSession; exportHref: string }) {
  return (
    <p className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-card bg-good-soft px-4 py-3 text-sm text-ink">
      <Lock className="mt-0.5 size-4 shrink-0 text-good" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">
        Bạn đã hoàn tất{session.finalized_at && ` ${formatWhen(session.finalized_at).toLowerCase()}`}
        {session.result_cv
          ? `, tạo phiên bản ${session.result_cv.label}. `
          : ". Phiên bản tạo ra đã bị xoá khỏi CV của tôi. "}
        Muốn tối ưu tiếp, hãy phân tích lại phiên bản mới với JD này.
      </span>
      {session.result_cv && (
        <Link href={exportHref} className="font-semibold text-blue hover:text-accent-strong">
          Xem phiên bản mới
        </Link>
      )}
    </p>
  )
}

function NoSuggestions({ session }: { session: OptimizerSession }) {
  return (
    <section className="rounded-card border border-line bg-card px-5 py-5 sm:px-[22px]">
      <h2 className="text-base font-semibold text-ink">Chưa có gợi ý diễn đạt lại</h2>
      <p className="mt-1.5 text-sm text-ink-2">
        {session.llm_used
          ? "AI chưa tìm thấy câu nào trong CV có thể diễn đạt rõ hơn cho vị trí này mà vẫn giữ đúng thông tin bạn đã viết."
          : "Lượt phân tích này được chấm bằng quy tắc dự phòng vì AI chưa sẵn sàng, nên chưa có gợi ý viết lại. Hãy phân tích lại khi AI hoạt động."}
      </p>
      {session.capability_checks.length > 0 && (
        <p className="mt-1.5 text-sm text-ink-2">Bạn vẫn có thể xác nhận các kỹ năng còn thiếu bên dưới.</p>
      )}
    </section>
  )
}
