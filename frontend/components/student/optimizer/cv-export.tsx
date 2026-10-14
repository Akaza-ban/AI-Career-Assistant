"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { AlertCircle, Check, ChevronRight, Copy, Download, Loader2, Printer, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { RateRow } from "@/components/common/rate-dialog"
import { Zone } from "@/components/common/zone"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { sectionByLine } from "@/components/student/optimizer/cv-optimizer"
import { diffAdded } from "@/components/student/optimizer/text-diff"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { copyText } from "@/lib/clipboard"
import { suggestionCounts } from "@/lib/cv-document"
import { saveBlob } from "@/lib/download"
import type { CvVersion, ExportFormat, OptimizerSession } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Bản vẽ XuatCV (Xuất CV). Bước cuối của luồng Phân tích → Tối ưu → Xuất.
export function CvExport({ analysisId }: { analysisId: string }) {
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data: session, error, reload } = useApi(fetchSession)
  const optimizerHref = `/student/analysis/${encodeURIComponent(analysisId)}/optimize`

  if (error) {
    return (
      <section
        role="alert"
        className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-3 rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card"
      >
        <AlertCircle className="size-7 text-bad" aria-hidden />
        <h1 className="text-lg font-semibold text-ink">Không tải được bản CV để xuất</h1>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button size="brand" onClick={reload}>
          Thử lại
        </Button>
      </section>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-10" aria-busy="true" aria-label="Đang tải">
        <div className="grid gap-3 pt-8 pb-2 md:pt-12">
          <Skeleton className="h-9 w-2/3 max-w-md rounded-xl md:h-[46px]" />
          <Skeleton className="h-6 w-1/2 max-w-sm rounded-lg" />
        </div>
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-14">
          <Skeleton className="h-[520px] rounded-card" />
          <Skeleton className="h-[300px] rounded-card" />
        </div>
      </div>
    )
  }

  if (session.status === "draft" || !session.result_cv || !session.result_document) {
    const draft = session.status === "draft"
    return (
      <div className="grid gap-6">
        <PageHeader title="Xuất CV" description={session.cv.file_name} />
        <EmptyState
          icon={Wand2}
          className="rounded-card border border-line"
          title={draft ? "Bạn chưa hoàn tất phiên tối ưu" : "Phiên bản CV đã bị xoá"}
          description={
            draft
              ? "Hãy xét các gợi ý rồi bấm “Hoàn tất & tạo phiên bản” trong Trình tối ưu CV. Phiên bản mới sẽ hiện ở đây để bạn xuất."
              : "Phiên bản tạo ra từ lượt tối ưu này không còn trong CV của tôi nên không xuất được."
          }
          action={
            draft && (
              <Button size="brand" nativeButton={false} render={<Link href={optimizerHref} />}>
                Về Trình tối ưu CV
              </Button>
            )
          }
        />
      </div>
    )
  }

  return <ExportView session={session} resultCv={session.result_cv} optimizerHref={optimizerHref} />
}


