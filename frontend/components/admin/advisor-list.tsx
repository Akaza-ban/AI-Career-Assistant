"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { AlertCircle, KeyRound, LockKeyhole, LockKeyholeOpen, MoreHorizontal, PencilLine, Plus, Search, SearchX, UserRoundCheck, Users } from "lucide-react"
import { toast } from "sonner"

import { AdvisorDialog, type AdvisorDialogMode } from "@/components/admin/advisor-dialog"
import { AdvisorStatusBadge, formatCount } from "@/components/admin/admin-bits"
import { StudentAvatar } from "@/components/advisor/students/student-bits"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedControl } from "@/components/common/segmented-control"
import { floatingSurface } from "@/components/shell/notification-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AdminAdvisor } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

type Filter = "all" | "enabled" | "disabled"

const ROW_GRID =
  "@4xl:grid @4xl:grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_84px_104px_120px_190px_36px] @4xl:items-center @4xl:gap-4"
const menuItem =
  "h-10 gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-2 focus:bg-panel focus:text-ink [&_svg]:text-ink-3"

const matchesFilter = (a: AdminAdvisor, filter: Filter) =>
  filter === "all" || (filter === "disabled" ? a.status === "disabled" : a.status !== "disabled")

// Bản vẽ QuanTriCoVan / ThemCoVan: danh sách tài khoản cố vấn, thêm cố vấn bằng mật khẩu tạm, tạm khoá / mở khoá.
export function AdvisorList({ initialQuery, openCreate }: { initialQuery: string; openCreate: boolean }) {
  const router = useRouter()
  const { data: advisors, error, reload } = useApi(api.listAdminAdvisors)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState(initialQuery)
  const [dialog, setDialog] = useState<AdvisorDialogMode | null>(openCreate ? { kind: "create" } : null)
  const [locking, setLocking] = useState<AdminAdvisor | null>(null)

  const counts = useMemo(
    () =>
      Object.fromEntries((["all", "enabled", "disabled"] as Filter[]).map((f) => [f, (advisors ?? []).filter((a) => matchesFilter(a, f)).length])) as Record<Filter, number>,
    [advisors],
  )
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (advisors ?? []).filter(
      (a) => matchesFilter(a, filter) && (!q || [a.full_name, a.email, a.title].some((v) => v.toLowerCase().includes(q))),
    )
  }, [advisors, filter, query])
  const assigned = (advisors ?? []).reduce((sum, a) => sum + a.student_count, 0)

  async function setDisabled(advisor: AdminAdvisor, disabled: boolean) {
    try {
      await api.updateAdvisor(advisor.id, { disabled })
      toast.success(disabled ? `Đã tạm khoá tài khoản ${advisor.full_name}.` : `Đã mở khoá tài khoản ${advisor.full_name}.`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa cập nhật được tài khoản.")
      throw err
    }
  }

  const search = (
    <div className="relative w-full sm:w-[280px]">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Tìm cố vấn"
        placeholder="Tìm cố vấn"
        className="h-10 rounded-[10px] border-line-strong bg-card pr-3 pl-10 text-sm shadow-xs"
      />
    </div>
  )

  return (
    <div className="grid gap-8 md:gap-10">
      <PageHeader
        title="Cố vấn"
        description={
          advisors
            ? advisors.length > 0
              ? `${formatCount(counts.enabled)} cố vấn đang phụ trách ${formatCount(assigned)} sinh viên.`
              : "Chưa có tài khoản cố vấn nào."
            : "Đang tải danh sách…"
        }
        actions={
          <Button size="brand" onClick={() => setDialog({ kind: "create" })}>
            <Plus data-icon="inline-start" aria-hidden />
            Thêm cố vấn
          </Button>
        }
      />

      {error ? (
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={AlertCircle}
            title="Không tải được danh sách cố vấn"
            description={error.message}
            action={
              <Button size="brand" onClick={reload}>
                Thử lại
              </Button>
            }
          />
        </Panel>
      ) : (
        <section aria-label="Danh sách cố vấn" className="@container min-w-0">
          <div className="flex flex-wrap items-center gap-3 pb-2">
            <SegmentedControl
              aria-label="Lọc theo trạng thái"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Tất cả", count: advisors ? counts.all : undefined },
                { value: "enabled", label: "Đang hoạt động", count: advisors ? counts.enabled : undefined },
                { value: "disabled", label: "Tạm khoá", count: advisors ? counts.disabled : undefined },
              ]}
              className="w-full sm:w-auto"
            />
            <span className="hidden flex-1 sm:block" />
            {search}
          </div>

          <div className={cn("hidden border-b border-line py-3 text-[13px] text-ink-3", ROW_GRID)} aria-hidden>
            <span>Cố vấn</span>
            <span>Chức danh</span>
            <span>Sinh viên</span>
            <span>Chờ nhận xét</span>
            <span>Hoạt động</span>
            <span>Trạng thái</span>
            <span />
          </div>

          {!advisors ? (
            <div className="grid gap-2 pt-3" aria-busy="true" aria-label="Đang tải danh sách">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : advisors.length === 0 ? (
            <EmptyState
              icon={UserRoundCheck}
              title="Chưa có cố vấn"
              description="Thêm cố vấn để phân công sinh viên cho họ."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Không có cố vấn nào khớp"
              description="Thử từ khoá khác hoặc chọn bộ lọc Tất cả."
              action={
                <Button
                  variant="soft"
                  className="h-9 rounded-full px-4"
                  onClick={() => {
                    setQuery("")
                    setFilter("all")
                  }}
                >
                  Xoá bộ lọc
                </Button>
              }
            />
          ) : (
            <ul>
              {rows.map((a) => (
                <li key={a.id} className={cn("grid grid-cols-[minmax(0,1fr)_36px] gap-x-3 gap-y-2 border-b border-line py-3.5", ROW_GRID)}>
                  <span className="flex min-w-0 items-center gap-3">
                    <StudentAvatar name={a.full_name} src={a.avatar_url} />
                    <span className="min-w-0">
                      <span className={cn("block truncate font-medium text-ink", a.status === "disabled" && "text-ink-3")}>
                        {a.full_name}
                      </span>
                      <span className="block truncate text-[13px] text-ink-3">{a.email}</span>
                    </span>
                  </span>
                  <span className="col-start-1 truncate text-sm text-ink-2 @4xl:col-auto">{a.title}</span>
                  <span className="col-start-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2 @4xl:contents">
                    <span className="tabular-nums">
                      {formatCount(a.student_count)}
                      <span className="text-ink-3 @4xl:hidden"> sinh viên</span>
                    </span>
                    <span className={cn("tabular-nums", a.pending_reviews >= 5 ? "text-warn" : "text-ink")}>
                      {formatCount(a.pending_reviews)}
                      <span className="text-ink-3 @4xl:hidden"> chờ nhận xét</span>
                    </span>
                    <span className="text-ink-2">{a.last_active_at ? formatRelativeTime(a.last_active_at) : "—"}</span>
                  </span>
                  <span className="col-start-1 @4xl:col-auto">
                    <AdvisorStatusBadge status={a.status} />
                  </span>
                  <span className="col-start-2 row-start-1 justify-self-end @4xl:col-auto @4xl:row-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-full text-ink-3 hover:text-ink"
                            aria-label={`Thao tác với ${a.full_name}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-[18px]" strokeWidth={1.75} aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={6} className={cn("w-60 p-1.5", floatingSurface)}>
                        <DropdownMenuItem className={menuItem} onClick={() => setDialog({ kind: "edit", advisor: a })}>
                          <PencilLine className="size-4" strokeWidth={1.75} aria-hidden />
                          Sửa thông tin
                        </DropdownMenuItem>
                        <DropdownMenuItem className={menuItem} onClick={() => setDialog({ kind: "reset", advisor: a })}>
                          <KeyRound className="size-4" strokeWidth={1.75} aria-hidden />
                          Đặt lại mật khẩu tạm
                        </DropdownMenuItem>
                        <DropdownMenuItem className={menuItem} onClick={() => router.push(`/admin/students?advisor=${encodeURIComponent(a.id)}`)}>
                          <Users className="size-4" strokeWidth={1.75} aria-hidden />
                          Xem sinh viên phụ trách
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="mx-1.5 my-1 bg-line" />
                        {a.status === "disabled" ? (
                          <DropdownMenuItem className={menuItem} onClick={() => void setDisabled(a, false).catch(() => {})}>
                            <LockKeyholeOpen className="size-4" strokeWidth={1.75} aria-hidden />
                            Mở khoá tài khoản
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className={cn(menuItem, "text-bad focus:text-bad [&_svg]:text-bad")} onClick={() => setLocking(a)}>
                            <LockKeyhole className="size-4" strokeWidth={1.75} aria-hidden />
                            Tạm khoá tài khoản
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AdvisorDialog mode={dialog} onOpenChange={(open) => !open && setDialog(null)} onSaved={reload} />
      <ConfirmDialog
        open={locking !== null}
        onOpenChange={(open) => !open && setLocking(null)}
        icon={LockKeyhole}
        destructive
        title={`Tạm khoá tài khoản ${locking?.full_name ?? ""}?`}
        description={
          locking && locking.student_count > 0
            ? `Cố vấn bị đăng xuất khỏi mọi thiết bị. ${formatCount(locking.student_count)} sinh viên của cố vấn này cần được chuyển sang cố vấn khác.`
            : "Cố vấn bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi bạn mở khoá."
        }
        confirmLabel="Tạm khoá"
        onConfirm={() => (locking ? setDisabled(locking, true) : Promise.resolve())}
      />
    </div>
  )
}
