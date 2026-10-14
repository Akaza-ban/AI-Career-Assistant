"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertCircle, ClipboardPaste, LockKeyhole, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Zone } from "@/components/common/zone"
import { floatingSurface } from "@/components/shell/notification-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, isToday } from "@/lib/format"
import { LEVEL_LABEL } from "@/lib/jd"
import type { JobDescription } from "@/lib/types"
import { cn } from "@/lib/utils"

const ROW_GRID = "@3xl:grid @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_100px_110px_auto] @3xl:items-center @3xl:gap-4"
const PILL = "h-8 shrink-0 rounded-full border-transparent bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel"
const menuItem = "h-10 gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-2 focus:bg-panel focus:text-ink [&_svg]:text-ink-3"

/** Bản vẽ ThuVienJdCuaBan / ThuVienJdTrong: JD sinh viên tự dán, chỉ người dán thấy. */
export function MyJds({
  jds,
  error,
  onRetry,
  onAdd,
  onEdit,
  onDeleted,
}: {
  jds: JobDescription[] | undefined
  error: Error | undefined
  onRetry: () => void
  onAdd: () => void
  onEdit: (jd: JobDescription) => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<JobDescription | null>(null)

  const aside = (
    <span className="flex items-baseline gap-4">
      <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
        <LockKeyhole className="size-3.5" strokeWidth={1.75} aria-hidden />
        Chỉ bạn thấy
      </span>
      {jds && jds.length > 0 && (
        <button type="button" onClick={onAdd} className="text-sm font-semibold text-blue hover:text-accent-strong">
          Thêm JD
        </button>
      )}
    </span>
  )

  return (
    <Zone id="my-jds" title="JD của bạn" aside={aside}>
      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-4 sm:px-5">
          <AlertCircle className="size-5 shrink-0 text-bad" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-ink-2">Không tải được JD của bạn. {error.message}</p>
          <Button variant="soft" className="h-9 rounded-full px-4" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : !jds ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Đang tải JD của bạn">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : jds.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4 rounded-card border border-dashed border-line-strong px-5 py-5 sm:flex-nowrap sm:px-6">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink-2">
            <ClipboardPaste className="size-[22px]" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1 basis-60">
            <p className="font-semibold text-ink">Có tin tuyển dụng ngoài thư viện?</p>
            <p className="text-sm text-ink-2">Dán JD vào đây để phân tích CV và luyện phỏng vấn đúng vị trí bạn nhắm tới.</p>
          </div>
          <Button size="brand" onClick={onAdd} className="max-sm:w-full">
            <Plus data-icon="inline-start" aria-hidden />
            Thêm JD
          </Button>
        </div>
      ) : (
        <section className="@container -mt-3">
          <div className={cn("hidden border-b border-line py-3 text-xs font-semibold tracking-[0.03em] text-ink-3 uppercase", ROW_GRID)} aria-hidden>
            <span>Vị trí</span>
            <span>Công ty</span>
            <span>Cấp bậc</span>
            <span>Ngày thêm</span>
            <span />
          </div>
          <ul>
            {jds.map((jd) => (
              <li key={jd.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-line py-3.5", ROW_GRID)}>
                <Link href={`/student/library/${encodeURIComponent(jd.id)}`} className="group min-w-0">
                  <span className="block truncate font-medium text-ink group-hover:text-blue">{jd.title}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {jd.skills.length ? `${jd.skills.slice(0, 4).map((s) => s.name).join(" · ")} · ${jd.skills.length} kỹ năng` : "Chưa nhận ra kỹ năng"}
                  </span>
                </Link>
                <span className="col-start-1 truncate text-sm text-ink-2 @3xl:col-auto">
                  {jd.company ?? "—"}
                  <span className="@3xl:hidden">
                    {jd.level ? ` · ${LEVEL_LABEL[jd.level]}` : ""}
                    {jd.created_at ? ` · ${isToday(jd.created_at) ? "Hôm nay" : formatDate(jd.created_at)}` : ""}
                  </span>
                </span>
                <span className="hidden text-sm text-ink-2 @3xl:block">{jd.level ? LEVEL_LABEL[jd.level] : "—"}</span>
                <span className="hidden text-sm text-ink-2 @3xl:block">
                  {jd.created_at ? (isToday(jd.created_at) ? "Hôm nay" : formatDate(jd.created_at)) : "—"}
                </span>
                <span className="col-start-2 row-start-1 flex items-center justify-end gap-1.5 @3xl:col-auto @3xl:row-auto">
                  <Button variant="outline" className={cn(PILL, "hidden lg:inline-flex")} nativeButton={false} render={<Link href={`/student/analysis/new?jd=${encodeURIComponent(jd.id)}`} />}>
                    Phân tích CV
                  </Button>
                  <Button variant="outline" className={cn(PILL, "hidden lg:inline-flex")} nativeButton={false} render={<Link href={`/student/interview/new?jd=${encodeURIComponent(jd.id)}`} />}>
                    Phỏng vấn
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-ink-3 hover:text-ink" aria-label={`Thao tác với ${jd.title}`} />}
                    >
                      <MoreHorizontal className="size-[18px]" strokeWidth={1.75} aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6} className={cn("w-56 p-1.5", floatingSurface)}>
                      <DropdownMenuItem className={cn(menuItem, "lg:hidden")} onClick={() => router.push(`/student/analysis/new?jd=${encodeURIComponent(jd.id)}`)}>
                        Phân tích CV
                      </DropdownMenuItem>
                      <DropdownMenuItem className={cn(menuItem, "lg:hidden")} onClick={() => router.push(`/student/interview/new?jd=${encodeURIComponent(jd.id)}`)}>
                        Luyện phỏng vấn
                      </DropdownMenuItem>
                      <DropdownMenuItem className={menuItem} onClick={() => onEdit(jd)}>
                        <PencilLine className="size-4" strokeWidth={1.75} aria-hidden />
                        Sửa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="mx-1.5 my-1 bg-line" />
                      <DropdownMenuItem className={cn(menuItem, "text-bad focus:text-bad [&_svg]:text-bad")} onClick={() => setDeleting(jd)}>
                        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        Xoá
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        icon={Trash2}
        destructive
        title={`Xoá “${deleting?.title ?? ""}”?`}
        description="JD bị xoá khỏi danh sách của bạn. Các lượt phân tích và buổi phỏng vấn đã làm với JD này vẫn xem lại được."
        confirmLabel="Xoá JD"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.deletePastedJd(deleting.id)
            toast.success("Đã xoá JD.")
            onDeleted()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Chưa xoá được JD.")
            throw err
          }
        }}
      />
    </Zone>
  )
}
