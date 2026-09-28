"use client"

import { useMemo, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Lock, MessageSquareText, Search, Users, X } from "lucide-react"

import { StudentQuickView } from "@/components/advisor/students/student-quick-view"
import {
  FlagDetail,
  ScoreDelta,
  STATUS_PRIORITY,
  StudentIdentity,
  studentStatus,
  StudentStatusBadge,
} from "@/components/advisor/student-status"
import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { AssignedStudent } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export type StatusFilter = "all" | "pending" | "flagged" | "insufficient" | "improving" | "not_shared"
type SortKey = "priority" | "name" | "delta"

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Trạng thái: Tất cả" },
  { value: "pending", label: "Có báo cáo chờ nhận xét" },
  { value: "flagged", label: "Cần chú ý" },
  { value: "insufficient", label: "Chưa đủ dữ liệu" },
  { value: "improving", label: "Đang tiến bộ" },
  { value: "not_shared", label: "Chưa chia sẻ" },
]

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Ưu tiên cần hỗ trợ" },
  { value: "delta", label: "Tiến bộ nhiều nhất" },
  { value: "name", label: "Tên A → Z" },
]

const PAGE_SIZE = 8
const ALL = "all"

function matchesStatus(s: AssignedStudent, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "pending") return s.pending_reviews > 0
  return studentStatus(s) === filter
}

/** Tên riêng (từ cuối) để sắp xếp theo thói quen tiếng Việt. */
const givenName = (fullName: string) => fullName.trim().split(/\s+/).at(-1) ?? fullName

