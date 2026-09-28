"use client"

import Link from "next/link"
import { useState, type DragEvent } from "react"
import {
  AlertCircle,
  CircleCheck,
  Clock,
  CloudUpload,
  Eye,
  FilePen,
  Gauge,
  Lightbulb,
  Loader2,
  MoreVertical,
  ScanText,
  Search,
  Sparkles,
  Star,
  Upload,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import type { UploadState } from "@/components/student/cv/use-cv-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

// ---------- Thanh tìm kiếm / lọc / sắp xếp ----------

export type CvSort = "recent" | "ats" | "name"

const sortItems = [
  { value: "recent", label: "Cập nhật gần nhất" },
  { value: "ats", label: "Điểm ATS cao nhất" },
  { value: "name", label: "Tên file A–Z" },
]

interface CvToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  target: string
  onTargetChange: (value: string) => void
  targets: string[]
  sort: CvSort
  onSortChange: (value: CvSort) => void
  total: number
  averageAts: number | null
}

export function CvToolbar(props: CvToolbarProps) {
  const { query, onQueryChange, target, onTargetChange, targets, sort, onSortChange, total, averageAts } = props
  const targetItems = [
    { value: "all", label: `Tất cả vị trí (${targets.length})` },
    ...targets.map((t) => ({ value: t, label: t })),
  ]
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3 p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Tìm kiếm theo tên file, vị trí..."
            aria-label="Tìm kiếm CV"
            className="h-9 border-transparent bg-surface pl-9"
          />
        </div>
        <Select items={targetItems} value={target} onValueChange={(v) => onTargetChange(String(v))}>
          <SelectTrigger className="h-9 min-w-48 border-transparent bg-surface" aria-label="Lọc theo vị trí">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targetItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span className="flex items-center gap-1.5 rounded-lg bg-blue-soft/70 px-3 py-1.5 text-xs font-medium text-ink">
          <span className="size-2 rounded-full bg-good" aria-hidden />
          Đang lưu {total} phiên bản
        </span>
        {averageAts !== null && (
          <span className="flex items-center gap-1.5 rounded-lg bg-blue-soft px-3 py-1.5 text-xs font-semibold text-blue">
            <Gauge className="size-3.5" aria-hidden />
            Điểm ATS TB: {averageAts}/100
          </span>
        )}
      </div>
    </Panel>
  )
}

// ---------- Thẻ CV ----------

function statusBadge(cv: CvVersion) {
  if (cv.is_active) return { icon: CircleCheck, label: "Phiên bản đang dùng", variant: "good" as const }
  if (cv.is_draft) return { icon: FilePen, label: "Bản nháp", variant: "neutral" as const }
  if (cv.origin === "optimized") return { icon: Wand2, label: "Đã tối ưu", variant: "blue" as const }
  return { icon: Upload, label: "Bản tải lên", variant: "neutral" as const }
}

// Độ dài các dòng giả lập trong ảnh thu nhỏ (chỉ để trang trí).
const previewLines = [
  ["w-3/4", "w-1/2", "w-full", "w-11/12", "w-4/5", "w-full", "w-5/6"],
  ["w-2/3", "w-1/2", "w-full", "w-5/6", "w-3/4", "w-2/3"],
  ["w-1/2", "w-1/3", "w-4/5", "w-2/3"],
]

