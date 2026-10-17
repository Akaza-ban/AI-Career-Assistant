"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Search, SearchX, Users } from "lucide-react"

import { STATUS_META, STATUS_PRIORITY, studentStatus, type StudentStatus } from "@/components/advisor/student-status"
import { StudentRow, StudentTableHead } from "@/components/advisor/students/student-row"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedControl, type SegmentOption } from "@/components/common/segmented-control"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { AssignedStudent } from "@/lib/types"
import { useApi } from "@/lib/use-api"

export type StatusFilter = "all" | "pending" | "not_shared" | StudentStatus
type SortKey = "priority" | "name" | "delta" | "active"

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "Tất cả",
  pending: "Chờ nhận xét",
  flagged: STATUS_META.flagged.label,
  declining: STATUS_META.declining.label,
  insufficient: STATUS_META.insufficient.label,
  stable: STATUS_META.stable.label,
  improving: STATUS_META.improving.label,
  not_shared: "Chưa chia sẻ tài liệu",
}

/** Bốn bộ lọc chính trên thanh phân đoạn; các trạng thái khác vẫn mở được qua `?status=` và ô chọn trên điện thoại. */
const MAIN_FILTERS: StatusFilter[] = ["all", "flagged", "pending", "improving"]
const ALL_FILTERS: StatusFilter[] = ["all", "flagged", "pending", "declining", "improving", "stable", "insufficient", "not_shared"]

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Ưu tiên cần hỗ trợ" },
  { value: "active", label: "Hoạt động gần nhất" },
  { value: "delta", label: "Tiến bộ nhiều nhất" },
  { value: "name", label: "Tên A → Z" },
]

const PAGE_SIZE = 10

function matchesStatus(s: AssignedStudent, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "pending") return s.pending_reviews > 0
  if (filter === "not_shared") return s.shared_items === 0
  return studentStatus(s) === filter
}

/** Tên riêng (từ cuối) để sắp xếp theo thói quen tiếng Việt. */
const givenName = (fullName: string) => fullName.trim().split(/\s+/).at(-1) ?? fullName
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)

const TRIGGER = "h-[38px] min-w-0 rounded-[10px] border-line-strong bg-card px-3 text-sm text-ink shadow-xs"

