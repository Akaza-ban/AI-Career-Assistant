"use client"

import Link from "next/link"
import { useEffect, useState, type DragEvent } from "react"
import {
  AlertCircle,
  CircleCheck,
  Clock,
  CloudUpload,
  Download,
  Eye,
  FilePen,
  History,
  Lightbulb,
  Loader2,
  MoreVertical,
  RotateCcw,
  ScanText,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { HintPopover } from "@/components/common/hint-popover"
import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { OPTIMIZER_AVAILABLE } from "@/lib/config"
import { downloadCv } from "@/lib/download"
import { features } from "@/lib/features"
import { formatBytes, formatRelativeTime } from "@/lib/format"
import type { CvVersion } from "@/lib/types"
import { cn } from "@/lib/utils"

// ---------- Banner trạng thái tải lên ----------

export function UploadStatusBanner({ state, onDismiss }: { state: UploadState; onDismiss: () => void }) {
  if (state.status === "idle") return null
  const uploading = state.status === "uploading"
  return (
    <Panel
      className={cn("relative flex flex-wrap items-center justify-between gap-4 overflow-hidden p-4 pl-5")}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", uploading ? "bg-violet" : "bg-bad")} />
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-lg",
            uploading ? "bg-violet-soft text-violet" : "bg-bad-soft text-bad",
          )}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <AlertCircle className="size-5" aria-hidden />}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-ink">{state.fileName}</p>
            <Badge variant={uploading ? "violet" : "bad"}>{uploading ? "Đang xử lý" : "Tải lên thất bại"}</Badge>
            <span className="text-xs text-ink-2">{formatBytes(state.size)}</span>
          </div>
          <p className={cn("flex items-center gap-1 text-xs", uploading ? "text-violet" : "text-bad")}>
            {uploading ? (
              <>
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                Đang tải lên và trích xuất nội dung CV…
              </>
            ) : (
              state.message
            )}
          </p>
        </div>
      </div>
      {uploading ? (
        <div className="h-2 w-64 overflow-hidden rounded-full bg-blue-soft" aria-hidden>
          <div className="h-full w-1/3 animate-[cv-progress_1.2s_ease-in-out_infinite] rounded-full bg-violet" />
        </div>
      ) : (
        <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Đóng thông báo lỗi">
          <X aria-hidden />
        </Button>
      )}
    </Panel>
  )
}

// ---------- Thanh tìm kiếm / sắp xếp ----------

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

export function CvToolbar({ query, onQueryChange, sort, onSortChange }: CvToolbarProps) {
  return (
    <Panel className="flex flex-wrap items-center gap-2 p-2">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm theo tên file…"
          aria-label="Tìm kiếm CV theo tên file"
          className="h-9 border-transparent bg-surface pl-9"
        />
      </div>
      <Select items={sortItems} value={sort} onValueChange={(v) => onSortChange(v as CvSort)}>
        <SelectTrigger className="h-9 min-w-44 border-transparent bg-surface" aria-label="Sắp xếp">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Panel>
  )
}

// ---------- Thẻ CV ----------

function statusBadge(cv: CvVersion) {
  if (cv.is_active) return { icon: CircleCheck, label: "Phiên bản đang dùng", variant: "good" as const }
  if (cv.is_draft) return { icon: FilePen, label: "Bản nháp", variant: "neutral" as const }
  if (cv.origin === "optimized") return { icon: Wand2, label: "Đã tối ưu", variant: "blue" as const }
  if (cv.origin === "restored") return { icon: RotateCcw, label: "Đã khôi phục", variant: "neutral" as const }
  return { icon: Upload, label: "Bản tải lên", variant: "neutral" as const }
}

// Độ dài các dòng giả lập trong ảnh thu nhỏ (chỉ để trang trí).
const previewLines = [
  ["w-3/4", "w-1/2", "w-full", "w-11/12", "w-4/5", "w-full", "w-5/6"],
  ["w-2/3", "w-1/2", "w-full", "w-5/6", "w-3/4", "w-2/3"],
  ["w-1/2", "w-1/3", "w-4/5", "w-2/3"],
]

