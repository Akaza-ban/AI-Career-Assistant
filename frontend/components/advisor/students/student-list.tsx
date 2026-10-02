"use client"

import Link from "next/link"
import { Fragment, useCallback, useMemo, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Lightbulb,
  LineChart,
  MessageCircle,
  MessageSquareText,
  Radar,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react"

import {
  CvProgressBlock,
  InterviewProgressBlock,
  StarAverageBars,
  SuggestionList,
} from "@/components/advisor/progress-blocks"
import {
  FlagDetail,
  ScoreDelta,
  SharingBadge,
  STATUS_META,
  STATUS_PRIORITY,
  StudentIdentity,
  studentStatus,
  StudentStatusBadge,
  type StudentStatus,
} from "@/components/advisor/student-status"
import { useChat } from "@/components/chat/chat-context"
import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AssignedStudent } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export type StatusFilter = "all" | "pending" | "not_shared" | StudentStatus
type SortKey = "priority" | "name" | "delta" | "active"

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Trạng thái: Tất cả" },
  { value: "pending", label: "Có báo cáo chờ nhận xét" },
  ...(["flagged", "declining", "insufficient", "stable", "improving"] as const).map((v) => ({ value: v, label: STATUS_META[v].label })),
  { value: "not_shared", label: "Chưa chia sẻ tài liệu" },
]

const SORT_ITEMS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Ưu tiên cần hỗ trợ" },
  { value: "delta", label: "Tiến bộ nhiều nhất" },
  { value: "active", label: "Hoạt động gần nhất" },
  { value: "name", label: "Tên A → Z" },
]

const PAGE_SIZE = 10
const ALL = "all"
const COLUMNS = 6

function matchesStatus(s: AssignedStudent, filter: StatusFilter): boolean {
  if (filter === "all") return true
  if (filter === "pending") return s.pending_reviews > 0
  if (filter === "not_shared") return s.shared_items === 0
  return studentStatus(s) === filter
}

/** Tên riêng (từ cuối) để sắp xếp theo thói quen tiếng Việt. */
const givenName = (fullName: string) => fullName.trim().split(/\s+/).at(-1) ?? fullName
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)

