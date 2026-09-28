"use client"

import Link from "next/link"
import { useCallback, useId, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  CircleX,
  FileCheck2,
  FileDown,
  FileText,
  Loader2,
  PenLine,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { CvDocumentView } from "@/components/student/cv-document-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { applySuggestions, suggestionCounts } from "@/lib/cv-document"
import { formatTime } from "@/lib/format"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Figma: frame "Xuất CV" (18:2242). Bước cuối của luồng Phân tích → Tối ưu → Xuất.
export function CvExport({ analysisId }: { analysisId: string }) {
  const fetchSession = useCallback(() => api.getOptimizerSession(analysisId), [analysisId])
  const { data: session, error, reload } = useApi(fetchSession)
  const [confirmed, setConfirmed] = useState(false)
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null)
  const checkboxId = useId()

  async function exportAs(format: "pdf" | "docx") {
    if (!session || !confirmed) return
    setExporting(format)
    try {
      const res = await api.exportCv(session.cv.id, { format, integrity_confirmed: true })
      if (res.download_url) {
        window.location.href = res.download_url
      } else {
        toast.info(`Đã ghi nhận cam kết lúc ${formatTime(res.confirmed_at)}`, {
          description: "Tải file sẽ hoạt động khi kết nối backend.",
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xuất được CV.")
    } finally {
      setExporting(null)
    }
  }

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được bản CV để xuất</p>
        <p className="text-sm text-ink-2">{error.message}</p>
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

  const finalDoc = applySuggestions(session.document, session.suggestions)
  const counts = suggestionCounts(session.suggestions)
  const optimizerHref = `/student/analysis/${encodeURIComponent(analysisId)}/optimize`
  const developing = session.document.skills.developing

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={optimizerHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Quay lại Trình tối ưu CV
        </Link>
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="size-2 rounded-full bg-good" aria-hidden />
          Mọi lựa chọn trong trình tối ưu đã được lưu vào hồ sơ
        </span>
      </div>

      <div className="grid gap-2">
        <Badge variant="blue" className="h-auto px-2.5 py-1">
          <ShieldCheck aria-hidden />
          Bước cuối: Kiểm định & Xuất bản
        </Badge>
        <h1 className="font-heading text-[32px] leading-10 font-extrabold">Xuất CV & Xác nhận Liêm chính</h1>
        <p className="text-ink-2">Kiểm tra định dạng chuẩn ATS lần cuối và ký cam kết trung thực trước khi xuất file.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 gap-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-2.5 text-xs shadow-card">
            <span className="flex items-center gap-2 text-ink-2">
              <FileText className="size-4 text-blue" aria-hidden />
              Bản xem trước
            </span>
            <Badge variant="blue">Phiên bản: {session.cv.label}</Badge>
          </div>
          <div className="rounded-[20px] border border-line bg-card px-8 py-10 shadow-float sm:px-12">
            <CvDocumentView doc={finalDoc} variant="paper" />
          </div>
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <Panel className="grid gap-4 p-5">
            <PanelHeader icon={Wand2} title="Tóm tắt thay đổi tối ưu" />
            <div className="grid grid-cols-3 gap-2">
              <CountTile value={counts.accepted} label="Đã chấp nhận" tone="text-good" />
              <CountTile value={counts.edited} label="Đã sửa tay" tone="text-blue" />
              <CountTile value={counts.rejected} label="Đã bỏ qua" tone="text-violet" />
            </div>
            {counts.pending > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-warn-soft/70 p-3 text-xs leading-5 text-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                <span>
                  Còn <strong>{counts.pending}</strong> gợi ý chưa duyệt. Các dòng đó sẽ giữ nguyên nội dung gốc.{" "}
                  <Link href={optimizerHref} className="font-medium text-blue hover:underline">
                    Duyệt tiếp
                  </Link>
                </span>
              </p>
            )}
            <ul className="grid gap-2 text-xs leading-5">
              {counts.accepted + counts.edited > 0 && (
                <li className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                  <span className="text-ink">Mọi thay đổi đều dựa trên dẫn chứng có trong CV gốc hoặc ngữ cảnh bạn cung cấp.</span>
                </li>
              )}
              {developing.length > 0 && (
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
                  <span className="text-ink">
                    Bảo vệ tính trung thực: {developing.map((d) => d.name).join(", ")} được ghi là đang học, không ghi là
                    thành thạo.
                  </span>
                </li>
              )}
            </ul>
          </Panel>

          {session.ats_score !== null && (
            <Panel className="grid gap-4 p-5">
              <PanelHeader icon={FileCheck2} title="Kiểm tra chuẩn ATS & Định dạng" />
              <div className="flex items-center gap-4 rounded-xl bg-surface p-3">
                <ScoreRing score={session.ats_score} size={72} strokeWidth={7} labelClassName="text-xl" />
                <p className="text-sm text-ink-2">
                  Điểm ATS của phiên bản gần nhất. Hệ thống sẽ chấm lại sau khi xuất file.
                </p>
              </div>
              <ul className="grid gap-2 text-[13px]">
                {session.ats_checks.map((c) => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.passed ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                    ) : (
                      <CircleX className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
                    )}
                    <span className="text-ink">{c.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel className="grid gap-4 p-5">
            <PanelHeader icon={PenLine} title="Cam kết Liêm chính học thuật (Bắt buộc)" />
            <label
              htmlFor={checkboxId}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 text-[13px] leading-5 text-ink transition-colors",
                confirmed ? "border-blue bg-blue-soft/50" : "border-line bg-surface",
              )}
            >
              <Checkbox
                id={checkboxId}
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
                className="mt-0.5"
              />
              <span>
                Tôi xác nhận toàn bộ nội dung trong bản CV này là kinh nghiệm, năng lực và thành tích học tập thật của bản
                thân, không chứa thông tin phóng đại hay bịa đặt số liệu. Tôi chịu hoàn toàn trách nhiệm trước nhà tuyển
                dụng và nhà trường.
              </span>
            </label>
            <div className="grid gap-2">
              <Button size="brand" disabled={!confirmed || exporting !== null} onClick={() => exportAs("pdf")}>
                {exporting === "pdf" ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                Tải file PDF (khuyến nghị cho ATS)
              </Button>
              <Button
                variant="soft"
                size="brand"
                disabled={!confirmed || exporting !== null}
                onClick={() => exportAs("docx")}
              >
                {exporting === "docx" ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
                Tải file DOCX (để chỉnh sửa thêm)
              </Button>
              {!confirmed && (
                <p className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Sparkles className="size-3.5" aria-hidden />
                  Tick vào ô cam kết để mở nút tải file.
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
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
