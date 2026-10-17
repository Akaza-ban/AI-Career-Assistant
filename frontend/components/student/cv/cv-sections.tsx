"use client"

import Link from "next/link"
import { useEffect, useState, type DragEvent } from "react"
import {
  AlertCircle,
  ChevronDown,
  Download,
  Eye,
  History,
  Loader2,
  MoreHorizontal,
  ScanText,
  Search,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { MatchBadge } from "@/components/common/match-badge"
import { CV_MAX_MB, type UploadState } from "@/components/student/cv/use-cv-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatPercent } from "@/lib/analysis"
import { OPTIMIZER_AVAILABLE } from "@/lib/config"
import { downloadCv } from "@/lib/download"
import { features } from "@/lib/features"
import { formatBytes } from "@/lib/format"
import type { CvVersion, MatchLabel } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Trung bình (< 50) / Khá (50–74) / Cao (≥ 75), DESIGN.md mục 8.2. */
export const matchLabelOf = (score: number): MatchLabel => (score >= 75 ? "high" : score >= 50 ? "medium" : "low")

export const cvDetailHref = (cv: CvVersion) => `/student/cv/${encodeURIComponent(cv.family_id)}`
export const cvAnalyzeHref = (cv: CvVersion) => `/student/analysis/new?cv=${encodeURIComponent(cv.id)}`

/** "v2.1 · 3 phiên bản" */
export function versionMeta(cv: CvVersion): string {
  return cv.version_count > 1 ? `${cv.label} · ${cv.version_count} phiên bản` : cv.label
}

/** Nội dung hộp xác nhận xoá CV. */
export function deleteDescription(cv: CvVersion | null): string {
  const kept = "Các báo cáo phân tích đã tạo từ CV này vẫn được giữ trong lịch sử."
  if (cv && cv.version_count > 1) return `CV này có ${cv.version_count} phiên bản; tất cả sẽ bị xoá vĩnh viễn. ${kept}`
  return `Tệp CV sẽ bị xoá vĩnh viễn. ${kept}`
}

// ---------- Vùng kéo thả ----------

interface CvDropzoneProps {
  onFile: (file: File) => void
  onBrowse: () => void
  state: UploadState
  onDismiss: () => void
  /** Dạng lớn khi chưa có CV nào; ngược lại là dạng gọn một dòng phía trên danh sách. */
  prominent?: boolean
}

const hasFiles = (e: globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")

/**
 * Vùng kéo thả nét đứt: viền sáng lên màu nhấn khi rê chuột hoặc kéo file vào. Khi đang tải lên, nội dung vùng đổi
 * thành tên file + thanh chạy; lỗi hiện ngay bên dưới.
 */
export function CvDropzone({ onFile, onBrowse, state, onDismiss, prominent }: CvDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const uploading = state.status === "uploading"

  // Thả file lệch ra ngoài vùng thì trình duyệt sẽ mở file và rời trang; chặn lại khi đang ở trang này.
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    window.addEventListener("dragover", block)
    window.addEventListener("drop", block)
    return () => {
      window.removeEventListener("dragover", block)
      window.removeEventListener("drop", block)
    }
  }, [])

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = uploading ? "none" : "copy"
    if (!uploading) setDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    // Bỏ qua khi con trỏ chỉ đi qua phần tử con bên trong vùng thả.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (uploading) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) {
      toast.info("Hãy kéo thả file PDF hoặc DOCX (ví dụ từ thư mục trên máy), không phải liên kết hay đoạn văn bản.")
      return
    }
    if (files.length > 1) toast.info(`Mỗi lần chỉ tải lên một file. Đã chọn ${files[0].name}.`)
    onFile(files[0])
  }

  const browse = (
    <button
      data-agent-target="btn-upload-cv" data-assistant-id="btn-upload-cv"
      type="button"
      onClick={onBrowse}
      disabled={uploading}
      className="inline-flex h-8 items-center justify-center rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,transform] duration-150 hover:bg-panel active:scale-[.97] disabled:pointer-events-none disabled:opacity-50"
    >
      Chọn file
    </button>
  )
  const icon = (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-ink-2 shadow-xs">
      {uploading ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden />
      ) : (
        <Upload className="size-4" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  )

  return (
    <div className="grid gap-2.5">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-busy={uploading || undefined}
        className={cn(
          "rounded-card border-[1.5px] border-dashed px-5 text-center transition-colors duration-150",
          prominent ? "py-14" : "py-[26px]",
          dragging ? "border-blue bg-blue-soft" : "border-line-strong bg-card/60",
          !uploading && "hover:border-blue hover:bg-blue-soft",
        )}
      >
        {uploading ? (
          <div className="mx-auto grid max-w-md justify-items-center gap-3" role="status" aria-live="polite">
            {icon}
            <p className="max-w-full min-w-0 text-sm text-ink">
              <span className="font-semibold [overflow-wrap:anywhere]">{state.fileName}</span>
              <span className="text-ink-3"> · {formatBytes(state.size)}</span>
            </p>
            <p className="text-sm text-ink-2">
              {state.slow
                ? "Đang đọc chữ trong CV. Bản scan cần thêm vài giây…"
                : "Đang tải lên và trích xuất nội dung CV…"}
            </p>
            <div className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-surface" aria-hidden>
              <div className="ai-run h-full w-full rounded-full" />
            </div>
          </div>
        ) : prominent ? (
          <div className="mx-auto grid max-w-md justify-items-center gap-1.5">
            {icon}
            <p className="mt-2 text-base font-semibold text-ink">
              {dragging ? "Thả file vào đây để tải lên" : "Tải CV đầu tiên của bạn lên"}
            </p>
            <p className="text-sm text-ink-2">
              Kéo thả file PDF hoặc DOCX vào đây, hoặc chọn từ máy tính. Tối đa {CV_MAX_MB} MB.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
              {browse}
              {features.driveImport && <span className="text-[13px] text-ink-3">hoặc nhập từ Google Drive</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5">
            {icon}
            <span className="font-medium text-ink">
              {dragging ? "Thả file vào đây để tải lên" : "Kéo thả file PDF hoặc DOCX vào đây"}
            </span>
            <span className="text-ink-3">hoặc</span>
            {browse}
            <span className="text-[13px] text-ink-3">Tối đa {CV_MAX_MB} MB</span>
          </div>
        )}
      </div>

      {state.status === "error" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card border border-bad/20 bg-bad-soft px-4 py-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-bad" strokeWidth={1.75} aria-hidden />
          <p className="min-w-0 flex-1 text-ink-2">
            <span className="font-semibold text-bad">Tải lên thất bại</span>
            <span className="[overflow-wrap:anywhere]">
              {" "}
              · {state.fileName} ({formatBytes(state.size)}).
            </span>{" "}
            {state.message}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng thông báo lỗi"
            className="-my-1 -mr-1.5 grid size-7 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-card hover:text-ink"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Tìm kiếm / sắp xếp ----------

export type CvSort = "recent" | "match" | "name"

const sortItems = [
  { value: "recent", label: "Cập nhật gần nhất" },
  { value: "match", label: "Độ khớp cao nhất" },
  { value: "name", label: "Tên file A–Z" },
]

interface CvToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  sort: CvSort
  onSortChange: (value: CvSort) => void
}

/** Ô tìm kiếm + sắp xếp, đặt ở góc phải tiêu đề vùng "Tất cả CV". */
export function CvToolbar({ query, onQueryChange, sort, onSortChange }: CvToolbarProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 sm:w-auto">
      <div className="relative min-w-0 flex-1 sm:w-[260px] sm:flex-none">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          data-agent-target="cv-search-input" data-assistant-id="cv-search-input"
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm CV"
          aria-label="Tìm CV theo tên file"
          className="h-[38px] rounded-[10px] border-line-strong bg-card pr-3 pl-9 text-sm"
        />
      </div>
      <Select items={sortItems} value={sort} onValueChange={(v) => onSortChange(v as CvSort)}>
        <SelectTrigger
          className="h-[38px] min-w-0 rounded-[10px] border-line-strong bg-card px-3 text-sm text-ink shadow-xs"
          aria-label="Sắp xếp"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {sortItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------- Thẻ CV ----------

/** Ảnh thu nhỏ: một trang giấy trắng với các dòng giả lập (chỉ để trang trí). */
function CvThumb() {
  const line = "rounded bg-line"
  return (
    <div className="h-full rounded-t-md bg-card px-[18px] py-4 shadow-card" aria-hidden>
      <div className="h-[7px] w-[46%] rounded bg-ink opacity-80" />
      <div className="mt-1.5 h-[5px] w-[32%] rounded bg-line-strong" />
      <div className="mt-4 h-[5px] w-[24%] rounded bg-ink-3 opacity-60" />
      <div className={cn("mt-2 h-1 w-[92%]", line)} />
      <div className={cn("mt-1.5 h-1 w-[84%]", line)} />
      <div className={cn("mt-1.5 h-1 w-[88%]", line)} />
      <div className="mt-3.5 h-[5px] w-[24%] rounded bg-ink-3 opacity-60" />
      <div className={cn("mt-2 h-1 w-[90%]", line)} />
    </div>
  )
}

interface CvActionsMenuProps {
  cv: CvVersion
  onSetActive: (cv: CvVersion) => void
  onDelete: (cv: CvVersion) => void
  /** CV đang dùng khi còn CV khác: backend không cho xoá (409 cv_active), nên chặn sẵn ở menu. */
  deleteBlocked: boolean
  onPreview?: (cv: CvVersion) => void
  /** Ẩn mục "Chi tiết & lịch sử phiên bản" khi đang ở chính trang đó. */
  showDetail?: boolean
  className?: string
}

/** Menu ⋯ của một CV: dùng ở thẻ CV và ở trang Chi tiết CV. */
export function CvActionsMenu({
  cv,
  onSetActive,
  onDelete,
  deleteBlocked,
  onPreview,
  showDetail = true,
  className,
}: CvActionsMenuProps) {
  const canOptimize = cv.latest_analysis_id !== null && OPTIMIZER_AVAILABLE
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Thao tác khác cho ${cv.file_name}`}
            className={cn(
              "grid size-[34px] shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink aria-expanded:bg-surface aria-expanded:text-ink",
              className,
            )}
          />
        }
      >
        <MoreHorizontal className="size-[18px]" strokeWidth={1.75} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max">
        {showDetail && (
          <DropdownMenuItem render={<Link href={cvDetailHref(cv)} />}>
            <History aria-hidden />
            Chi tiết & lịch sử phiên bản
          </DropdownMenuItem>
        )}
        {onPreview && (
          <DropdownMenuItem onClick={() => onPreview(cv)}>
            <Eye aria-hidden />
            Xem nhanh
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href={cvAnalyzeHref(cv)} />}>
          <ScanText aria-hidden />
          Phân tích với vị trí
        </DropdownMenuItem>
        {canOptimize ? (
          <DropdownMenuItem
            render={<Link href={`/student/analysis/${encodeURIComponent(cv.latest_analysis_id!)}/optimize`} />}
          >
            <Wand2 aria-hidden />
            Tối ưu CV
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <Wand2 aria-hidden />
            <span className="grid">
              Tối ưu CV
              <span className="text-xs text-ink-3">
                {OPTIMIZER_AVAILABLE ? "Cần phân tích CV với một vị trí trước" : "Trình tối ưu CV sắp có"}
              </span>
            </span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={cv.is_active} onClick={() => onSetActive(cv)}>
          <Star aria-hidden />
          {cv.is_active ? "Đang là CV đang dùng" : "Đặt làm CV đang dùng"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void downloadCv(cv)}>
          <Download aria-hidden />
          Tải file gốc
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={deleteBlocked} onClick={() => onDelete(cv)}>
          <Trash2 aria-hidden />
          <span className="grid">
            Xoá CV
            {deleteBlocked && <span className="text-xs text-ink-3">Đặt CV khác làm CV đang dùng trước khi xoá</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface CvCardProps {
  cv: CvVersion
  onSetActive: (cv: CvVersion) => void
  onPreview: (cv: CvVersion) => void
  onDelete: (cv: CvVersion) => void
  deleteBlocked: boolean
}

/** Một thẻ = một CV, hiển thị phiên bản mới nhất; các bản trước xem ở trang Chi tiết CV. */
export function CvCard({ cv, onSetActive, onPreview, onDelete, deleteBlocked }: CvCardProps) {
  const detailHref = cvDetailHref(cv)
  return (
    <article className="flex min-w-0 flex-col gap-3.5 rounded-card border border-line bg-card p-4 shadow-card transition-[transform,box-shadow] duration-200 ease-out-soft motion-safe:hover:-translate-y-[3px] motion-safe:hover:shadow-float">
      <Link
        href={detailHref}
        tabIndex={-1}
        aria-hidden
        className="block h-[150px] overflow-hidden rounded-xl bg-panel px-[22px] pt-[18px]"
      >
        <CvThumb />
      </Link>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 truncate text-[15px] leading-6 font-semibold" title={cv.file_name}>
              <Link href={detailHref} className="text-ink hover:text-accent-strong">
                {cv.file_name}
              </Link>
            </h3>
            {cv.is_active && (
              <Badge variant="good" className="h-[22px] px-2">
                <span className="size-1.5 rounded-full bg-current" aria-hidden />
                Đang dùng
              </Badge>
            )}
            {cv.is_draft && (
              <Badge variant="neutral" className="h-[22px] px-2">
                Bản nháp
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-3">{versionMeta(cv)}</p>
        </div>
        <CvActionsMenu
          cv={cv}
          onSetActive={onSetActive}
          onPreview={onPreview}
          onDelete={onDelete}
          deleteBlocked={deleteBlocked}
          className="-mt-1 -mr-1"
        />
      </div>

      <div className="mt-auto flex min-h-[26px] items-center gap-2.5 border-t border-line pt-3 text-sm">
        {cv.match_score !== null ? (
          <>
            <span className="min-w-0 truncate text-ink-3" title={cv.target_title ?? undefined}>
              Lần phân tích gần nhất
            </span>
            <span className="flex-1" />
            <b className="font-semibold text-ink tabular-nums">{formatPercent(cv.match_score)}%</b>
            <MatchBadge label={matchLabelOf(cv.match_score)} />
          </>
        ) : (
          <>
            <span className="text-ink-3">Chưa phân tích</span>
            <Link href={cvAnalyzeHref(cv)} className="ml-auto font-semibold text-blue hover:text-accent-strong">
              Phân tích ngay
            </Link>
          </>
        )}
      </div>
    </article>
  )
}

// ---------- Mẹo (dạng gập) ----------

const CV_TIPS = [
  "Mỗi vị trí nên có một phiên bản CV riêng để đối chiếu đúng kỹ năng trong JD.",
  "Đưa số liệu vào kết quả của dự án và bài tập lớn.",
  "Giữ CV trong 1 trang nếu chưa có kinh nghiệm làm việc.",
  "Nội dung CV phải phản ánh đúng kinh nghiệm thật của bạn.",
]

export function CvTips() {
  return (
    <details className="group border-y border-line">
      <summary className="-mx-2.5 flex cursor-pointer list-none items-center gap-3.5 rounded-lg px-2.5 py-4 transition-colors hover:bg-panel [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-semibold text-ink">Mẹo tối ưu CV cho sinh viên</span>
        <ChevronDown
          className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
          strokeWidth={1.75}
          aria-hidden
        />
      </summary>
      <ul className="mb-[18px] grid list-disc gap-1.5 pl-5 text-ink-2">
        {CV_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </details>
  )
}

/** Nút "Thử lại" khi không tải được dữ liệu. */
export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="soft" className="h-9 rounded-full px-4" onClick={onClick}>
      Thử lại
    </Button>
  )
}