function CvPreview({ cv, index, onPreview }: { cv: CvVersion; index: number; onPreview: (cv: CvVersion) => void }) {
  const lines = previewLines[index % previewLines.length]
  return (
    <div className="flex h-44 flex-col justify-between rounded-lg bg-surface p-3.5 shadow-[inset_0_2px_4px_rgb(11_27_58/0.05)]">
      <div className="flex items-start justify-between" aria-hidden>
        <span className={cn("h-1.5 w-12 rounded", cv.is_active ? "bg-blue" : "bg-ink-3/60")} />
        <span className="size-2 rounded-full bg-line" />
      </div>
      <div className="grid gap-1.5" aria-hidden>
        {lines.map((w, i) => (
          <span
            key={i}
            className={cn(
              "rounded",
              w,
              i === 0 ? "h-2 bg-ink/20" : i === 1 ? "h-1.5 bg-ink/15" : "h-1 bg-ink/10",
              cv.is_active && i === 4 && "h-1.5 bg-blue/30",
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => onPreview(cv)}
          className={cn("inline-flex items-center gap-1 font-medium hover:underline", cv.is_active ? "text-blue" : "text-ink")}
        >
          <Eye className="size-3.5" aria-hidden />
          Xem nhanh
        </button>
        <span className="text-ink-3">
          {cv.page_count ? `${cv.page_count} trang ` : ""}
          {cv.file_type.toUpperCase()}
        </span>
      </div>
    </div>
  )
}

/** Tối ưu dựa trên lần phân tích gần nhất; chưa phân tích (hoặc trình tối ưu chưa sẵn sàng) thì làm mờ nút và giải thích lý do. */
function OptimizeButton({ cv }: { cv: CvVersion }) {
  const variant = cv.is_active ? "default" : "secondary"
  const className = cn("h-9 w-full", !cv.is_active && "bg-blue-soft")
  if (cv.latest_analysis_id && OPTIMIZER_AVAILABLE) {
    return (
      <Button
        variant={variant}
        className={className}
        nativeButton={false}
        render={<Link href={`/student/analysis/${encodeURIComponent(cv.latest_analysis_id)}/optimize`} />}
      >
        <Wand2 aria-hidden />
        Tối ưu
      </Button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className="grid rounded-lg" />}>
        <Button variant={variant} className={className} disabled>
          <Wand2 aria-hidden />
          Tối ưu
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {OPTIMIZER_AVAILABLE ? "Cần phân tích CV với một JD trước khi tối ưu" : "Trình tối ưu CV sắp có"}
      </TooltipContent>
    </Tooltip>
  )
}

interface CvCardProps {
  cv: CvVersion
  index: number
  onSetActive: (cv: CvVersion) => void
  onPreview: (cv: CvVersion) => void
  onDelete: (cv: CvVersion) => void
  /** CV đang dùng khi còn CV khác: backend không cho xoá (409 cv_active), nên chặn sẵn ở menu. */
  deleteBlocked: boolean
}

/** Một thẻ = một CV, hiển thị phiên bản mới nhất; các bản trước xem ở trang Chi tiết CV. */
export function CvCard({ cv, index, onSetActive, onPreview, onDelete, deleteBlocked }: CvCardProps) {
  const badge = statusBadge(cv)
  const BadgeIcon = badge.icon
  const analyzeHref = `/student/analysis/new?cv=${encodeURIComponent(cv.id)}`
  const detailHref = `/student/cv/${encodeURIComponent(cv.family_id)}`
  const meta = [`Cập nhật ${formatRelativeTime(cv.uploaded_at).toLowerCase()}`, formatBytes(cv.size_bytes)]
  if (cv.page_count) meta.push(`${cv.page_count} trang`)

  return (
    <Panel
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden p-4",
        cv.is_active && "shadow-[0_4px_6px_-1px_rgb(11_27_58/0.1),0_2px_4px_-2px_rgb(11_27_58/0.1)]",
      )}
    >
      {cv.is_active && <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-good" />}

      <div className="flex items-center justify-between gap-2">
        <Badge variant={badge.variant} className="h-auto px-2.5 py-0.5">
          <BadgeIcon aria-hidden />
          {badge.label}
        </Badge>
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-blue-soft px-2 py-0.5 text-xs font-semibold text-ink-2">
            {cv.label}
            {cv.is_draft && " (Nháp)"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Tuỳ chọn cho ${cv.file_name}`} />}
            >
              <MoreVertical aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max">
              <DropdownMenuItem render={<Link href={detailHref} />}>
                <History aria-hidden />
                Chi tiết & lịch sử phiên bản
              </DropdownMenuItem>
              <DropdownMenuItem disabled={cv.is_active} onClick={() => onSetActive(cv)}>
                <Star aria-hidden />
                Đặt làm phiên bản đang dùng
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void downloadCv(cv)}>
                <Download aria-hidden />
                Tải xuống
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={deleteBlocked} onClick={() => onDelete(cv)}>
                <Trash2 aria-hidden />
                <span className="grid">
                  Xoá CV
                  {deleteBlocked && (
                    <span className="text-xs text-ink-2">Đặt CV khác làm bản đang dùng trước khi xoá</span>
                  )}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CvPreview cv={cv} index={index} onPreview={onPreview} />

      <div className="grid gap-1">
        <h2 className="truncate font-heading text-base font-bold" title={cv.file_name}>
          <Link href={detailHref} className="hover:text-blue hover:underline">
            {cv.file_name}
          </Link>
        </h2>
        {cv.target_title ? (
          <Badge variant="blue" className="h-auto px-2.5 py-0.5">
            {cv.target_title}
          </Badge>
        ) : (
          <Badge variant="neutral" className="h-auto px-2.5 py-0.5">
            Chưa gắn vị trí
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2.5 rounded-lg bg-surface p-2.5">
        {cv.match_score !== null ? (
          <>
            <ScoreRing score={cv.match_score} />
            <div className="grid min-w-0">
              <span className="text-xs font-semibold text-ink">Độ khớp JD gần nhất</span>
              <span className="truncate text-xs text-ink-2" title={cv.target_title ?? undefined}>
                {cv.target_title ?? "Theo lần phân tích gần nhất"}
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-full border-4 border-blue-soft text-sm font-bold text-ink-3">
              —
            </span>
            <div className="grid">
              <span className="text-xs font-semibold text-ink">Chưa phân tích</span>
              <span className="text-xs text-ink-2">Phân tích với một JD để xem độ khớp</span>
            </div>
          </>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-1 text-xs text-ink-2">
        <Clock className="size-3 shrink-0" aria-hidden />
        {meta.join(" • ")}
        {cv.version_count > 1 && (
          <>
            {" • "}
            <Link href={detailHref} className="font-medium text-blue hover:underline">
              {cv.version_count} phiên bản
            </Link>
          </>
        )}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Button variant="secondary" className="h-9 bg-blue-soft" nativeButton={false} render={<Link href={analyzeHref} />}>
          <ScanText aria-hidden />
          Phân tích
        </Button>
        <OptimizeButton cv={cv} />
      </div>
    </Panel>
  )
}

// ---------- Vùng kéo thả ----------

interface CvDropzoneProps {
  onFile: (file: File) => void
  onBrowse: () => void
  disabled: boolean
  /** Dạng lớn khi chưa có CV nào; ngược lại là dạng gọn một dòng phía trên danh sách. */
  prominent?: boolean
}

const hasFiles = (e: globalThis.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")

export function CvDropzone({ onFile, onBrowse, disabled, prominent }: CvDropzoneProps) {
  const [dragging, setDragging] = useState(false)

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
    e.dataTransfer.dropEffect = disabled ? "none" : "copy"
    if (!disabled) setDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    // Bỏ qua khi con trỏ chỉ đi qua phần tử con bên trong vùng thả.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) {
      toast.info("Hãy kéo thả file PDF hoặc DOCX (ví dụ từ thư mục trên máy), không phải liên kết hay đoạn văn bản.")
      return
    }
    if (files.length > 1) toast.info(`Mỗi lần chỉ tải lên một file. Đã chọn ${files[0].name}.`)
    onFile(files[0])
  }

  const dropHandlers = { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop }
  const limitNote = `PDF hoặc DOCX, tối đa ${CV_MAX_MB}MB mỗi file`
  const heading = dragging ? "Thả file vào đây để tải lên" : null
  const browseButton = (
    <Button
      variant="secondary"
      className="h-9 bg-blue-soft px-4 font-semibold text-blue"
      onClick={onBrowse}
      disabled={disabled}
    >
      Chọn file từ máy tính
    </Button>
  )

  if (!prominent) {
    return (
      <div
        {...dropHandlers}
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-[20px] border-2 border-dashed bg-card px-5 py-4 shadow-card transition-colors",
          dragging ? "border-blue bg-blue-soft/40" : "border-line",
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blue-soft text-blue">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 className="font-heading text-[15px] font-bold">{heading ?? "Kéo thả CV vào đây để tạo phiên bản mới"}</h2>
          <p className="text-[13px] text-ink-2">{limitNote}</p>
        </div>
        {browseButton}
      </div>
    )
  }

  return (
    <div
      {...dropHandlers}
      className={cn(
        "grid justify-items-center gap-1 rounded-[20px] border-2 border-dashed bg-card px-6 py-16 text-center shadow-card transition-colors",
        dragging ? "border-blue bg-blue-soft/40" : "border-line",
      )}
    >
      <span className="mb-2 grid size-16 place-items-center rounded-full bg-blue-soft text-blue">
        <CloudUpload className="size-7" aria-hidden />
      </span>
      <h2 className="font-heading text-base font-bold">{heading ?? "Tải CV đầu tiên của bạn lên"}</h2>
      <p className="max-w-md text-[13px] leading-[18px] text-ink-2">
        Kéo thả file vào đây hoặc chọn từ máy tính. {limitNote}. Khuyến khích cấu trúc đề mục rõ ràng để AI trích xuất
        tốt nhất.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
        {browseButton}
        {features.driveImport && <span className="text-xs text-ink-3">hoặc nhập từ Google Drive</span>}
      </div>
    </div>
  )
}

// ---------- Mẹo ----------

const CV_TIPS = [
  "Giữ mỗi vị trí mục tiêu một phiên bản CV riêng để đối chiếu chính xác với kỹ năng trong JD.",
  "Độ khớp JD cao cho thấy CV đã thể hiện rõ yêu cầu của vị trí, nhưng không đảm bảo vượt qua vòng lọc hồ sơ.",
  "Nội dung CV phải phản ánh đúng kinh nghiệm thật của bạn.",
]

/** Mẹo gọn trong một nút ở góc tiêu đề trang (rê chuột mới hiện). */
export function CvTips() {
  return (
    <HintPopover
      label="Mẹo tối ưu CV"
      icon={Lightbulb}
      iconClassName="text-gold"
      title="Mẹo tối ưu CV cho sinh viên"
      items={CV_TIPS.map((tip) => ({ content: tip }))}
    />
  )
}
