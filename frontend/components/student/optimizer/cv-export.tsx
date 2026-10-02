"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useId, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  Copy,
  FileDown,
  FileText,
  Loader2,
  PenLine,
  Printer,
  ScanText,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Panel, PanelHeader } from "@/components/common/panel"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { copyText } from "@/lib/clipboard"
import { suggestionCounts } from "@/lib/cv-document"
import { saveBlob } from "@/lib/download"
import type { CvVersion, ExportFormat, OptimizerSession } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Figma: frame "Xuất CV" (18:2242). Bước cuối của luồng Phân tích → Tối ưu → Xuất.
export function CvExport({ analysisId }: { analysisId: string }) {
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data: session, error, reload } = useApi(fetchSession)
  const optimizerHref = `/student/analysis/${encodeURIComponent(analysisId)}/optimize`

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được bản CV để xuất</p>
        <p className="max-w-md text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-28 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Skeleton className="h-[760px] rounded-[20px]" />
          <Skeleton className="h-[640px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  if (session.status === "draft" || !session.result_cv || !session.result_document) {
    return (
      <div className="grid gap-6">
        <BackLink href={optimizerHref} />
        <Panel className="grid justify-items-center gap-3 py-12 text-center">
          <Wand2 className="size-8 text-violet" aria-hidden />
          <p className="font-heading text-lg font-bold">
            {session.status === "draft" ? "Bạn chưa hoàn tất phiên tối ưu" : "Phiên bản CV đã bị xoá"}
          </p>
          <p className="max-w-md text-sm text-ink-2">
            {session.status === "draft"
              ? "Hãy xem các gợi ý và bấm “Hoàn tất & tạo phiên bản mới” trong Trình tối ưu CV. Phiên bản mới sẽ hiện ở đây để bạn xuất."
              : "Phiên bản tạo ra từ lượt tối ưu này không còn trong CV của tôi nên không xuất được."}
          </p>
          {session.status === "draft" && (
            <Button nativeButton={false} render={<Link href={optimizerHref} />}>
              <Wand2 aria-hidden />
              Về Trình tối ưu CV
            </Button>
          )}
        </Panel>
      </div>
    )
  }

  return <ExportView session={session} resultCv={session.result_cv} optimizerHref={optimizerHref} />
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-blue hover:underline">
      <ArrowLeft className="size-4" aria-hidden />
      Quay lại Trình tối ưu CV
    </Link>
  )
}