// Figma: frame "Sinh viên phụ trách" (18:5405). PRD US-ADV-01 AC1/AC2, US-ADV-02.
// Bấm một SV để mở rộng ngay tại dòng: tiến bộ theo vị trí, S/T/A/R, tiến bộ CV và gợi ý cho buổi tư vấn tới.
export function StudentList({ initialStatus }: { initialStatus: StatusFilter }) {
  const { data: students, error, reload } = useApi(api.listAssignedStudents)
  const [query, setQuery] = useState("")
  const [major, setMajor] = useState(ALL)
  const [cohort, setCohort] = useState(ALL)
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [sort, setSort] = useState<SortKey>("priority")
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  const majors = useMemo(() => [...new Set((students ?? []).flatMap((s) => (s.major ? [s.major] : [])))].sort(), [students])
  const cohorts = useMemo(() => [...new Set((students ?? []).flatMap((s) => (s.cohort ? [s.cohort] : [])))].sort(), [students])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (students ?? []).filter(
      (s) =>
        (major === ALL || s.major === major) &&
        (cohort === ALL || s.cohort === cohort) &&
        matchesStatus(s, status) &&
        (!q ||
          [s.full_name, s.student_code ?? "", s.email, s.target?.title ?? "", s.target?.company ?? ""].some((v) =>
            v.toLowerCase().includes(q),
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
      setExpanded(null)
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
        <p className="max-w-3xl text-sm text-ink-2">
          {/* Điểm STAR (0–5) buổi đầu → gần nhất ở vị trí mỗi sinh viên đang luyện. Bấm vào một sinh viên để xem nhanh tiến bộ
          và gợi ý cho buổi tư vấn tới. Nội dung CV và báo cáo chỉ xem được khi sinh viên bật chia sẻ. */}
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
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-blue-soft/40 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-ink-2 uppercase">
                <tr>
                  <th scope="col" className="px-5 py-3">Sinh viên</th>
                  <th scope="col" className="px-3 py-3">Vị trí đang luyện</th>
                  <th scope="col" className="px-3 py-3">Điểm đầu → gần nhất</th>
                  <th scope="col" className="px-3 py-3">Trạng thái</th>
                  <th scope="col" className="px-3 py-3">Hoạt động</th>
                  <th scope="col" className="w-12 px-3 py-3">
                    <span className="sr-only">Mở rộng</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS} className="px-5 py-12 text-center text-ink-2">
                      <Users className="mx-auto mb-2 size-6 text-ink-3" aria-hidden />
                      Không có sinh viên nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => {
                    const open = expanded === s.id
                    const toggle = () => setExpanded(open ? null : s.id)
                    return (
                      <Fragment key={s.id}>
                        <tr onClick={toggle} className={cn("cursor-pointer transition-colors hover:bg-blue-soft/30", open && "bg-blue-soft/30")}>
                          <td className="px-5 py-3.5">
                            <div className="grid gap-1">
                              <StudentIdentity student={s} showEmail={false} />
                              {s.pending_reviews > 0 && (
                                <span className="ml-[52px] flex w-fit items-center gap-1 rounded-full bg-blue-soft px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-blue">
                                  <MessageSquareText className="size-3" aria-hidden />
                                  {s.pending_reviews} báo cáo chờ nhận xét
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            {s.target ? (
                              <>
                                <p className="font-medium text-ink">{s.target.title}</p>
                                <p className="text-xs text-ink-2">
                                  {s.focus_session_count > 0 ? `${s.focus_session_count} buổi` : "Chưa phỏng vấn"}
                                  {s.latest_match !== null && ` · CV khớp ${Math.round(s.latest_match)}%`}
                                </p>
                              </>
                            ) : (
                              <span className="text-xs text-ink-2">Chưa chọn vị trí ứng tuyển</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <ScoreDelta student={s} />
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="grid justify-items-start gap-1">
                              <StudentStatusBadge student={s} />
                              <FlagDetail student={s} />
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <p className="text-xs text-ink">{s.last_active_at ? formatRelativeTime(s.last_active_at) : "Chưa hoạt động"}</p>
                            <SharingBadge student={s} />
                          </td>
                          <td className="px-3 py-3.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggle()
                              }}
                              aria-expanded={open}
                              aria-label={open ? `Thu gọn ${s.full_name}` : `Xem nhanh tiến bộ của ${s.full_name}`}
                              className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-card hover:text-ink"
                            >
                              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-surface/50">
                            <td colSpan={COLUMNS} className="px-5 py-5">
                              <StudentProgressRow student={s} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
    </div>
  )
}

/** Dòng mở rộng: tải số liệu tiến bộ khi mở (xem được cả khi SV chưa chia sẻ tài liệu). */
function StudentProgressRow({ student }: { student: AssignedStudent }) {
  const fetchProgress = useCallback(() => api.getAdvisorStudentProgress(student.id), [student.id])
  const { data, error, reload } = useApi(fetchProgress)
  const profileHref = `/advisor/students/${encodeURIComponent(student.id)}`
  const { openChat } = useChat()

  if (error) {
    return (
      <p className="flex items-center gap-2 text-sm text-bad">
        <AlertCircle className="size-4" aria-hidden />
        {error.message}
        <button type="button" onClick={reload} className="font-medium text-blue hover:underline">
          Thử lại
        </button>
      </p>
    )
  }
  if (!data) {
    return (
      <div className="grid gap-3 lg:grid-cols-3" aria-busy="true" aria-label="Đang tải tiến bộ">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    )
  }
  const focus = data.interview_progress.find((g) => g.jd.id === student.target?.id) ?? data.interview_progress[0]
  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-line" aria-label="Tiến bộ phỏng vấn">
          <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
            <LineChart className="size-4 text-blue" aria-hidden />
            Tiến bộ phỏng vấn
            {data.interview_progress.length > 1 && (
              <span className="font-normal text-ink-2">· {data.interview_progress.length} vị trí</span>
            )}
          </h3>
          {focus ? (
            <InterviewProgressBlock group={focus} compact />
          ) : (
            <p className="text-sm text-ink-2">Sinh viên chưa luyện phỏng vấn buổi nào.</p>
          )}
        </section>
        <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-line" aria-label="Tiêu chí STAR">
          <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
            <Radar className="size-4 text-violet" aria-hidden />
            Tiêu chí STAR
          </h3>
          <StarAverageBars star={data.star} insight={data.insight} />
        </section>
        <div className="grid gap-4">
          <section className="grid gap-3 rounded-xl bg-card p-4 ring-1 ring-line" aria-label="Tiến bộ CV">
            <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
              <FileCheck2 className="size-4 text-blue" aria-hidden />
              Độ khớp CV qua các phiên bản
            </h3>
            <CvProgressBlock groups={data.cv_progress} />
          </section>
          <section className="grid gap-3 rounded-xl bg-blue-soft/40 p-4" aria-label="Gợi ý cho buổi tư vấn tới">
            <h3 className="flex items-center gap-2 font-heading text-sm font-bold">
              <Lightbulb className="size-4 text-warn" aria-hidden />
              Gợi ý cho buổi tư vấn tới
            </h3>
            <SuggestionList items={data.suggestions} />
          </section>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="soft" className="h-9" onClick={() => openChat(student.id)}>
          <MessageCircle aria-hidden />
          Nhắn tin
        </Button>
        <Button className="h-9" nativeButton={false} render={<Link href={profileHref} />}>
          <UserRound aria-hidden />
          Mở hồ sơ đầy đủ
        </Button>
      </div>
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
