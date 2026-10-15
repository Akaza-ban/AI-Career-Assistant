"use client"

import { useCallback } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { CvViewer, loadCvView } from "@/components/common/cv-viewer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { saveBlob } from "@/lib/download"
import { formatBytes } from "@/lib/format"
import type { AdvisorCv } from "@/lib/types"

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

/** CV SV dạng các tờ giấy (ảnh trang PDF / nội dung theo mẫu CV), cuộn trong khung. */
function PreviewBody({ studentId, cv }: { studentId: string; cv: AdvisorCv }) {
  const load = useCallback(
    () =>
      loadCvView({
        preview: () => api.getAdvisorCvPreview(studentId, cv.id),
        page: (page) => api.getAdvisorCvPage(studentId, cv.id, page),
        text: () => api.getAdvisorCvText(studentId, cv.id),
      }),
    [studentId, cv],
  )
  return (
    <div className="h-full overflow-y-auto rounded-xl bg-surface p-3 sm:p-5">
      <CvViewer load={load} fileName={cv.file_name} />
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
