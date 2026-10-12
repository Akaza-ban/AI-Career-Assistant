"use client"

import { useCallback, useEffect } from "react"
import { AlertCircle, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { saveBlob } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import type { AdvisorCv } from "@/lib/types"
import { useApi } from "@/lib/use-api"

type Preview = { kind: "pdf"; url: string } | { kind: "image"; url: string } | { kind: "text"; text: string }

// PDF và ảnh xem trực tiếp trong trình duyệt; DOCX (hoặc bản demo không có file) xem bằng văn bản đã trích.
async function loadPreview(studentId: string, cv: AdvisorCv): Promise<Preview> {
  if (cv.file_type === "pdf") {
    const blob = await api.getAdvisorCvFile(studentId, cv.id)
    if (blob) return { kind: "pdf", url: URL.createObjectURL(blob) }
  } else if (["png", "jpg", "jpeg"].includes(cv.file_type)) {
    const blob = await api.getAdvisorCvFile(studentId, cv.id)
    if (blob) return { kind: "image", url: URL.createObjectURL(blob) }
  }
  return { kind: "text", text: await api.getAdvisorCvText(studentId, cv.id) }
}

/** Tải file gốc của một CV SV đã chia sẻ. */
export async function downloadAdvisorCv(studentId: string, cv: AdvisorCv) {
  try {
    const blob = await api.getAdvisorCvFile(studentId, cv.id)
    if (blob) saveBlob(blob, cv.file_name)
    else toast.info(`Bản demo chưa có file thật để tải: ${cv.file_name}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không tải được file CV.")
  }
}

function PreviewBody({ studentId, cv }: { studentId: string; cv: AdvisorCv }) {
  const fetchPreview = useCallback(() => loadPreview(studentId, cv), [studentId, cv])
  const { data, error, reload } = useApi(fetchPreview)

  useEffect(() => {
    return () => {
      if (data?.kind === "pdf" || data?.kind === "image") URL.revokeObjectURL(data.url)
    }
  }, [data])

  if (error) {
    return (
      <div className="grid h-full place-content-center justify-items-center gap-3 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="grid h-full place-content-center justify-items-center gap-2 text-sm text-ink-2" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-blue" aria-hidden />
        Đang mở CV…
      </div>
    )
  }
  if (data.kind === "pdf") {
    return <iframe src={`${data.url}#view=FitH`} title={`Xem ${cv.file_name}`} className="size-full rounded-lg bg-surface" />
  }
  if (data.kind === "image") {
    return (
      <div className="flex h-full items-center justify-center overflow-auto rounded-lg bg-surface p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.url} alt={`Xem ${cv.file_name}`} className="max-h-full max-w-full rounded object-contain shadow" />
      </div>
    )
  }
  return (
    <div className="h-full overflow-y-auto rounded-lg bg-surface p-5">
      <p className="mb-3 text-xs text-ink-3">Bản xem nhanh dạng văn bản. Tải file gốc để xem đúng bố cục.</p>
      <p className="text-sm leading-6 whitespace-pre-line text-ink">{data.text}</p>
    </div>
  )
}

interface AdvisorCvDialogProps {
  studentId: string
  /** CV đang xem; null = đóng. */
  cv: AdvisorCv | null
  onClose: () => void
}

/** Xem CV SV đã chia sẻ (chỉ đọc). */
export function AdvisorCvDialog({ studentId, cv, onClose }: AdvisorCvDialogProps) {
  return (
    <Dialog open={cv !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-3 sm:max-w-3xl">
        {cv && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="truncate">{cv.file_name}</DialogTitle>
              <DialogDescription>
                {cv.label} · {cv.file_type.toUpperCase()} · {formatBytes(cv.size_bytes)}
                {cv.page_count ? ` · ${cv.page_count} trang` : ""} · Chế độ chỉ đọc
              </DialogDescription>
            </DialogHeader>
            <div className="h-[70vh]">
              <PreviewBody key={cv.id} studentId={studentId} cv={cv} />
            </div>
            <div className="flex justify-end">
              <Button variant="soft" className="h-9" onClick={() => void downloadAdvisorCv(studentId, cv)}>
                <Download aria-hidden />
                Tải file gốc
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