function ExportView({ session, resultCv, optimizerHref }: { session: OptimizerSession; resultCv: CvVersion; optimizerHref: string }) {
  const router = useRouter()
  const checkboxId = useId()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | "reanalyze" | "activate" | null>(null)
  const [active, setActive] = useState(resultCv.is_active)
  const counts = suggestionCounts(session.suggestions)
  const changed = session.suggestions.filter((s) => s.final_text !== null)
  const developing = session.result_document!.developing_skills
  const sections = sectionByLine(session.document)
  const developingText = developing.map((d) => `${d.name}: ${d.note}`).join("\n")
  const allText = [...changed.map((s) => s.final_text as string), ...(developingText ? [developingText] : [])].join("\n")
  const interviewHref = `/student/interview/new?jd=${encodeURIComponent(session.jd.id)}`

  async function exportAs(format: ExportFormat) {
    if (!confirmed) return
    setBusy(format)
    try {
      await api.exportCv(resultCv.id, { format, integrity_confirmed: true })
      if (format === "docx") {
        const blob = await api.getCvFile(resultCv.id)
        if (blob) saveBlob(blob, resultCv.file_name)
        else toast.info(`Đã ghi nhận cam kết. Bản demo chưa có file thật để tải: ${resultCv.file_name}`)
      } else if (format === "print") {
        window.print()
      } else if (await copyText(allText)) {
        toast.success("Đã chép toàn bộ nội dung đã sửa")
      } else {
        toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xuất được CV.")
    } finally {
      setBusy(null)
    }
  }

  async function reanalyze() {
    setBusy("reanalyze")
    try {
      const analysis = await api.createGapAnalysis({ cv_version_id: resultCv.id, jd_id: session.jd.id })
      router.push(`/student/analysis/${encodeURIComponent(analysis.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bắt đầu phân tích được.")
      setBusy(null)
    }
  }

  async function activate() {
    setBusy("activate")
    try {
      await api.setActiveCv(resultCv.id)
      setActive(true)
      toast.success(`Đã đặt ${resultCv.label} làm CV đang dùng`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đặt được CV đang dùng.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-8 md:gap-11">
      <PageHeader
        title="Xuất CV"
        description={resultCv.file_name}
        actions={
          <Button variant="soft" size="brand" nativeButton={false} render={<Link href={optimizerHref} />}>
            Quay lại trình tối ưu
          </Button>
        }
      />

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:gap-14">
        <Zone
          id="changed-lines"
          title="Các câu đã sửa"
          aside={<span className="text-sm text-ink-3">Tìm câu cũ trong file CV và thay bằng câu mới</span>}
          className="min-w-0 [&>div:last-child]:pt-0"
        >
          {changed.length === 0 && developing.length === 0 ? (
            <p className="py-6 text-sm text-ink-3">Phiên bản này chưa có câu nào thay đổi.</p>
          ) : (
            <ol>
              {changed.map((s, i) => (
                <ChangeRow
                  key={s.id}
                  no={i + 1}
                  section={sections.get(s.line_id) ?? "Câu đã sửa"}
                  copyText={s.final_text as string}
                >
                  <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[15px] leading-6">
                    <span className="text-[13px] text-ink-3">Cũ</span>
                    <span className="text-ink-3 line-through decoration-line-strong">{s.original_text}</span>
                    <span className="text-[13px] text-ink-3">Mới</span>
                    <span className="text-ink">
                      {diffAdded(s.original_text, s.final_text as string).map((part, k) =>
                        part.added ? (
                          <mark key={k} className="rounded bg-accent-soft px-0.5 text-ink">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={k}>{part.text}</span>
                        ),
                      )}
                    </span>
                  </div>
                </ChangeRow>
              ))}
              {developing.length > 0 && (
                <ChangeRow no={changed.length + 1} section="Mục mới" copyText={developingText}>
                  <p className="text-[15px] leading-6 text-ink">
                    Thêm mục <b className="font-semibold">Kỹ năng đang phát triển</b>:{" "}
                    {developing.map((d) => `${d.name} (${d.note})`).join(", ")}
                  </p>
                </ChangeRow>
              )}
            </ol>
          )}
          <div className="flex flex-wrap gap-x-8 gap-y-2 pt-5 text-sm text-ink-2">
            <Stat value={changed.length} label="câu đã sửa" />
            <Stat value={developing.length} label="kỹ năng đang phát triển" />
            {counts.pending > 0 && <Stat value={counts.pending} label="gợi ý chưa xét, giữ câu gốc" />}
            <Stat value={0} label="thông tin AI tự thêm" />
          </div>
        </Zone>

        <aside className="grid min-w-0 items-start gap-9 md:grid-cols-2 xl:sticky xl:top-24 xl:grid-cols-1">
          <section aria-labelledby="download-title" className="rounded-card bg-card p-[22px] shadow-[var(--shadow-sm-token),0_0_0_1px_var(--line)]">
            <h2 id="download-title" className="text-base font-semibold text-ink">
              Tải CV đã sửa
            </h2>
            <label
              htmlFor={checkboxId}
              className="mt-4 flex cursor-pointer gap-3 rounded-xl bg-panel p-3.5 text-sm text-ink-2"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-[18px] shrink-0 accent-ink"
              />
              Tôi xác nhận mọi thông tin trong CV là sự thật và do tôi tự kiểm tra.
            </label>
            <div className="mt-4 grid gap-2.5">
              <Button size="brand" className="w-full" disabled={!confirmed || busy !== null} onClick={() => exportAs("docx")}>
                {busy === "docx" ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                Tải file DOCX
              </Button>
              <Button
                variant="outline"
                size="brand"
                className="w-full border-line-strong"
                disabled={!confirmed || busy !== null}
                onClick={() => exportAs("text")}
              >
                {busy === "text" ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />}
                Chép toàn bộ
              </Button>
              <button
                type="button"
                disabled={!confirmed || busy !== null}
                onClick={() => exportAs("print")}
                className="inline-flex items-center justify-center gap-1.5 pt-1 text-[13px] font-semibold text-ink-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                {busy === "print" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Printer className="size-3.5" aria-hidden />}
                Hoặc in / lưu PDF
              </button>
            </div>
          </section>

          <section aria-labelledby="next-title">
            <h2 id="next-title" className="mb-1.5 text-base font-semibold text-ink">
              Bước tiếp theo
            </h2>
            <NextRow onClick={reanalyze} busy={busy === "reanalyze"} disabled={busy !== null}>
              Phân tích lại với CV {resultCv.label}
            </NextRow>
            <NextRow href={interviewHref}>Luyện phỏng vấn cho vị trí này</NextRow>
            {!active && (
              <NextRow onClick={activate} busy={busy === "activate"} disabled={busy !== null}>
                Đặt {resultCv.label} làm CV đang dùng
              </NextRow>
            )}
          </section>

          {/* US-SV-06: đánh giá trình tối ưu sau khi Hoàn tất; một lần cho mỗi lượt tối ưu */}
          <RateRow
            responseId={`opt_${session.analysis_id}`}
            activity="optimizer"
            title="Đánh giá trình tối ưu CV"
            subtitle={`Lần tối ưu tạo CV ${resultCv.label} · ${session.jd.title}`}
            question="Trình tối ưu CV có giúp được bạn?"
            buttonLabel="Đánh giá trình tối ưu"
            doneLabel="trình tối ưu"
            stacked
            className="border-t border-line pt-6 md:col-span-2 xl:col-span-1"
          />
        </aside>
      </div>

      {/* Chỉ hiện khi in: "In / lưu PDF" in đúng bản CV mới (xem @media print trong globals.css). */}
      <div data-print-root className="hidden print:block">
        <CvDocumentView doc={session.result_document!} />
      </div>
    </div>
  )
}

function ChangeRow({
  no,
  section,
  copyText: text,
  children,
}: {
  no: number
  section: string
  copyText: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    if (await copyText(text)) {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.")
    }
  }

  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-line py-[18px] sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:gap-x-3.5">
      <span className="pt-px text-sm font-semibold text-ink-3 tabular-nums">{no}</span>
      <div className="min-w-0">
        <div className="mb-1.5 text-xs text-ink-3">{section}</div>
        {children}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Đã chép câu mới" : "Chép câu mới"}
        className={cn(
          "col-start-2 inline-flex h-8 items-center gap-1.5 justify-self-start rounded-full px-3 text-[13px] font-semibold transition-[transform,background-color,color] active:scale-[0.97] sm:col-start-3 sm:self-start",
          copied
            ? "bg-good-soft text-good shadow-[inset_0_0_0_1px_var(--good-line)]"
            : "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel",
        )}
      >
        {copied ? <Check className="size-3.5" strokeWidth={2} aria-hidden /> : <Copy className="size-3.5" strokeWidth={1.75} aria-hidden />}
        <span aria-live="polite">{copied ? "Đã chép" : "Chép"}</span>
      </button>
    </li>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <b className="font-semibold text-ink tabular-nums">{value}</b> {label}
    </span>
  )
}

const ROW =
  "-mx-2.5 flex w-[calc(100%+20px)] items-center gap-3 border-b border-line px-2.5 py-[13px] text-left font-medium text-ink transition-colors hover:bg-panel disabled:pointer-events-none disabled:opacity-60"

function NextRow({
  href,
  onClick,
  busy,
  disabled,
  children,
}: {
  href?: string
  onClick?: () => void
  busy?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  const inner = (
    <>
      <span className="flex-1">{children}</span>
      {busy ? (
        <Loader2 className="size-4 animate-spin text-ink-3" aria-hidden />
      ) : (
        <ChevronRight className="size-4 text-ink-3" aria-hidden />
      )}
    </>
  )
  if (href) {
    return (
      <Link href={href} className={ROW}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={ROW}>
      {inner}
    </button>
  )
}