function ExportView({ session, resultCv, optimizerHref }: { session: OptimizerSession; resultCv: CvVersion; optimizerHref: string }) {
  const router = useRouter()
  const checkboxId = useId()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<ExportFormat | "reanalyze" | "activate" | null>(null)
  const [showText, setShowText] = useState(false)
  const [active, setActive] = useState(resultCv.is_active)
  const counts = suggestionCounts(session.suggestions)
  const changed = session.suggestions.filter((s) => s.final_text !== null)
  const developing = session.result_document!.developing_skills

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
      } else {
        setShowText(true)
        document.getElementById("changed-lines")?.scrollIntoView({ behavior: "smooth", block: "start" })
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

  async function copy(text: string, what: string) {
    if (await copyText(text)) toast.success(`Đã sao chép ${what}`)
    else toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.")
  }

  const allText = [
    ...changed.map((s) => s.final_text as string),
    ...developing.map((d) => `${d.name}: ${d.note}`),
  ].join("\n")

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink href={optimizerHref} />
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="size-2 rounded-full bg-good" aria-hidden />
          Đã lưu phiên bản {resultCv.label} trong CV của tôi · bản {session.cv.label} vẫn giữ trong lịch sử phiên bản
        </span>
      </div>

      <div className="grid gap-2">
        <Badge variant="blue" className="h-auto px-2.5 py-1">
          <ShieldCheck aria-hidden />
          Bước cuối: Cam kết & Xuất CV
        </Badge>
        <h1 className="font-heading text-[32px] leading-10 font-extrabold">Xuất CV & Xác nhận liêm chính</h1>
        <p className="text-ink-2">
          Xem lại phiên bản đã tối ưu, ký cam kết trung thực rồi chọn cách xuất phù hợp với bạn.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-xs shadow-card">
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <FileText className="size-4 shrink-0 text-blue" aria-hidden />
              <span className="truncate">Bản xem trước · {resultCv.file_name}</span>
            </span>
            <Badge variant="blue">Phiên bản {resultCv.label}</Badge>
          </div>
          <div data-print-root className="rounded-[20px] border border-line bg-card px-8 py-10 shadow-float sm:px-12">
            <CvDocumentView doc={session.result_document!} variant="paper" />
          </div>
          <p className="text-xs text-ink-2">
            Bố cục đơn giản dựng từ nội dung đã trích trong CV gốc, không giữ thiết kế của file ban đầu. Muốn giữ thiết kế
            cũ, hãy chọn &ldquo;Chỉ lấy các câu đã sửa&rdquo; rồi tự dán vào file CV của bạn.
          </p>
          {showText && (
            <ChangedLines
              changed={changed}
              developing={developing}
              onCopy={copy}
              onCopyAll={() => copy(allText, "tất cả nội dung đã sửa")}
            />
          )}
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <Panel className="grid gap-4 p-5">
            <PanelHeader icon={Wand2} title="Tóm tắt thay đổi" />
            <div className="grid grid-cols-3 gap-2">
              <CountTile value={counts.accepted} label="Đã chấp nhận" tone="text-good" />
              <CountTile value={counts.edited} label="Đã sửa tay" tone="text-blue" />
              <CountTile value={counts.rejected} label="Đã bỏ qua" tone="text-violet" />
            </div>
            {counts.pending > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-warn-soft/70 p-3 text-xs leading-5 text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                {counts.pending} gợi ý bạn chưa xem đã giữ nguyên câu gốc.
              </p>
            )}
            <ul className="grid gap-2 text-xs leading-5">
              {changed.length > 0 && (
                <li className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                  <span className="text-ink">Mọi câu thay đổi đều dựa trên dòng có sẵn trong CV gốc và đã được bạn duyệt.</span>
                </li>
              )}
              {developing.length > 0 && (
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
                  <span className="text-ink">
                    {developing.map((d) => d.name).join(", ")} được ghi là đang học, không ghi là thành thạo.
                  </span>
                </li>
              )}
            </ul>
          </Panel>

          <Panel className="grid gap-4 p-5">
            <PanelHeader icon={PenLine} title="Cam kết liêm chính (bắt buộc)" />
            <label
              htmlFor={checkboxId}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 text-[13px] leading-5 text-ink transition-colors",
                confirmed ? "border-blue bg-blue-soft/50" : "border-line bg-surface",
              )}
            >
              <Checkbox id={checkboxId} checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
              <span>
                Tôi xác nhận toàn bộ nội dung trong bản CV này là kinh nghiệm, năng lực và thành tích học tập thật của bản
                thân, không chứa thông tin phóng đại hay bịa đặt số liệu. Tôi chịu hoàn toàn trách nhiệm trước nhà tuyển
                dụng và nhà trường.
              </span>
            </label>
            <div className="grid gap-2">
              <Button size="brand" disabled={!confirmed || busy !== null} onClick={() => exportAs("docx")}>
                {busy === "docx" ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                Tải file DOCX
              </Button>
              <Button variant="soft" size="brand" disabled={!confirmed || busy !== null} onClick={() => exportAs("print")}>
                {busy === "print" ? <Loader2 className="animate-spin" aria-hidden /> : <Printer aria-hidden />}
                In / Lưu PDF
              </Button>
              <Button variant="soft" size="brand" disabled={!confirmed || busy !== null} onClick={() => exportAs("text")}>
                {busy === "text" ? <Loader2 className="animate-spin" aria-hidden /> : <Copy aria-hidden />}
                Chỉ lấy các câu đã sửa
              </Button>
              {!confirmed && (
                <p className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Sparkles className="size-3.5" aria-hidden />
                  Tick vào ô cam kết để mở các cách xuất.
                </p>
              )}
            </div>
          </Panel>

          <Panel className="grid gap-3 p-5">
            <PanelHeader icon={ScanText} title="Bước tiếp theo" />
            <p className="text-[13px] leading-5 text-ink-2">
              Phân tích lại phiên bản {resultCv.label} với JD {session.jd.title} để xem độ khớp mới. Kết quả cũng hiện ở phần
              Tiến bộ CV trong Lịch sử.
            </p>
            <Button className="h-10" disabled={busy !== null} onClick={reanalyze}>
              {busy === "reanalyze" ? <Loader2 className="animate-spin" aria-hidden /> : <ScanText aria-hidden />}
              Phân tích lại với JD này
            </Button>
            <Button variant="soft" className="h-10" disabled={active || busy !== null} onClick={activate}>
              {busy === "activate" ? <Loader2 className="animate-spin" aria-hidden /> : <Star aria-hidden />}
              {active ? `${resultCv.label} là CV đang dùng` : "Đặt làm CV đang dùng"}
            </Button>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function ChangedLines({
  changed,
  developing,
  onCopy,
  onCopyAll,
}: {
  changed: OptimizerSession["suggestions"]
  developing: { name: string; note: string }[]
  onCopy: (text: string, what: string) => void
  onCopyAll: () => void
}) {
  return (
    <Panel id="changed-lines" className="grid scroll-mt-24 gap-4">
      <PanelHeader
        icon={Copy}
        title="Các câu đã sửa"
        aside={
          <Button size="sm" variant="soft" onClick={onCopyAll}>
            <Copy aria-hidden />
            Sao chép tất cả
          </Button>
        }
      />
      <p className="-mt-2 text-xs text-ink-2">Tìm câu cũ trong file CV của bạn và thay bằng câu mới.</p>
      <ul className="grid gap-3">
        {changed.map((s) => (
          <li key={s.id} className="grid gap-1.5 rounded-xl border border-line p-3 text-[13px] leading-5">
            <p className="text-ink-2">
              <span className="font-semibold text-bad">Câu cũ: </span>
              {s.original_text}
            </p>
            <p className="text-ink">
              <span className="font-semibold text-good">Câu mới: </span>
              {s.final_text}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start text-blue hover:bg-blue-soft hover:text-blue"
              onClick={() => onCopy(s.final_text as string, "câu mới")}
            >
              <Copy aria-hidden />
              Sao chép câu mới
            </Button>
          </li>
        ))}
        {developing.length > 0 && (
          <li className="grid gap-1.5 rounded-xl border border-line p-3 text-[13px] leading-5">
            <p className="font-semibold text-violet">Thêm mục &ldquo;Kỹ năng đang phát triển&rdquo;:</p>
            {developing.map((d) => (
              <p key={d.name} className="text-ink">
                {d.name}: {d.note}
              </p>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start text-blue hover:bg-blue-soft hover:text-blue"
              onClick={() => onCopy(developing.map((d) => `${d.name}: ${d.note}`).join("\n"), "kỹ năng đang phát triển")}
            >
              <Copy aria-hidden />
              Sao chép
            </Button>
          </li>
        )}
      </ul>
    </Panel>
  )
}

function CountTile({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="grid gap-0.5 rounded-xl bg-surface p-3">
      <span className={cn("font-heading text-2xl font-extrabold", tone)}>{value}</span>
      <span className="text-xs text-ink-2">{label}</span>
    </div>
  )
}
