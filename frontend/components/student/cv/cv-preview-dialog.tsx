"use client"

import { useCallback } from "react"
import { Download } from "lucide-react"

import { CvViewer, loadCvView } from "@/components/common/cv-viewer"
import { studentCvSource } from "@/components/student/cv/cv-paper"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { downloadCv } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import type { CvVersion } from "@/lib/types"

/** Nội dung một phiên bản CV trong popup Xem nhanh: các tờ giấy trên nền xám, cuộn trong khung. */
export function CvPreviewBody({ cv }: { cv: CvVersion }) {
  const load = useCallback(() => loadCvView(studentCvSource(cv)), [cv])
  return (
    <div className="h-full overflow-y-auto rounded-xl bg-surface p-3 sm:p-5">
      <CvViewer load={load} fileName={cv.file_name} />
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
            <div className="h-[70vh]">{open && <CvPreviewBody cv={cv} />}</div>
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
