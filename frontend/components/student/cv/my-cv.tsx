"use client"

import { useMemo, useRef, useState } from "react"
import { AlertCircle, SearchX } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Zone } from "@/components/common/zone"
import { CvPreviewDialog } from "@/components/student/cv/cv-preview-dialog"
import {
  CvCard,
  CvDropzone,
  CvTips,
  CvToolbar,
  deleteDescription,
  RetryButton,
  type CvSort,
} from "@/components/student/cv/cv-sections"
import { CV_ACCEPT, useCvUpload } from "@/components/student/cv/use-cv-upload"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"
import { useAgentActions } from "@/lib/use-agent-actions"
import { useApi } from "@/lib/use-api"

function sortCvs(list: CvVersion[], sort: CvSort): CvVersion[] {
  const copy = [...list]
  if (sort === "match") return copy.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1))
  if (sort === "name") return copy.sort((a, b) => a.file_name.localeCompare(b.file_name, "vi"))
  return copy.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
}

const GRID = "grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))]"

// Kiểu dashboard Stripe (DESIGN.md 3.6): tiêu đề trang + vùng kéo thả, rồi vùng "Tất cả CV", mẹo dạng gập ở cuối.
// US-SV-01. Không có nút "Tải CV lên" ở tiêu đề vì vùng kéo thả đã có nút chọn file.
export function MyCv() {
  const { data, error, reload } = useApi(api.listCvVersions)
  const inputRef = useRef<HTMLInputElement>(null)
  const { state: uploadState, upload, dismiss } = useCvUpload(() => reload())

  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<CvSort>("recent")
  const [previewCv, setPreviewCv] = useState<CvVersion | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleting, setDeleting] = useState<CvVersion | null>(null)
  // Trợ lý AI không mở được hộp chọn file khi chưa có thao tác của người dùng, nên mở hộp thoại có nút chọn file.
  const [uploadOpen, setUploadOpen] = useState(false)

  useAgentActions({
    fillFilter: (name, value) => {
      if (name !== "keyword") return false
      setQuery(String(value))
      return true
    },
    openModal: (id) => {
      if (id !== "upload-cv-modal") return false
      setUploadOpen(true)
      return true
    },
    resetView: ({ clear_filters, close_modals }) => {
      if (clear_filters) {
        setQuery("")
        setSort("recent")
      }
      if (close_modals) {
        setUploadOpen(false)
        setPreviewOpen(false)
        setDeleting(null)
      }
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
      toast.error(err instanceof Error ? err.message : "Không đổi được CV đang dùng.")
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
  const dropzone = (
    <CvDropzone
      onFile={(f) => void upload(f)}
      onBrowse={openPicker}
      state={uploadState}
      onDismiss={dismiss}
      prominent={Boolean(data) && !hasCvs}
    />
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-16">
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:gap-11">
        <PageHeader title="CV của tôi" description="Quản lý các phiên bản CV theo từng vị trí ứng tuyển." />
        {error ? null : !data ? <Skeleton className="h-[94px] rounded-card" /> : dropzone}
      </div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-4 sm:px-5">
          <AlertCircle className="size-5 shrink-0 text-bad" strokeWidth={1.75} aria-hidden />
          <p className="min-w-0 flex-1 basis-48 text-sm text-ink-2">Không tải được danh sách CV. {error.message}</p>
          <RetryButton onClick={reload} />
        </div>
      ) : !data ? (
        <div className="grid gap-7" aria-busy="true" aria-label="Đang tải danh sách CV">
          <Skeleton className="h-8 w-40" />
          <div className={GRID}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[284px] rounded-card" />
            ))}
          </div>
        </div>
      ) : (
        hasCvs && (
          <Zone
            id="all-cv-title"
            title="Tất cả CV"
            aside={<CvToolbar query={query} onQueryChange={setQuery} sort={sort} onSortChange={setSort} />}
          >
            {visible.length > 0 ? (
              <div data-agent-target="cv-list" className={GRID}>
                {visible.map((cv) => (
                  <CvCard
                    key={cv.id}
                    cv={cv}
                    onSetActive={handleSetActive}
                    onPreview={openPreview}
                    onDelete={setDeleting}
                    deleteBlocked={cv.is_active && cvs.length > 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={SearchX}
                title="Không có CV nào khớp từ khoá"
                description={`Không tìm thấy CV có tên chứa "${query.trim()}".`}
                action={
                  <Button variant="soft" className="h-9 rounded-full px-4" onClick={() => setQuery("")}>
                    Xoá từ khoá
                  </Button>
                }
              />
            )}
          </Zone>
        )
      )}

      {data && <CvTips />}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md" data-agent-target="upload-cv-modal">
          <DialogTitle>Tải CV lên</DialogTitle>
          <DialogDescription>Chọn file PDF, DOCX hoặc ảnh chụp CV (PNG, JPG) từ máy tính để tạo CV mới.</DialogDescription>
          <Button
            size="brand"
            onClick={() => {
              setUploadOpen(false)
              openPicker()
            }}
          >
            Chọn file từ máy tính
          </Button>
        </DialogContent>
      </Dialog>
      <CvPreviewDialog cv={previewCv} open={previewOpen} onOpenChange={setPreviewOpen} />
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
