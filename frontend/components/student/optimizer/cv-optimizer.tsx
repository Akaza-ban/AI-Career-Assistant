"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  FileCheck2,
  Loader2,
  Lock,
  RefreshCw,
  ScanText,
  Sparkles,
} from "lucide-react"
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
import { NEW_LINE_PREFIX, draftDocument, learningSkills, suggestionCounts } from "@/lib/cv-document"
import { formatWhen } from "@/lib/format"
import type {
  CapabilityAnswerRequest,
  CapabilityDraftRequest,
  CapabilityLineDecisionRequest,
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
  // Gợi ý viết lại được soạn riêng lần đầu mở trang (một lần gọi AI, backend lưu lại cho các lần sau)
  const prepareStarted = useRef(false)
  const [retrying, setRetrying] = useState(false)
  const [prepareFailed, setPrepareFailed] = useState(false)
  const suggestionsState = session?.suggestions_state
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

  useEffect(() => {
    if (suggestionsState !== "pending" || prepareStarted.current) return
    prepareStarted.current = true
    api
      .prepareOptimizerSuggestions(analysisId)
      .then(setUpdated)
      .catch(() => setPrepareFailed(true))
  }, [suggestionsState, analysisId])

  async function retryPrepare() {
    setRetrying(true)
    setPrepareFailed(false)
    try {
      setUpdated(await api.prepareOptimizerSuggestions(analysisId))
    } catch {
      setPrepareFailed(true)
    } finally {
      setRetrying(false)
    }
  }

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

  /** "Có, đã dùng": AI viết lời kể thành câu cho CV. Báo lỗi rồi ném lại để thẻ giữ nội dung đang nhập. */
  async function draftLine(id: string, body: CapabilityDraftRequest) {
    try {
      setUpdated(await api.draftCapabilityLine(analysisId, id, body))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa viết được câu. Hãy thử lại.")
      throw err
    }
  }

  async function decideLine(id: string, body: CapabilityLineDecisionRequest) {
    try {
      setUpdated(await api.decideCapabilityLine(analysisId, id, body))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được lựa chọn.")
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
  // Câu kinh nghiệm SV đã áp dụng cho kỹ năng còn thiếu (thêm vào CV khi Hoàn tất)
  const addedCount = session.capability_checks.filter((c) => c.final_text).length
  const changeCount = counts.accepted + counts.edited + learning.length + addedCount
  const reviewed = suggestions.length - counts.pending
  const current =
    suggestions.find((s) => s.id === currentId) ?? suggestions.find((s) => s.status === "pending") ?? suggestions[0]
  const currentIndex = current ? suggestions.indexOf(current) : -1
  const preparing = (session.suggestions_state === "pending" && !prepareFailed) || retrying
  const prepareError = !preparing && (session.suggestions_state === "failed" || prepareFailed)
  const kept = session.kept_count ?? 0
  const checkedNote =
    "Đã kiểm tra: giữ nguyên số thật, đúng ngôn ngữ dòng gốc, chỉ nhắc công cụ có trong cùng dự án." +
    (kept > 0 ? ` ${kept} câu đã rõ nên không cần sửa.` : "")
  const newLabel = nextLabel ?? "phiên bản mới"
  // Câu kinh nghiệm mới và kỹ năng đang học hiện ngay trong bản xem trước, đúng nội dung sẽ vào phiên bản mới.
  const preview = draftDocument(session)

  function goTo(id: string) {
    setCurrentId(id)
    document.getElementById("suggestion-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  function step(delta: number) {
    const n = suggestions.length
    setCurrentId(suggestions[(currentIndex + delta + n) % n].id)
  }

  function renderLine(line: CvDocLine) {
    if (line.id.startsWith(NEW_LINE_PREFIX)) {
      return (
        <div className="-mx-2.5 rounded-lg bg-good-soft px-2.5 py-[5px]">
          {line.text}
          <span className="ml-2 inline-flex items-center rounded-md bg-card px-[7px] font-sans text-[11px] leading-[18px] font-medium whitespace-nowrap text-good">
            Mới thêm
          </span>
        </div>
      )
    }
    const s = byLine.get(line.id)
    if (!s) return undefined
    return <PaperLine line={line} suggestion={s} current={s.id === current?.id} onPick={() => goTo(s.id)} />
  }

  const finishHint =
    changeCount === 0
      ? "Áp dụng ít nhất một gợi ý, thêm một câu kinh nghiệm hoặc ghi kỹ năng đang học"
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
            <h2 id="paper-title" className="flex-1 text-base font-semibold whitespace-nowrap text-ink">
              Bản xem trước CV
            </h2>
            {session.cv.read_by_ocr && (
              // Chữ đọc từ ảnh scan (OCR): sinh viên cần tự kiểm tra trước khi dùng file tải về
              <p className="flex w-full items-start gap-1.5 text-[12.5px] leading-[18px] text-warn sm:order-last md:order-none md:w-auto md:max-w-[440px]">
                <ScanText className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                CV được đọc từ ảnh scan nên có thể sai chính tả, dính chữ hoặc mất dấu. Hãy đối chiếu với file gốc và
                sửa lại trong file DOCX sau khi tải về.
              </p>
            )}
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
            {preparing ? (
              <PreparingSuggestions jobTitle={session.jd.title} />
            ) : prepareError ? (
              <PrepareFailed attemptedAt={session.suggestions_attempted_at} onRetry={retryPrepare} />
            ) : current ? (
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
                checkedNote={checkedNote}
              />
            ) : (
              <NoSuggestions session={session} />
            )}
          </div>

          {session.capability_checks.length > 0 && (
            <section aria-labelledby="cap-title">
              <h2 id="cap-title" className="mb-1 text-base font-semibold text-ink">
                Kỹ năng vị trí cần mà CV chưa có
              </h2>
              <p className="mb-3 text-[13px] text-ink-3">
                AI không tự thêm kỹ năng vào CV. Trả lời trung thực từng kỹ năng, mỗi lựa chọn dẫn tới một việc khác nhau:
              </p>
              {editable && <CapabilityLegend />}
              <div className="grid gap-2.5">
                {session.capability_checks.map((c) => (
                  <CapabilityCheckCard
                    key={`${c.id}-${c.status}-${c.learning_note ?? ""}-${c.context ?? ""}-${c.draft_text ?? ""}-${c.line_status ?? ""}-${c.final_text ?? ""}`}
                    check={c}
                    entries={session.entries ?? []}
                    editable={editable}
                    onAnswer={(body) => answerCheck(c.id, body)}
                    onDraft={(body) => draftLine(c.id, body)}
                    onDecide={(body) => decideLine(c.id, body)}
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
            {addedCount > 0 && (
              <>
                <b className="font-semibold text-ink">{addedCount}</b> câu kinh nghiệm mới ·{" "}
              </>
            )}
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
          ...(addedCount > 0 ? [{ label: "Câu mới", value: addedCount }] : []),
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
            "ml-2 inline-flex items-center rounded-md px-[7px] font-sans text-[11px] leading-[18px] font-medium whitespace-nowrap",
            applied ? "bg-card text-good" : "bg-surface text-ink-3",
          )}
        >
          {tag}
        </span>
      )}
    </button>
  )
}

/** Mỗi lựa chọn ở mục kỹ năng còn thiếu dẫn tới đâu (bản vẽ ToiUuKyNangA). */
function CapabilityLegend() {
  const rows = [
    {
      label: "Có, đã dùng",
      text: (
        <>
          Kể ngắn bạn đã dùng ở đâu, làm gì. AI viết thành <b className="font-semibold text-ink">một câu để bạn duyệt</b> rồi
          mới thêm vào CV; chỉ dùng đúng thông tin bạn viết.
        </>
      ),
    },
    {
      label: "Đang học",
      text: (
        <>
          Thêm vào mục <b className="font-semibold text-ink">Kỹ năng đang phát triển</b> cuối CV, không ghi là thành thạo.
        </>
      ),
    },
    { label: "Chưa có", text: "Không thêm gì vào CV. Gợi ý lộ trình học nếu có." },
  ]
  return (
    <dl className="mb-3 grid gap-2 rounded-[14px] bg-panel px-4 py-3.5 text-[13px] leading-[19px] text-ink-2">
      {rows.map((r) => (
        <div key={r.label} className="grid gap-x-2.5 gap-y-0.5 sm:grid-cols-[92px_minmax(0,1fr)]">
          <dt className="font-semibold text-ink">{r.label}</dt>
          <dd>{r.text}</dd>
        </div>
      ))}
    </dl>
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

const PREPARE_STEPS = [
  { until: 2, text: "Đọc các câu mô tả việc đã làm trong CV" },
  { until: 14, text: "Viết lại từng câu theo yêu cầu của JD" },
  { until: Infinity, text: "Kiểm tra: giữ số thật, đúng ngôn ngữ, không thêm công cụ" },
]

// Bản vẽ ToiUuDangSoan: lần đầu mở trình tối ưu, AI đang soạn gợi ý (thường 10–20 giây).
function PreparingSuggestions({ jobTitle }: { jobTitle: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  const active = PREPARE_STEPS.findIndex((step) => elapsed < step.until)

  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="rounded-card border border-line bg-card px-5 py-5 shadow-card sm:px-[22px]"
    >
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-accent-strong">
        <Sparkles className="size-[15px]" strokeWidth={1.75} aria-hidden />
        AI đang soạn gợi ý
      </p>
      <h2 className="mt-2 text-lg leading-[26px] font-semibold text-ink">Đang đọc từng câu trong CV của bạn</h2>
      <p className="mt-1.5 text-sm leading-[22px] text-ink-2">
        Gợi ý cách viết rõ hơn cho các câu trong Kinh nghiệm, Dự án và Hoạt động, theo yêu cầu của{" "}
        <span className="font-semibold text-ink">{jobTitle}</span>.
      </p>
      <ol className="my-4 grid gap-3 rounded-[14px] bg-panel px-4 py-3.5">
        {PREPARE_STEPS.map((step, i) => (
          <li key={step.text} className="flex items-start gap-2.5 text-sm">
            {i < active ? (
              <Check className="mt-0.5 size-4 shrink-0 text-good" strokeWidth={2.25} aria-label="Xong" />
            ) : i === active ? (
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-ink" aria-label="Đang làm" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" aria-hidden />
            )}
            <span className={cn(i > active ? "text-ink-3" : "text-ink", i === active ? "font-semibold" : "font-medium")}>
              {step.text}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[12.5px] leading-[18px] text-ink-3">
        Thường mất 10–20 giây. Chỉ soạn một lần; lần sau mở lại không phải chờ. Trong lúc chờ, bạn có thể trả lời phần
        kỹ năng còn thiếu bên dưới.
      </p>
      <div className="mt-[18px] grid gap-2.5 border-t border-line pt-4" aria-hidden>
        <Skeleton className="h-3 w-[38%] rounded-md" />
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-[86%] rounded-md" />
        <div className="mt-1 flex gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-[72px] rounded-full" />
        </div>
      </div>
    </section>
  )
}

// Bản vẽ ToiUuLoiGoiY: AI lỗi / hết lượt; CV không đổi, phần kỹ năng còn thiếu vẫn dùng được.
function PrepareFailed({ attemptedAt, onRetry }: { attemptedAt?: string | null; onRetry: () => void }) {
  return (
    <section role="alert" className="rounded-card border border-line bg-card px-5 py-5 shadow-card sm:px-[22px]">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-warn">
        <AlertCircle className="size-[15px]" strokeWidth={1.75} aria-hidden />
        Chưa soạn được gợi ý
      </p>
      <h2 className="mt-2 text-lg leading-[26px] font-semibold text-ink">AI đang bận hoặc đã hết lượt dùng hôm nay</h2>
      <p className="mt-1.5 text-sm leading-[22px] text-ink-2">
        CV của bạn không bị thay đổi. Bạn vẫn có thể trả lời phần kỹ năng còn thiếu bên dưới và hoàn tất; gợi ý viết lại
        có thể soạn lại sau.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button size="brand" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Thử lại
        </Button>
        {attemptedAt && <span className="text-[12.5px] text-ink-3">Lần thử gần nhất: {formatWhen(attemptedAt)}</span>}
      </div>
    </section>
  )
}
