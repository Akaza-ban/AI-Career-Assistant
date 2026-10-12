"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  ArrowRight,
  BriefcaseBusiness,
  CornerDownLeft,
  FileUp,
  GitCompareArrows,
  MessagesSquare,
  ScanText,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { advisorShell, studentShell } from "@/components/shell/nav-config"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { AssignedStudent, JobDescription, Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PaletteItem {
  id: string
  group: string
  label: string
  meta?: string
  href: string
  icon: LucideIcon
  /** Chuỗi dùng để lọc (không dấu, chữ thường). */
  haystack: string
}

/** Bỏ dấu tiếng Việt để gõ "phan tich" vẫn ra "Phân tích". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()

const item = (group: string, label: string, href: string, icon: LucideIcon, meta?: string, extra = ""): PaletteItem => ({
  id: `${group}:${href}:${label}`,
  group,
  label,
  meta,
  href,
  icon,
  haystack: fold(`${label} ${meta ?? ""} ${extra}`),
})

const STUDENT_ACTIONS = [
  item("Thao tác", "Phân tích CV với 1 vị trí", "/student/analysis/new", ScanText),
  item("Thao tác", "So sánh nhiều vị trí", "/student/analysis/new?mode=multi", GitCompareArrows),
  item("Thao tác", "Luyện phỏng vấn", "/student/interview/new", MessagesSquare),
  item("Thao tác", "Tải CV lên", "/student/cv", FileUp),
]

const GROUP_LIMIT = 6

/**
 * Bảng lệnh Ctrl K (WIREFRAMES A18). Sinh viên: tìm vị trí trong thư viện JD (theo tên, công ty, kỹ năng), thao tác
 * nhanh, đi tới các trang. Cố vấn: tìm sinh viên phụ trách và đi tới các trang. Gõ không dấu vẫn tìm được.
 */
export function CommandPalette({ role, open, onOpenChange }: { role: Role; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [jds, setJds] = useState<JobDescription[] | null>(null)
  const [students, setStudents] = useState<AssignedStudent[] | null>(null)

  // Chỉ tải dữ liệu khi mở lần đầu
  useEffect(() => {
    if (!open) return
    if (role === "student" && jds === null) api.listJdLibrary().then(setJds, () => setJds([]))
    if (role === "advisor" && students === null) api.listAssignedStudents().then(setStudents, () => setStudents([]))
  }, [open, role, jds, students])

  const pages = useMemo(
    () => (role === "advisor" ? advisorShell : studentShell).nav.map((n) => item("Đi tới", n.label, n.href, n.icon)),
    [role],
  )
  const records = useMemo(
    () =>
      role === "student"
        ? (jds ?? []).map((jd) =>
            item(
              "Vị trí",
              jd.title,
              `/student/library/${jd.id}`,
              BriefcaseBusiness,
              jd.company ?? undefined,
              jd.skills.map((s) => s.name).join(" "),
            ),
          )
        : (students ?? []).map((s) =>
            item("Sinh viên", s.full_name, `/advisor/students/${s.id}`, UserRound, s.target?.title ?? s.email, `${s.email} ${s.phone ?? ""}`),
          ),
    [role, jds, students],
  )

  const results = useMemo(() => {
    const q = fold(query.trim())
    const words = q.split(/\s+/).filter(Boolean)
    const matches = (it: PaletteItem) => words.every((w) => it.haystack.includes(w))
    const groups: PaletteItem[][] = [
      records.filter((r) => (q ? matches(r) : false)).slice(0, GROUP_LIMIT),
      (role === "student" ? STUDENT_ACTIONS : []).filter((a) => !q || matches(a)),
      pages.filter((p) => !q || matches(p)),
    ]
    return groups.flat()
  }, [query, records, pages, role])

  function close() {
    onOpenChange(false)
    setQuery("")
    setActive(0)
  }

  function go(it: PaletteItem | undefined) {
    if (!it) return
    close()
    router.push(it.href)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      go(results[active])
    }
  }

  const loading = role === "student" ? jds === null : students === null
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="top-0 flex h-dvh max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-line sm:top-[12vh] sm:h-auto sm:max-h-[70vh] sm:max-w-[600px] sm:rounded-panel sm:shadow-dialog"
      >
        <DialogTitle className="sr-only">Tìm kiếm nhanh</DialogTitle>
        <div className="flex items-center gap-3 border-b border-line px-4 sm:px-5">
          <Search className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={role === "student" ? "Tìm vị trí, kỹ năng, thao tác…" : "Tìm sinh viên, trang…"}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          <button type="button" onClick={close} className="text-sm font-semibold text-ink-2 hover:text-ink sm:hidden">
            Huỷ
          </button>
          <kbd className="hidden rounded-md bg-surface px-1.5 py-px font-sans text-xs text-ink-3 sm:block">Esc</kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Kết quả" className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
          {query.trim() && !loading && results.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-ink-3">Không tìm thấy kết quả cho “{query.trim()}”.</li>
          )}
          {results.map((it, i) => {
            const header = i === 0 || results[i - 1].group !== it.group ? it.group : null
            const Icon = it.icon
            return (
              <li key={it.id} role="presentation">
                {header && <p className="px-3 pt-3 pb-1.5 text-xs font-medium text-ink-3">{header}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
                    i === activeIndex ? "bg-panel text-ink" : "text-ink-2",
                  )}
                >
                  <Icon className="size-[18px] shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{it.label}</span>
                    {it.meta && <span className="text-ink-3"> · {it.meta}</span>}
                  </span>
                  {i === activeIndex && <ArrowRight className="size-4 shrink-0 text-ink-3" aria-hidden />}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="hidden items-center gap-4 border-t border-line px-5 py-2.5 text-xs text-ink-3 sm:flex">
          <span>↑↓ chọn</span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="size-3" aria-hidden /> mở
          </span>
          <span>Esc đóng</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Mở bảng lệnh bằng Ctrl K / ⌘K ở mọi trang trong khung ứng dụng. */
export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onOpen])
}
