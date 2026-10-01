"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import {
  AlertCircle,
  CircleCheck,
  Download,
  GitCompare,
  History,
  RotateCcw,
  ScanText,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Panel, PanelHeader } from "@/components/common/panel"
import { CvPreviewBody } from "@/components/student/cv/cv-preview-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { downloadCv } from "@/lib/download"
import { formatBytes, formatRelativeTime } from "@/lib/format"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

function originOf(cv: CvVersion): { icon: LucideIcon; text: string } {
  if (cv.origin === "optimized") {
    return { icon: Wand2, text: cv.source_jd_title ? `Tối ưu theo JD ${cv.source_jd_title}` : "Tối ưu bằng Trình tối ưu" }
  }
  if (cv.origin === "restored") {
    return { icon: RotateCcw, text: cv.restored_from_label ? `Khôi phục từ ${cv.restored_from_label}` : "Khôi phục bản cũ" }
  }
  return { icon: Upload, text: "Tải lên" }
}

/** Nhãn bản khôi phục sẽ tạo: số chính của bản mới nhất + 1 (v2.1 → v3.0). */
function nextMajorLabel(head: CvVersion): string {
  const major = Number(/v(\d+)/.exec(head.label)?.[1] ?? 0)
  return `v${major + 1}.0`
}

function fileMeta(cv: CvVersion): string {
  return [cv.file_type.toUpperCase(), formatBytes(cv.size_bytes), cv.page_count ? `${cv.page_count} trang` : null]
    .filter(Boolean)
    .join(" · ")
}