// Figma: frame "Sinh viên phụ trách" (18:5405). PRD US-ADV-01 AC1/AC2.
export function StudentList({ initialStatus }: { initialStatus: StatusFilter }) {
  const { data: students, error, reload } = useApi(api.listAssignedStudents)
  const [query, setQuery] = useState("")
  const [major, setMajor] = useState(ALL)
  const [cohort, setCohort] = useState(ALL)
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [sort, setSort] = useState<SortKey>("priority")
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<AssignedStudent | null>(null)

  const majors = useMemo(() => [...new Set((students ?? []).map((s) => s.major))].sort(), [students])
  const cohorts = useMemo(() => [...new Set((students ?? []).map((s) => s.cohort))].sort(), [students])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (students ?? []).filter(
      (s) =>
        (major === ALL || s.major === major) &&
        (cohort === ALL || s.cohort === cohort) &&
        matchesStatus(s, status) &&
        (!q ||
          [s.full_name, s.student_code, s.email, s.target_title ?? "", s.target_company ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          )),
    )
    return [...list].sort((a, b) => {
      if (sort === "name") return givenName(a.full_name).localeCompare(givenName(b.full_name), "vi")
      if (sort === "delta") return (b.score_delta ?? -999) - (a.score_delta ?? -999)
      return (
        STATUS_PRIORITY[studentStatus(a)] - STATUS_PRIORITY[studentStatus(b)] ||
        b.pending_reviews - a.pending_reviews ||
        a.full_name.localeCompare(b.full_name, "vi")
      )
    })
  }, [students, query, major, cohort, status, sort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const rows = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const chips = [
    status !== "all" && { key: "status", label: STATUS_ITEMS.find((i) => i.value === status)!.label, clear: () => setStatus("all") },
    major !== ALL && { key: "major", label: `Ngành: ${major}`, clear: () => setMajor(ALL) },
    cohort !== ALL && { key: "cohort", label: `Khoá: ${cohort}`, clear: () => setCohort(ALL) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setPage(0)
    }
  }

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được danh sách sinh viên</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="flex flex-wrap items-center gap-3 font-heading text-[28px] leading-9 font-bold">
          Sinh viên phụ trách
          {students && (
            <Badge variant="blue" className="h-auto px-2.5 py-1 text-sm">
              {students.length} sinh viên
            </Badge>
          )}
        </h1>
        <p className="max-w-2xl text-sm text-ink-2">
          Theo dõi điểm phỏng vấn vòng đầu và gần nhất của từng sinh viên, nhận xét các báo cáo được chia sẻ và hỗ trợ
          kịp thời sinh viên cần chú ý.
        </p>
      </header>

      <Panel className="grid gap-3 p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input
              value={query}
              onChange={(e) => resetPage(setQuery)(e.target.value)}
              placeholder="Tìm theo tên, MSSV, email hoặc vị trí…"
              aria-label="Tìm sinh viên"
              className="h-10 border-transparent bg-surface pl-9"
            />
          </div>
          <FilterSelect
            label="Ngành"
            value={major}
            onChange={resetPage(setMajor)}
            items={[{ value: ALL, label: "Ngành: Tất cả" }, ...majors.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            label="Khoá"
            value={cohort}
            onChange={resetPage(setCohort)}
            items={[{ value: ALL, label: "Khoá: Tất cả" }, ...cohorts.map((c) => ({ value: c, label: `Khoá ${c}` }))]}
          />
          <FilterSelect label="Trạng thái" value={status} onChange={resetPage((v: string) => setStatus(v as StatusFilter))} items={STATUS_ITEMS} />
          <FilterSelect label="Sắp xếp" value={sort} onChange={(v) => setSort(v as SortKey)} items={SORT_ITEMS} />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Đang lọc:</span>
            {chips.map((c) => (
              <span key={c.key} className="flex items-center gap-1 rounded-lg bg-surface py-1 pr-1 pl-2.5 text-ink">
                {c.label}
                <button
                  type="button"
                  onClick={() => {
                    c.clear()
                    setPage(0)
                  }}
                  aria-label={`Bỏ lọc ${c.label}`}
                  className="grid size-5 place-items-center rounded text-ink-2 hover:bg-card hover:text-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setStatus("all")
                setMajor(ALL)
                setCohort(ALL)
                setPage(0)
              }}
              className="text-sm font-medium text-blue hover:underline"
            >
              Xoá tất cả bộ lọc ({chips.length})
            </button>
          </div>
        )}
      </Panel>

      <Panel className="grid gap-0 p-0">
        {!students ? (
          <div className="grid gap-2 p-4" aria-busy="true" aria-label="Đang tải danh sách">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">Sinh viên</th>
                  <th scope="col" className="px-3 py-3">Ngành & Khoá</th>
                  <th scope="col" className="px-3 py-3">Vị trí mục tiêu</th>
                  <th scope="col" className="px-3 py-3">Điểm đầu → gần nhất</th>
                  <th scope="col" className="px-5 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-ink-2">
                      <Users className="mx-auto mb-2 size-6 text-ink-3" aria-hidden />
                      Không có sinh viên nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => {
                    const hidden = s.shared_items === 0
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={cn("cursor-pointer transition-colors hover:bg-blue-soft/30", hidden && "bg-surface/40")}
                      >
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelected(s)
                            }}
                            className="grid gap-1 text-left"
                            aria-label={`Xem nhanh ${s.full_name}`}
                          >
                            <StudentIdentity student={s} muted={hidden} showEmail={false} />
                            {s.pending_reviews > 0 && (
                              <span className="ml-[52px] flex w-fit items-center gap-1 rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-semibold text-blue">
                                <MessageSquareText className="size-3" aria-hidden />
                                {s.pending_reviews} báo cáo chờ nhận xét
                              </span>
                            )}
                          </button>
                        </td>
                        <td className={cn("px-3 py-3.5", hidden && "text-ink-2")}>
                          <p className="font-medium whitespace-nowrap">{s.major}</p>
                          <p className="text-xs text-ink-2">Khoá {s.cohort}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          {hidden ? (
                            <span className="flex items-center gap-1.5 text-xs text-ink-3">
                              <Lock className="size-3.5" aria-hidden />
                              Chưa chia sẻ dữ liệu
                            </span>
                          ) : s.target_title ? (
                            <>
                              <p className="font-medium text-ink">{s.target_title}</p>
                              {s.target_company && <p className="text-xs text-blue">{s.target_company}</p>}
                            </>
                          ) : (
                            <span className="text-xs text-ink-2">Chưa chọn vị trí ứng tuyển</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <ScoreDelta student={s} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="grid justify-items-start gap-1">
                            <StudentStatusBadge student={s} />
                            <FlagDetail student={s} />
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-2">
          <span>
            Hiển thị {filtered.length === 0 ? 0 : current * PAGE_SIZE + 1}–{current * PAGE_SIZE + rows.length} trên{" "}
            {filtered.length} sinh viên
          </span>
          {pageCount > 1 && (
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Trang trước" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              {Array.from({ length: pageCount }, (_, i) => (
                <Button
                  key={i}
                  variant={i === current ? "default" : "ghost"}
                  size="icon-sm"
                  aria-label={`Trang ${i + 1}`}
                  aria-current={i === current ? "page" : undefined}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Trang sau"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </span>
          )}
        </div>
      </Panel>

      <StudentQuickView student={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string }[]
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger className="h-10 w-full min-w-0 border-transparent bg-surface" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