function CvPreview({ cv, index }: { cv: CvVersion; index: number }) {
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
          onClick={() => toast.info("Xem trước file sẽ hoạt động khi kết nối backend.")}
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

interface CvCardProps {
  cv: CvVersion
  index: number
  onSetActive: (cv: CvVersion) => void
}

export function CvCard({ cv, index, onSetActive }: CvCardProps) {
  const badge = statusBadge(cv)
  const BadgeIcon = badge.icon
  const analyzeHref = `/student/analysis/new?cv=${encodeURIComponent(cv.id)}`
  const optimizeHref = cv.latest_analysis_id
    ? `/student/analysis/${encodeURIComponent(cv.latest_analysis_id)}/optimize`
    : analyzeHref
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
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem disabled={cv.is_active} onClick={() => onSetActive(cv)}>
                <Star aria-hidden />
                Đặt làm phiên bản đang dùng
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={analyzeHref} />}>
                <ScanText aria-hidden />
                Phân tích với JD mới
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CvPreview cv={cv} index={index} />

      <div className="grid gap-1">
        <h2 className="truncate font-heading text-base font-bold" title={cv.file_name}>
          {cv.file_name}
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
        {cv.ats_score !== null ? (
          <>
            <ScoreRing score={cv.ats_score} />
            <div className="grid">
              <span className="text-xs font-semibold text-ink">Điểm ATS</span>
              <span className="text-xs text-ink-2">{cv.ats_note ?? "Đã chấm theo JD gần nhất"}</span>
            </div>
          </>
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-full border-4 border-blue-soft text-sm font-bold text-ink-3">
              —
            </span>
            <div className="grid">
              <span className="text-xs font-semibold text-ink">Chưa chấm ATS</span>
              <span className="text-xs text-ink-2">Phân tích với một JD để xem điểm</span>
            </div>
          </>
        )}
      </div>

      <p className="flex items-center gap-1 text-xs text-ink-2">
        <Clock className="size-3 shrink-0" aria-hidden />
        {meta.join(" • ")}
      </p>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Button variant="secondary" className="h-9 bg-blue-soft" nativeButton={false} render={<Link href={analyzeHref} />}>
          <ScanText aria-hidden />
          Phân tích
        </Button>
        <Button
          variant={cv.is_active ? "default" : "secondary"}
          className={cn("h-9", !cv.is_active && "bg-blue-soft")}
          nativeButton={false}
          render={<Link href={optimizeHref} />}
        >
          <Wand2 aria-hidden />
          {cv.origin === "optimized" && !cv.is_active ? "Tối ưu tiếp" : "Tối ưu"}
        </Button>
      </div>
    </Panel>
  )
}

// ---------- Vùng kéo thả ----------

interface CvDropzoneProps {
  onFile: (file: File) => void
  onBrowse: () => void
  disabled: boolean
  /** Hiển thị lớn hơn khi chưa có CV nào. */
  prominent?: boolean
}

export function CvDropzone({ onFile, onBrowse, disabled, prominent }: CvDropzoneProps) {
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && !disabled) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "grid justify-items-center gap-1 rounded-[20px] border-2 border-dashed bg-card px-6 text-center shadow-card transition-colors",
        prominent ? "py-16" : "py-8",
        dragging ? "border-blue bg-blue-soft/40" : "border-line",
      )}
    >
      <span className="mb-2 grid size-16 place-items-center rounded-full bg-blue-soft text-blue">
        <CloudUpload className="size-7" aria-hidden />
      </span>
      <h2 className="font-heading text-base font-bold">
        {prominent ? "Tải CV đầu tiên của bạn lên" : "Kéo thả file PDF hoặc DOCX vào đây để phân tích"}
      </h2>
      <p className="max-w-md text-[13px] leading-[18px] text-ink-2">
        {prominent && "Kéo thả file PDF hoặc DOCX vào đây. "}
        Hỗ trợ tài liệu tối đa 10MB mỗi file. Khuyến khích cấu trúc đề mục rõ ràng để AI trích xuất tốt nhất.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
        <Button
          variant="secondary"
          className="h-9 bg-blue-soft px-4 font-semibold text-blue"
          onClick={onBrowse}
          disabled={disabled}
        >
          Chọn file từ máy tính
        </Button>
        {features.driveImport && <span className="text-xs text-ink-3">hoặc nhập từ Google Drive</span>}
      </div>
    </div>
  )
}

// ---------- Mẹo ----------

export function CvTipCard() {
  return (
    <Panel className="flex gap-4 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue">
        <Lightbulb className="size-5" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-bold">
          Mẹo tối ưu CV cho sinh viên
          <Badge variant="violet" className="rounded-md">
            Gợi ý
          </Badge>
        </h2>
        <p className="text-[13px] leading-[21px] text-ink-2">
          Nên giữ mỗi vị trí mục tiêu một phiên bản CV riêng để đối chiếu chính xác với từ khoá kỹ năng trong JD. Điểm
          ATS cao giúp CV dễ vượt qua vòng lọc hồ sơ tự động, nhưng nội dung vẫn phải phản ánh đúng kinh nghiệm thật của
          bạn.
        </p>
      </div>
    </Panel>
  )
}