// Trang Chi tiết CV: nội dung phiên bản đang chọn bên trái, lịch sử phiên bản bên phải. Bản cũ xem / tải / khôi phục
// được; khôi phục tạo bản sao làm bản mới nhất (số chính mới), không xoá bản nào (src/services/cv_versions.py).
export function CvDetail({ id }: { id: string }) {
  const fetchHistory = useCallback(() => api.listCvHistory(id), [id])
  const { data: versions, error, reload } = useApi(fetchHistory)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<CvVersion | null>(null)

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được CV</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
          <Button variant="link" nativeButton={false} render={<Link href="/student/cv" />}>
            Về CV của tôi
          </Button>
        </div>
      </Panel>
    )
  }
  if (!versions) return <CvDetailSkeleton />

  const head = versions[0]
  const selected = versions.find((v) => v.id === selectedId) ?? head
  const viewingOld = selected.id !== head.id
  const target = versions.find((v) => v.target_title)?.target_title ?? null

  async function restore(cv: CvVersion) {
    let created: CvVersion
    try {
      created = await api.restoreCv(cv.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không khôi phục được phiên bản này.")
      throw err
    }
    toast.success(`Đã khôi phục ${cv.label} thành phiên bản ${created.label}`)
    setSelectedId(created.id)
    reload()
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-2">
          <h1 className="truncate font-heading text-[28px] leading-9 font-bold" title={head.file_name}>
            {head.file_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            {head.is_active && (
              <Badge variant="good" className="h-auto px-2.5 py-0.5">
                <CircleCheck aria-hidden />
                Phiên bản đang dùng
              </Badge>
            )}
            <Badge variant={target ? "blue" : "neutral"} className="h-auto px-2.5 py-0.5">
              {target ?? "Chưa gắn vị trí"}
            </Badge>
            <span>
              {head.label} · {versions.length} phiên bản · cập nhật {formatRelativeTime(head.uploaded_at).toLowerCase()}
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          className="h-9 bg-blue-soft"
          nativeButton={false}
          render={<Link href={`/student/analysis/new?cv=${encodeURIComponent(head.id)}`} />}
        >
          <ScanText aria-hidden />
          Phân tích bản hiện tại
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <p className="font-heading text-base font-bold">
                {viewingOld ? `Đang xem phiên bản cũ ${selected.label}` : `Phiên bản hiện tại ${selected.label}`}
              </p>
              <p className="truncate text-xs text-ink-2" title={selected.file_name}>
                {selected.file_name} · {fileMeta(selected)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {viewingOld && (
                <Button className="h-9" onClick={() => setRestoring(selected)}>
                  <RotateCcw aria-hidden />
                  Khôi phục phiên bản này
                </Button>
              )}
              <Button variant="soft" className="h-9" onClick={() => void downloadCv(selected)}>
                <Download aria-hidden />
                Tải xuống
              </Button>
            </div>
          </div>
          {viewingOld && (
            <p className="flex flex-wrap items-center gap-x-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Bạn đang xem bản cũ. Bản hiện tại là {head.label}.
              <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setSelectedId(null)}>
                Xem bản hiện tại
              </button>
            </p>
          )}
          <div className="h-[70vh] min-h-[420px]">
            <CvPreviewBody key={selected.id} cv={selected} />
          </div>
        </Panel>

        <Panel className="grid gap-3 p-5 lg:sticky lg:top-24">
          <PanelHeader
            icon={History}
            title="Lịch sử phiên bản"
            aside={<span className="text-xs text-ink-2">{versions.length} phiên bản</span>}
          />
          <ol className="grid gap-1.5" aria-label="Các phiên bản, mới nhất trước">
            {versions.map((cv) => (
              <HistoryItem
                key={cv.id}
                cv={cv}
                current={cv.id === head.id}
                selected={cv.id === selected.id}
                onSelect={() => setSelectedId(cv.id)}
              />
            ))}
          </ol>
          <p className="border-t border-line pt-3 text-xs text-ink-2">
            Khôi phục một bản cũ sẽ tạo phiên bản mới là bản sao của bản đó. Không phiên bản nào bị xoá.
          </p>
        </Panel>
      </div>

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Khôi phục phiên bản ${restoring?.label ?? ""}?`}
        description={
          <>
            Hệ thống tạo phiên bản {nextMajorLabel(head)} là bản sao của {restoring?.label} và đặt làm bản hiện tại của
            CV.{head.is_active && " Vì đây là CV đang dùng, bản khôi phục cũng thành phiên bản đang dùng."} Không phiên
            bản nào bị xoá.
          </>
        }
        confirmLabel="Khôi phục"
        onConfirm={() => (restoring ? restore(restoring) : Promise.resolve())}
      />
    </div>
  )
}

interface HistoryItemProps {
  cv: CvVersion
  /** Phiên bản mới nhất của CV. */
  current: boolean
  selected: boolean
  onSelect: () => void
}

function HistoryItem({ cv, current, selected, onSelect }: HistoryItemProps) {
  const { icon: Icon, text } = originOf(cv)
  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-colors",
        selected ? "border-blue/40 bg-blue-soft/50" : "border-transparent hover:bg-surface",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          current ? "bg-blue text-on-blue" : "bg-surface text-ink-2",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected ? "true" : undefined}
          className="grid gap-0.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-bold text-ink">{cv.label}</span>
            {current && <Badge variant="blue">Hiện tại</Badge>}
            {selected && !current && <Badge variant="neutral">Đang xem</Badge>}
          </span>
          <span className="text-sm text-ink">{text}</span>
          <span className="text-xs text-ink-2">
            {formatRelativeTime(cv.uploaded_at)}
            {cv.match_score !== null && ` · Độ khớp JD ${cv.match_score}%`}
          </span>
        </button>
        {cv.source_analysis_id && (
          <Link
            href={`/student/analysis/${encodeURIComponent(cv.source_analysis_id)}/export`}
            className="inline-flex items-center gap-1 justify-self-start text-xs font-medium text-blue hover:underline"
          >
            <GitCompare className="size-3.5" aria-hidden />
            Xem thay đổi
          </Link>
        )}
      </div>
    </li>
  )
}

function CvDetailSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải CV">
      <div className="grid gap-2">
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[70vh] rounded-[20px]" />
        <Skeleton className="h-[420px] rounded-[20px]" />
      </div>
    </div>
  )
}
