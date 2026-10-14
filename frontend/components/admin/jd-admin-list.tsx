"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertCircle, EyeOff, Eye, MoreHorizontal, PencilLine, Plus, Search, SearchX } from "lucide-react"
import { toast } from "sonner"

import { formatCount } from "@/components/admin/admin-bits"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedControl } from "@/components/common/segmented-control"
import { floatingSurface } from "@/components/shell/notification-menu"
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
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { JD_INDUSTRIES, LEVEL_LABEL } from "@/lib/jd"
import type { AdminJdRow, AdminUploadedJd, JdSkill } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export type JdTab = "library" | "uploaded"

const LIB_GRID = "@4xl:grid @4xl:grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_84px_minmax(130px,1fr)_96px_130px_36px] @4xl:items-center @4xl:gap-4"
const UP_GRID = "@4xl:grid @4xl:grid-cols-[minmax(240px,1.7fr)_minmax(140px,1fr)_84px_110px_110px_170px] @4xl:items-center @4xl:gap-4"
const menuItem = "h-10 gap-2.5 rounded-xl px-3 text-sm font-medium text-ink-2 focus:bg-panel focus:text-ink [&_svg]:text-ink-3"
const fold = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const skillLine = (skills: JdSkill[]) =>
  skills.length ? `${skills.slice(0, 3).map((s) => s.name).join(" · ")} · ${skills.length} kỹ năng` : "Chưa có kỹ năng"