// Bản vẽ CoVanSinhVien (WIREFRAMES.md A20). PRD US-ADV-01 AC1/AC2, US-ADV-02.
// Bấm một SV để mở rộng tại dòng: STAR yếu nhất, CV trước → sau, gợi ý buổi tới, nhắn tin / mở hồ sơ.
export function StudentList({ initialStatus }: { initialStatus: StatusFilter }) {
  const { data: students, error, reload } = useApi(api.listAssignedStudents)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [sort, setSort] = useState<SortKey>("priority")
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  const counts = useMemo(() => {
    const list = students ?? []
    return Object.fromEntries(ALL_FILTERS.map((f) => [f, list.filter((s) => matchesStatus(s, f)).length])) as Record<
      StatusFilter,
      number
    >
  }, [students])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (students ?? []).filter(
      (s) =>
        matchesStatus(s, status) &&
        (!q ||
          [s.full_name, s.email, s.phone ?? "", s.target?.title ?? "", s.target?.company ?? ""].some(
            (v) => v.toLowerCase().includes(q),
          )),
    )
    return [...list].sort((a, b) => {
      if (sort === "name") return givenName(a.full_name).localeCompare(givenName(b.full_name), "vi")
      if (sort === "delta") return (b.score_delta ?? -99) - (a.score_delta ?? -99)
      if (sort === "active") return time(b.last_active_at) - time(a.last_active_at)
      return (
        STATUS_PRIORITY[studentStatus(a)] - STATUS_PRIORITY[studentStatus(b)] ||
        b.pending_reviews - a.pending_reviews ||
        givenName(a.full_name).localeCompare(givenName(b.full_name), "vi")
      )
    })
  }, [students, query, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  function changeStatus(next: StatusFilter) {
    setStatus(next)
    setPage(0)
    setExpanded(null)
    // Giữ bộ lọc trên URL để quay lại / chia sẻ đúng danh sách (cùng kiểu ?tab= ở hồ sơ SV).
    history.replaceState(null, "", next === "all" ? location.pathname : `?status=${next}`)
  }

  const segments: SegmentOption<StatusFilter>[] = (
    MAIN_FILTERS.includes(status) ? MAIN_FILTERS : [...MAIN_FILTERS, status]
  ).map((f) => ({ value: f, label: FILTER_LABEL[f], count: students ? counts[f] : undefined }))
  const filterItems = ALL_FILTERS.map((f) => ({ value: f, label: `${FILTER_LABEL[f]}${students ? ` (${counts[f]})` : ""}` }))

  const search = (
    <div className="relative w-[calc(100vw-32px)] sm:w-[300px]">
      <Search className="pointer-events-none absolute top-1/2 left-4 z-[1] size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
      <Input data-assistant-id="advisor-student-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPage(0)
          setExpanded(null)
        }}
        aria-label="Tìm sinh viên"
        placeholder="Tìm sinh viên"
        className="glass h-11 rounded-full border-transparent pr-4 pl-10 text-sm shadow-xs"
      />
    </div>
  )

  return (
    <div className="grid gap-8 md:gap-11">
      <PageHeader
        title="Sinh viên phụ trách"
        description={
          students
            ? students.length > 0
              ? `${students.length} sinh viên · ${counts.flagged} cần chú ý · ${counts.pending} có buổi chờ nhận xét`
              : "Bạn chưa được phân công sinh viên nào."
            : "Đang tải danh sách…"
        }
        actions={search}
      />

      {error ? (
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={AlertCircle}
            title="Không tải được danh sách sinh viên"
            description={error.message}
            action={
              <Button size="brand" onClick={reload}>
                Thử lại
              </Button>
            }
          />
        </Panel>
      ) : (
        <section aria-label="Danh sách sinh viên" className="@container min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <SegmentedControl
              aria-label="Lọc theo trạng thái"
              options={segments}
              value={status}
              onChange={changeStatus}
              size="sm"
              className="hidden sm:grid"
            />
            <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
              <Select items={filterItems} value={status} onValueChange={(v) => v && changeStatus(v as StatusFilter)}>
                <SelectTrigger aria-label="Lọc theo trạng thái" className={`${TRIGGER} w-full sm:hidden`}>
                  <SelectValue className="min-w-0 truncate" />
                </SelectTrigger>
                <SelectContent>
                  {filterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select items={SORT_ITEMS} value={sort} onValueChange={(v) => v && setSort(v as SortKey)}>
                <SelectTrigger aria-label="Sắp xếp" className={`${TRIGGER} w-full sm:w-[260px]`}>
                  <span className="shrink-0 text-ink-3 max-sm:hidden">Sắp xếp:</span>
                  <SelectValue className="min-w-0 flex-1 truncate text-left" />
                </SelectTrigger>
                <SelectContent align="end">
                  {SORT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <StudentTableHead />

          {!students ? (
            <div className="grid gap-2 pt-3" aria-busy="true" aria-label="Đang tải danh sách">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có sinh viên phụ trách"
              description="Khi bạn được phân công sinh viên, danh sách sẽ hiện ở đây."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Không có sinh viên nào khớp"
              description="Thử từ khoá khác hoặc chọn bộ lọc Tất cả."
              action={
                <Button
                  variant="soft"
                  className="h-9 rounded-full px-4"
                  onClick={() => {
                    setQuery("")
                    changeStatus("all")
                  }}
                >
                  Xoá bộ lọc
                </Button>
              }
            />
          ) : (
            <ul>
              {rows.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  open={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                />
              ))}
            </ul>
          )}

          {students && filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-ink-3 tabular-nums">
                {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + rows.length} / {filtered.length} sinh viên
              </span>
              {pageCount > 1 && (
                <span className="flex gap-2">
                  <PageButton disabled={current === 0} onClick={() => setPage(current - 1)}>
                    Trước
                  </PageButton>
                  <PageButton disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
                    Sau
                  </PageButton>
                </span>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,transform] hover:bg-panel active:scale-[.97] disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  )
}
