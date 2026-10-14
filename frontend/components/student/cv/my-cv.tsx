"use client"

import { useMemo, useRef, useState } from "react"
import { AlertCircle, SearchX } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Panel } from "@/components/common/panel"
import { CvPreviewDialog } from "@/components/student/cv/cv-preview-dialog"
import {
  CvCard,
  CvDropzone,
  CvTips,
  CvToolbar,
  UploadStatusBanner,
  type CvSort,
} from "@/components/student/cv/cv-sections"
import { CV_ACCEPT, useCvUpload } from "@/components/student/cv/use-cv-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { useAgentActions } from "@/lib/use-agent-actions"

function deleteDescription(cv: CvVersion | null): string {
  const kept = "Các báo cáo phân tích đã tạo từ CV này vẫn được giữ trong lịch sử."
  if (cv && cv.version_count > 1) return `CV này có ${cv.version_count} phiên bản; tất cả sẽ bị xoá vĩnh viễn. ${kept}`
  return `Tệp CV sẽ bị xoá vĩnh viễn. ${kept}`
}

function sortCvs(list: CvVersion[], sort: CvSort): CvVersion[] {
  const copy = [...list]
  if (sort === "match") return copy.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1))
  if (sort === "name") return copy.sort((a, b) => a.file_name.localeCompare(b.file_name, "vi"))
  return copy.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
}

// Figma: frame "CV của tôi" (18:1835). US-SV-01.
export function MyCv() {
  const { data, error, reload } = useApi(api.listCvVersions)
  const inputRef = useRef<HTMLInputElement>(null)
  const { state: uploadState, upload, dismiss } = useCvUpload(() => reload())
  const uploading = uploadState.status === "uploading"

  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<CvSort>("recent")
  const [previewCv, setPreviewCv] = useState<CvVersion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleting, setDeleting] = useState<CvVersion | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  useAgentActions({
    fillFilter: (name, value) => {
      if (name === "keyword") {
        setQuery(String(value))
        return true
      }
      return false
    },
    openModal: (id) => {
      if (id !== "upload-cv-modal") return false
      setUploadOpen(true)
      return true
    },
    resetView: ({ clear_filters, close_modals }) => {
      if (clear_filters) { setQuery(""); setSort("recent") }
      if (close_modals) { setUploadOpen(false); setPreviewOpen(false); setDeleting(null) }
    },
  })

  const cvs = useMemo(() => data ?? [], [data])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortCvs(q ? cvs.filter((cv) => cv.file_name.toLowerCase().includes(q)) : cvs, sort)
  }, [cvs, query, sort])

  async function handleSetActive(cv: CvVersion) {
    try {
      await api.setActiveCv(cv.id)
      toast.success(`Đã đặt ${cv.file_name} làm CV đang dùng`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đổi được phiên bản đang dùng.")
    }
  }

  async function handleDelete(cv: CvVersion) {
    try {
      await api.deleteCv(cv.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xoá được CV.")
      throw err
    }
    toast.success(`Đã xoá ${cv.file_name}.`)
    reload()
  }

  function openPreview(cv: CvVersion) {
    setPreviewCv(cv)
    setPreviewOpen(true)
  }

  const openPicker = () => inputRef.current?.click()
  const hasCvs = cvs.length > 0

  return (
    <div className="grid gap-6">
      <input
        ref={inputRef}
        type="file"
        accept={CV_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          e.target.value = ""
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-[28px] leading-9 font-bold">CV của tôi</h1>
            {data && (
              <Badge variant="neutral" className="h-auto bg-blue-soft px-2.5 py-0.5 font-medium">
                {cvs.length} hồ sơ
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-2">Quản lý các phiên bản CV theo từng vị trí ứng tuyển.</p>
        </div>
        <CvTips />
      </div>

      <UploadStatusBanner state={uploadState} onDismiss={dismiss} />

      {error ? (
        <Panel className="grid justify-items-center gap-3 py-12 text-center">
          <AlertCircle className="size-8 text-bad" aria-hidden />
          <p className="font-heading font-bold">Không tải được danh sách CV</p>
          <p className="text-sm text-ink-2">{error.message}</p>
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
        </Panel>
      ) : !data ? (
        <div className="grid gap-6" aria-busy="true" aria-label="Đang tải danh sách CV">
          <Skeleton className="h-[84px] rounded-[20px]" />
          <Skeleton className="h-[52px] rounded-[20px]" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[470px] rounded-[20px]" />
            ))}
          </div>
        </div>
      ) : hasCvs ? (
        <>
          <CvDropzone onFile={(f) => void upload(f)} onBrowse={openPicker} disabled={uploading} />
          <CvToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />
          {visible.length > 0 ? (
            <div data-agent-target="cv-list" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((cv, index) => (
                <CvCard
                  key={cv.id}
                  cv={cv}
                  index={index}
                  onSetActive={handleSetActive}
                  onPreview={openPreview}
                  onDelete={setDeleting}
                  deleteBlocked={cv.is_active && cvs.length > 1}
                />
              ))}
            </div>
          ) : (
            <Panel className="grid justify-items-center gap-2 py-10 text-center">
              <SearchX className="size-6 text-ink-3" aria-hidden />
              <p className="text-sm font-medium">Không có CV nào khớp từ khoá</p>
              <Button variant="link" onClick={() => setQuery("")}>
                Xoá từ khoá
              </Button>
            </Panel>
          )}
        </>
      ) : (
        <CvDropzone onFile={(f) => void upload(f)} onBrowse={openPicker} disabled={uploading} prominent />
      )}

      <CvPreviewDialog cv={previewCv} open={previewOpen} onOpenChange={setPreviewOpen} />
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-xl" data-agent-target="upload-cv-modal">
          <DialogTitle>Tải lên CV</DialogTitle>
          <DialogDescription>Chọn file PDF hoặc DOCX từ máy tính để tạo phiên bản CV mới.</DialogDescription>
          <Button disabled={uploading} onClick={openPicker}>Chọn file từ máy tính</Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xoá ${deleting?.file_name ?? "CV"}?`}
        description={deleteDescription(deleting)}
        confirmLabel="Xoá CV"
        destructive
        onConfirm={() => (deleting ? handleDelete(deleting) : Promise.resolve())}
      />
    </div>
  )
}
