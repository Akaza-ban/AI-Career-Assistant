"use client"

import { useCallback, useEffect } from "react"
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { downloadCv } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"

type Preview = { kind: "pdf"; url: string } | { kind: "text"; text: string } | { kind: "unavailable" }

// Trình duyệt hiển thị được PDF; DOCX thì xem nhanh bằng văn bản đã trích.
async function loadPreview(cv: CvVersion): Promise<Preview> {
  if (cv.file_type === "pdf") {
    const blob = await api.getCvFile(cv.id)
    return blob ? { kind: "pdf", url: URL.createObjectURL(blob) } : { kind: "unavailable" }
  }
  const text = await api.getCvText(cv.id)
  return text !== null ? { kind: "text", text } : { kind: "unavailable" }
}

function PreviewBody({ cv }: { cv: CvVersion }) {
  const fetchPreview = useCallback(() => loadPreview(cv), [cv])
  const { data, error, reload } = useApi(fetchPreview)

  useEffect(() => {
    return () => {
      if (data?.kind === "pdf") URL.revokeObjectURL(data.url)
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
    return <iframe src={`${data.url}#view=FitH`} title={`Xem nhanh ${cv.file_name}`} className="size-full rounded-lg bg-surface" />
  }
  if (data.kind === "text") {
    return (
      <div className="h-full overflow-y-auto rounded-lg bg-surface p-5">
        <p className="mb-3 text-xs text-ink-3">
          Bản xem nhanh dạng văn bản (trình duyệt không hiển thị được DOCX). Tải file gốc để xem đúng bố cục.
        </p>
        <p className="text-sm leading-6 whitespace-pre-line text-ink">{data.text}</p>
      </div>
    )
  }
  return (
    <div className="grid h-full place-content-center justify-items-center gap-2 text-center text-sm text-ink-2">
      <FileText className="size-8 text-ink-3" aria-hidden />
      Bản demo chưa có file thật để xem trước.
    </div>
  )
}

interface CvPreviewDialogProps {
  /** CV đang xem; giữ nguyên khi đóng để popup không bị trống trong lúc chạy hiệu ứng đóng. */
  cv: CvVersion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Popup "Xem nhanh" giữa màn hình, xem CV ngay mà không mở tab mới. */
export function CvPreviewDialog({ cv, open, onOpenChange }: CvPreviewDialogProps) {
  return (
    <Dialog open={open && cv !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-3xl">
        {cv && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="truncate">{cv.file_name}</DialogTitle>
              <DialogDescription>
                {cv.label} · {cv.file_type.toUpperCase()} · {formatBytes(cv.size_bytes)}
                {cv.page_count ? ` · ${cv.page_count} trang` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="h-[70vh]">{open && <PreviewBody cv={cv} />}</div>
            <div className="flex justify-end">
              <Button variant="soft" className="h-9" onClick={() => void downloadCv(cv)}>
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
