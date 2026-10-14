"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { AlertCircle, ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { ZoneLink } from "@/components/common/zone"
import { MatchTrend, shortDate, VersionTimeline } from "@/components/student/cv/cv-history"
import { CvPaper } from "@/components/student/cv/cv-paper"
import { CvActionsMenu, cvAnalyzeHref, deleteDescription } from "@/components/student/cv/cv-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { downloadCv } from "@/lib/download"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"

/** Nhãn bản khôi phục sẽ tạo: số chính của bản mới nhất + 1 (v2.1 → v3.0). */
function nextMajorLabel(head: CvVersion): string {
  const major = Number(/v(\d+)/.exec(head.label)?.[1] ?? 0)
  return `v${major + 1}.0`
}

const LAYOUT = "grid grid-cols-[minmax(0,1fr)] items-start gap-x-14 gap-y-12 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]"

// Trang Chi tiết CV (DESIGN.md 3.6): tờ CV trên nền xám bên trái, lịch sử phiên bản + độ khớp bên phải. Bản cũ xem /
// tải / khôi phục được; khôi phục tạo bản sao làm bản mới nhất (số chính mới), không xoá bản nào
// (src/services/cv_versions.py).
export function CvDetail({ id }: { id: string }) {
  const router = useRouter()
  const fetchHistory = useCallback(() => api.listCvHistory(id), [id])
  const { data: versions, error, reload } = useApi(fetchHistory)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<CvVersion | null>(null)
  const [deleting, setDeleting] = useState<CvVersion | null>(null)

  if (error) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Không tải được CV"
        description={error.message}
        className="mt-10"
        action={
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button variant="soft" className="h-9 rounded-full px-4" onClick={reload}>
              Thử lại
            </Button>
            <Button variant="ghost" className="h-9 rounded-full px-4" nativeButton={false} render={<Link href="/student/cv" />}>
              Về CV của tôi
            </Button>
          </div>
        }
      />
    )
  }
  if (!versions) return <CvDetailSkeleton />

  const head = versions[0]
  const selected = versions.find((v) => v.id === selectedId) ?? head
  const viewingOld = selected.id !== head.id
  const card: CvVersion = { ...head, version_count: versions.length }

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

  async function setActive(cv: CvVersion) {
    try {
      await api.setActiveCv(cv.id)
      toast.success(`Đã đặt ${cv.file_name} làm CV đang dùng`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đổi được CV đang dùng.")
    }
  }

  async function remove(cv: CvVersion) {
    try {
      await api.deleteCv(cv.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xoá được CV.")
      throw err
    }
    toast.success(`Đã xoá ${cv.file_name}.`)
    router.push("/student/cv")
  }

  const description = [`Phiên bản ${head.label}`, head.is_active ? "đang dùng" : null, `cập nhật ${shortDate(head.uploaded_at)}`]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:gap-11">
      <PageHeader
        title={<span className="[overflow-wrap:anywhere]">{head.file_name}</span>}
        description={description}
        actions={
          <>
            <Button
              variant="ghost"
              size="brand"
              className="glass text-ink shadow-xs hover:bg-card"
              onClick={() => void downloadCv(selected)}
            >
              <Download strokeWidth={1.75} aria-hidden />
              Tải file gốc
            </Button>
            <Button size="brand" nativeButton={false} render={<Link href={cvAnalyzeHref(head)} />}>
              Phân tích với vị trí
              <ChevronRight aria-hidden />
            </Button>
            <CvActionsMenu
              cv={card}
              showDetail={false}
              onSetActive={setActive}
              onDelete={setDeleting}
              deleteBlocked={false}
              className="glass size-[46px] text-ink shadow-xs hover:bg-card"
            />
          </>
        }
      />

      <div className={LAYOUT}>
        <section
          aria-label={`Nội dung phiên bản ${selected.label}`}
          className="min-w-0 rounded-panel bg-surface p-3 sm:p-6 lg:p-9"
        >
          {viewingOld && (
            <div className="mx-auto mb-4 flex max-w-[720px] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl border border-warn-line bg-warn-soft px-4 py-2.5 text-sm text-warn">
              <span className="min-w-0 flex-1 basis-56">
                Đang xem bản cũ {selected.label}. Bản hiện tại là {head.label}.
              </span>
              <button type="button" className="font-semibold hover:underline" onClick={() => setSelectedId(null)}>
                Xem bản hiện tại
              </button>
              <button type="button" className="font-semibold hover:underline" onClick={() => setRestoring(selected)}>
                Khôi phục bản này
              </button>
            </div>
          )}
          <CvPaper key={selected.id} cv={selected} />
        </section>

        <aside className="grid min-w-0 gap-11 md:grid-cols-2 md:gap-x-12 xl:sticky xl:top-24 xl:grid-cols-1">
          <VersionTimeline
            versions={versions}
            selectedId={selected.id}
            onSelect={(cv) => setSelectedId(cv.id === head.id ? null : cv.id)}
            onRestore={setRestoring}
          />
          <div className="grid content-start gap-6">
            <MatchTrend versions={versions} analyzeHref={cvAnalyzeHref(head)} />
            <ZoneLink href={`/student/library?cv=${encodeURIComponent(head.id)}`}>Xem vị trí gợi ý cho CV này</ZoneLink>
          </div>
        </aside>
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
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xoá ${deleting?.file_name ?? "CV"}?`}
        description={deleteDescription(deleting)}
        confirmLabel="Xoá CV"
        destructive
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve())}
      />
    </div>
  )
}

function CvDetailSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:gap-11" aria-busy="true" aria-label="Đang tải CV">
      <div className="grid gap-3 pt-8 md:pt-12">
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-6 w-72 max-w-full" />
      </div>
      <div className={LAYOUT}>
        <Skeleton className="h-[70vh] rounded-panel" />
        <div className="grid gap-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-[220px] rounded-card" />
        </div>
      </div>
    </div>
  )
}