// Bản vẽ QuanTriJd / QuanTriJdSinhVien: thư viện hệ thống (ẩn / hiện, sửa) và JD sinh viên tự dán gộp theo vị trí.
export function JdAdminList({ initialTab }: { initialTab: JdTab }) {
  const router = useRouter()
  const library = useApi(api.listAdminJds)
  const uploaded = useApi(api.listUploadedJds)
  const [tab, setTab] = useState<JdTab>(initialTab)
  const [industry, setIndustry] = useState("all")
  const [query, setQuery] = useState("")
  const [hiding, setHiding] = useState<AdminJdRow | null>(null)
  const active = tab === "library" ? library : uploaded

  const q = fold(query.trim())
  const matches = (title: string, company: string | null, skills: JdSkill[]) =>
    !q || [title, company, ...skills.map((s) => s.name)].some((v) => fold(v).includes(q))
  const libRows = (library.data ?? []).filter(
    (j) => (industry === "all" || j.industry === industry) && matches(j.title, j.company, j.skills),
  )
  const upRows = (uploaded.data ?? []).filter((j) => matches(j.title, j.company, j.skills))
  const shown = (library.data ?? []).filter((j) => j.status === "published").length

  function changeTab(next: JdTab) {
    setTab(next)
    history.replaceState(null, "", next === "library" ? location.pathname : "?tab=uploaded")
  }

  async function setStatus(jd: AdminJdRow, status: "published" | "hidden") {
    try {
      await api.updateAdminJd(jd.id, { status })
      toast.success(status === "hidden" ? `Đã ẩn “${jd.title}” khỏi thư viện.` : `Đã hiện lại “${jd.title}”.`)
      library.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chưa cập nhật được JD.")
      throw err
    }
  }

  const industryItems = [{ value: "all", label: "Ngành: Tất cả" }, ...JD_INDUSTRIES.map((v) => ({ value: v, label: v }))]

  return (
    <div className="grid gap-8 md:gap-10">
      <PageHeader
        title="Thư viện JD"
        description={
          library.data && uploaded.data
            ? `${formatCount(shown)} vị trí đang hiển thị cho sinh viên · ${formatCount(uploaded.data.length)} vị trí sinh viên tự dán.`
            : "Đang tải…"
        }
        actions={
          <Button size="brand" nativeButton={false} render={<Link href="/admin/jds/new" />}>
            <Plus data-icon="inline-start" aria-hidden />
            Thêm JD
          </Button>
        }
      />

      {active.error ? (
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={AlertCircle}
            title="Không tải được thư viện JD"
            description={active.error.message}
            action={
              <Button size="brand" onClick={active.reload}>
                Thử lại
              </Button>
            }
          />
        </Panel>
      ) : (
        <section aria-label="Danh sách JD" className="@container min-w-0">
          <div className="flex flex-wrap items-center gap-3 pb-2">
            <SegmentedControl
              aria-label="Nguồn JD"
              size="sm"
              value={tab}
              onChange={changeTab}
              options={[
                { value: "library", label: "Thư viện hệ thống", count: library.data?.length },
                { value: "uploaded", label: "JD sinh viên tải lên", count: uploaded.data?.length },
              ]}
              className="w-full sm:w-auto"
            />
            {tab === "library" && (
              <Select items={industryItems} value={industry} onValueChange={(v) => v && setIndustry(v)}>
                <SelectTrigger aria-label="Lọc theo ngành" className="h-10 w-full rounded-[10px] border-line-strong bg-card px-3.5 text-sm text-ink-2 shadow-xs sm:w-auto sm:min-w-[190px]">
                  <SelectValue className="min-w-0 truncate" />
                </SelectTrigger>
                <SelectContent>
                  {industryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="hidden flex-1 lg:block" />
            <div className="relative w-full lg:w-[280px]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Tìm JD"
                placeholder="Tìm vị trí, công ty, kỹ năng"
                className="h-10 rounded-[10px] border-line-strong bg-card pr-3 pl-10 text-sm shadow-xs"
              />
            </div>
          </div>

          {!active.data ? (
            <div className="grid gap-2 pt-3" aria-busy="true" aria-label="Đang tải danh sách">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : tab === "library" ? (
            <>
              <div className={cn("hidden border-b border-line py-3 text-[13px] text-ink-3", LIB_GRID)} aria-hidden>
                <span>Vị trí</span>
                <span>Công ty</span>
                <span>Cấp bậc</span>
                <span>Ngành</span>
                <span title="Lượt phân tích CV và buổi phỏng vấn trong 30 ngày">Dùng 30 ngày</span>
                <span>Trạng thái</span>
                <span />
              </div>
              {libRows.length === 0 ? (
                <EmptyState icon={SearchX} title="Không có JD nào khớp" description="Thử từ khoá khác hoặc chọn Ngành: Tất cả." />
              ) : (
                <ul>
                  {libRows.map((jd) => (
                    <li key={jd.id} className={cn("grid grid-cols-[minmax(0,1fr)_36px] gap-x-3 gap-y-1.5 border-b border-line py-3.5", LIB_GRID)}>
                      <Link href={`/admin/jds/${encodeURIComponent(jd.id)}`} className="group min-w-0">
                        <span className={cn("block truncate font-medium group-hover:text-blue", jd.status === "hidden" ? "text-ink-3" : "text-ink")}>{jd.title}</span>
                        <span className="block truncate text-[13px] text-ink-3">{skillLine(jd.skills)}</span>
                      </Link>
                      <span className="col-start-1 truncate text-sm text-ink-2 @4xl:col-auto">{jd.company ?? "—"}</span>
                      <span className="hidden text-sm text-ink-2 @4xl:block">{jd.level ? LEVEL_LABEL[jd.level] : "—"}</span>
                      <span className="hidden truncate text-sm text-ink-2 @4xl:block">{jd.industry ?? "—"}</span>
                      <span className="col-start-1 text-sm text-ink-2 tabular-nums @4xl:col-auto">
                        {formatCount(jd.usage_30d)}
                        <span className="text-ink-3 @4xl:hidden"> lượt dùng 30 ngày</span>
                      </span>
                      <span className="col-start-1 @4xl:col-auto">
                        <Badge variant={jd.status === "hidden" ? "neutral" : "good"}>
                          <span className="size-1.5 rounded-full bg-current" aria-hidden />
                          {jd.status === "hidden" ? "Đã ẩn" : "Đang hiển thị"}
                        </Badge>
                      </span>
                      <span className="col-start-2 row-start-1 justify-self-end @4xl:col-auto @4xl:row-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-ink-3 hover:text-ink" aria-label={`Thao tác với ${jd.title}`} />}
                          >
                            <MoreHorizontal className="size-[18px]" strokeWidth={1.75} aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" sideOffset={6} className={cn("w-56 p-1.5", floatingSurface)}>
                            <DropdownMenuItem className={menuItem} onClick={() => router.push(`/admin/jds/${encodeURIComponent(jd.id)}`)}>
                              <PencilLine className="size-4" strokeWidth={1.75} aria-hidden />
                              Sửa JD
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="mx-1.5 my-1 bg-line" />
                            {jd.status === "hidden" ? (
                              <DropdownMenuItem className={menuItem} onClick={() => void setStatus(jd, "published").catch(() => {})}>
                                <Eye className="size-4" strokeWidth={1.75} aria-hidden />
                                Hiện lại
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className={cn(menuItem, "text-bad focus:text-bad [&_svg]:text-bad")} onClick={() => setHiding(jd)}>
                                <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
                                Ẩn khỏi thư viện
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <UploadedTable rows={upRows} />
          )}
        </section>
      )}

      <ConfirmDialog
        open={hiding !== null}
        onOpenChange={(open) => !open && setHiding(null)}
        icon={EyeOff}
        destructive
        title={`Ẩn “${hiding?.title ?? ""}” khỏi thư viện?`}
        description="Sinh viên không thấy vị trí này trong Thư viện JD và gợi ý nữa. Các lượt phân tích, phỏng vấn đã làm vẫn giữ nguyên; bạn có thể hiện lại bất cứ lúc nào."
        confirmLabel="Ẩn JD"
        onConfirm={() => (hiding ? setStatus(hiding, "hidden") : Promise.resolve())}
      />
    </div>
  )
}

function UploadedTable({ rows }: { rows: AdminUploadedJd[] }) {
  return (
    <>
      <div className={cn("hidden border-b border-line py-3 text-[13px] text-ink-3", UP_GRID)} aria-hidden>
        <span>Vị trí</span>
        <span>Công ty</span>
        <span>Cấp bậc</span>
        <span>Số sinh viên dán</span>
        <span>Gần nhất</span>
        <span />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="Chưa có JD nào" description="JD sinh viên tự dán sẽ được gộp theo vị trí và công ty ở đây, không kèm tên sinh viên." />
      ) : (
        <ul>
          {rows.map((jd) => (
            <li key={jd.sample_jd_id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-b border-line py-3.5", UP_GRID)}>
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{jd.title}</span>
                <span className="block truncate text-[13px] text-ink-3">{skillLine(jd.skills)}</span>
              </span>
              <span className="col-start-1 truncate text-sm text-ink-2 @4xl:col-auto">
                {jd.company ?? "—"}
                <span className="@4xl:hidden">{jd.level ? ` · ${LEVEL_LABEL[jd.level]}` : ""}</span>
              </span>
              <span className="hidden text-sm text-ink-2 @4xl:block">{jd.level ? LEVEL_LABEL[jd.level] : "—"}</span>
              <span className="col-start-1 text-sm text-ink-2 tabular-nums @4xl:col-auto">{formatCount(jd.student_count)} sinh viên</span>
              <span className="hidden text-sm text-ink-2 @4xl:block" title={formatDate(jd.last_added_at)}>
                {formatRelativeTime(jd.last_added_at)}
              </span>
              <span className="col-start-2 row-start-1 self-center justify-self-end @4xl:col-auto @4xl:row-auto">
                {jd.library_jd_id ? (
                  <Link href={`/admin/jds/${encodeURIComponent(jd.library_jd_id)}`} className="text-[13px] text-ink-3 hover:text-ink">
                    Đã có trong thư viện
                  </Link>
                ) : (
                  <Button
                    variant="outline"
                    className="h-8 rounded-full border-transparent bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel"
                    nativeButton={false}
                    render={<Link href={`/admin/jds/new?from=${encodeURIComponent(jd.sample_jd_id)}`} />}
                  >
                    Đưa vào thư viện
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
