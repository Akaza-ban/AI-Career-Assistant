"use client"

import { useMemo, useState } from "react"
import { Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"

import { formatCount } from "@/components/admin/admin-bits"
import { StudentAvatar } from "@/components/advisor/students/student-bits"
import { FormAlert } from "@/components/auth/auth-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import type { AdminAdvisor, AdminStudent } from "@/lib/types"
import { cn } from "@/lib/utils"

const NAMES_SHOWN = 3

function namesOf(students: AdminStudent[]) {
  const names = students.slice(0, NAMES_SHOWN).map((s) => s.full_name).join(", ")
  const rest = students.length - NAMES_SHOWN
  return rest > 0 ? `${names} và ${rest} người khác` : names
}

/** Bản vẽ GanCoVan: chọn một cố vấn (đang hoạt động) cho một hoặc nhiều sinh viên. */
export function AssignDialog({
  students,
  advisors,
  onOpenChange,
  onAssigned,
}: {
  /** null = đóng. */
  students: AdminStudent[] | null
  advisors: AdminAdvisor[]
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  return (
    <Dialog open={students !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-[18px] rounded-panel p-6 shadow-dialog ring-line sm:max-w-[560px] sm:p-[26px]">
        {students && (
          <AssignForm
            key={students.map((s) => s.id).join(",")}
            students={students}
            advisors={advisors}
            onDone={() => {
              onAssigned()
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ students, advisors, onDone }: { students: AdminStudent[]; advisors: AdminAdvisor[]; onDone: () => void }) {
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const single = students.length === 1 ? students[0] : null
  // Cố vấn hiện tại khi mọi SV được chọn cùng một cố vấn: không chọn lại được
  const sameCurrent = students.every((s) => s.advisor && s.advisor.id === students[0].advisor?.id) ? students[0].advisor?.id : null
  const reassigning = students.some((s) => s.advisor)

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    return advisors
      .filter((a) => a.status !== "disabled")
      .filter((a) => !q || [a.full_name, a.title, a.email].some((v) => v.toLowerCase().includes(q)))
  }, [advisors, query])
  const advisor = advisors.find((a) => a.id === picked)

  const title = single
    ? `${single.advisor ? "Đổi" : "Gán"} cố vấn cho ${single.full_name}`
    : `Gán cố vấn cho ${formatCount(students.length)} sinh viên`

  async function submit() {
    if (!advisor) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.assignAdvisor(
        students.map((s) => s.id),
        advisor.id,
      )
      toast.success(
        res.assigned > 0 ? `Đã gán ${formatCount(res.assigned)} sinh viên cho ${advisor.full_name}.` : `Sinh viên đã thuộc ${advisor.full_name}.`,
      )
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa gán được cố vấn. Hãy thử lại.")
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[15px] leading-6 text-ink-2">
            {single ? (single.advisor ? `Đang phụ trách: ${single.advisor.full_name}` : single.email) : namesOf(students)}
          </DialogDescription>
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 rounded-full text-ink-3 hover:text-ink" />}
          aria-label="Đóng"
        >
          <X className="size-[18px]" strokeWidth={1.75} />
        </DialogClose>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 z-[1] size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm cố vấn"
          placeholder="Tìm cố vấn"
          className="h-[42px] rounded-xl border-line-strong bg-card pr-3 pl-10 text-sm"
        />
      </div>

      <div role="radiogroup" aria-label="Cố vấn" className="-mx-1 grid max-h-[min(340px,45vh)] gap-2 overflow-y-auto px-1 py-0.5 [scrollbar-width:thin]">
        {options.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">Không có cố vấn nào khớp.</p>
        ) : (
          options.map((a) => {
            const current = a.id === sameCurrent
            const on = a.id === picked
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={current}
                onClick={() => setPicked(a.id)}
                className={cn(
                  "flex items-center gap-3.5 rounded-[14px] px-4 py-3.5 text-left transition-colors",
                  on ? "bg-panel shadow-[inset_0_0_0_1.5px_var(--ink)]" : "shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel",
                  current && "cursor-default opacity-60 hover:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px]",
                    on ? "border-ink" : "border-line-strong",
                  )}
                  aria-hidden
                >
                  {on && <span className="size-2 rounded-full bg-ink" />}
                </span>
                <StudentAvatar name={a.full_name} src={a.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{a.full_name}</span>
                  <span className="block truncate text-[13px] text-ink-3">{current ? "Đang phụ trách" : a.title}</span>
                </span>
                <span className="shrink-0 text-right text-[13px] leading-5 text-ink-2 tabular-nums">
                  {formatCount(a.student_count)} sinh viên
                  <br />
                  <span className={a.pending_reviews >= 5 ? "text-warn" : "text-ink-3"}>
                    {formatCount(a.pending_reviews)} chờ nhận xét
                  </span>
                </span>
              </button>
            )
          })
        )}
      </div>

      <p className="text-[13px] leading-5 text-ink-3">
        Sinh viên nhận thông báo có cố vấn mới. Tài liệu vẫn riêng tư cho tới khi sinh viên bật chia sẻ
        {reassigning ? "; sinh viên đổi cố vấn thì tài liệu đã chia sẻ chuyển về riêng tư." : "."}
      </p>

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <DialogClose render={<Button type="button" variant="soft" size="brand" disabled={busy} />}>Huỷ</DialogClose>
        <Button size="brand" disabled={!advisor || busy} onClick={submit} className="min-w-0">
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          <span className="truncate">{advisor ? `Gán cho ${advisor.full_name}` : "Chọn một cố vấn"}</span>
        </Button>
      </div>
    </>
  )
}
