"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, Loader2, LockKeyhole, X } from "lucide-react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/auth-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import {
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  JD_INDUSTRIES,
  LEVEL_LABEL,
  OPTIONAL_FIELDS,
  WORK_MODE_LABEL,
  options,
} from "@/lib/jd"
import { JD_MIN_WORDS, type JdDraft, type JdFields, type JobDescription } from "@/lib/types"
import { cn } from "@/lib/utils"

export type JdDialogMode = { kind: "create" } | { kind: "edit"; jd: JobDescription }

const words = (text: string) => text.split(/\s+/).filter(Boolean).length
const inputClass = "h-11 rounded-xl border-line-strong bg-card px-3.5 text-[15px] md:text-[15px]"
const areaClass = "min-h-[84px] rounded-xl border-line-strong bg-card px-3.5 py-3 text-sm leading-[22px]"

/**
 * Bản vẽ ThemJdPopup / ThemJdXemLai: bước 1 dán toàn văn, hệ thống tách các mục (POST /jd/parse);
 * bước 2 xem lại các trường đã tự điền rồi lưu. Sửa JD mở thẳng bước 2.
 */
export function AddJdDialog({
  mode,
  onOpenChange,
  onSaved,
}: {
  mode: JdDialogMode | null
  onOpenChange: (open: boolean) => void
  onSaved: (jd: JobDescription) => void
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-32px)] gap-0 overflow-hidden rounded-panel p-0 shadow-dialog ring-line sm:max-w-[600px]"
      >
        {mode && (
          <JdFlow
            key={mode.kind === "edit" ? mode.jd.id : "create"}
            mode={mode}
            onDone={(jd) => {
              onSaved(jd)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function JdFlow({ mode, onDone }: { mode: JdDialogMode; onDone: (jd: JobDescription) => void }) {
  const [text, setText] = useState("")
  const [draft, setDraft] = useState<JdDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = mode.kind === "edit"
  const count = words(text)

  async function parse() {
    if (count < JD_MIN_WORDS || busy) return
    setBusy(true)
    setError(null)
    try {
      setDraft(await api.parseJd(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa tách được JD. Hãy thử lại.")
    } finally {
      setBusy(false)
    }
  }

  if (editing || draft) {
    const initial: JdFields = editing ? mode.jd : draft!
    return (
      <ReviewStep
        initial={initial}
        skills={editing ? mode.jd.skills : draft!.skills}
        editing={editing}
        onBack={editing ? undefined : () => setDraft(null)}
        onSave={async (fields) => {
          const jd = editing
            ? await api.updatePastedJd(mode.jd.id, fields)
            : await api.createPastedJd({
                ...fields,
                text,
                reviewed: true,
                skills: draft!.skills,
                skills_source: draft!.skills_source,
              })
          toast.success(editing ? "Đã lưu thay đổi." : "Đã thêm vào JD của bạn.")
          onDone(jd)
        }}
      />
    )
  }

  return (
    <div className="grid gap-4 p-6 sm:p-[26px]">
      <Head step={1} sub="Dán toàn văn tin tuyển dụng. Hệ thống tự tách các mục để bạn xem lại ở bước sau." />
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-[7px]">
        <label htmlFor="jd-text" className="text-sm font-semibold text-ink">
          Nội dung JD
        </label>
        <Textarea
          id="jd-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Dán mô tả công việc, yêu cầu và quyền lợi của tin tuyển dụng…"
          className={cn(areaClass, "h-[min(300px,40dvh)] min-h-[180px] resize-none")}
        />
        <div className="flex flex-wrap justify-between gap-2 text-[13px]">
          <span className="text-ink-3">Gồm cả mô tả công việc, yêu cầu và quyền lợi nếu có.</span>
          <span className={cn("tabular-nums", count >= JD_MIN_WORDS ? "text-good" : "text-ink-3")}>
            {count >= JD_MIN_WORDS ? `${count} từ · đủ để phân tích` : `${count} / ${JD_MIN_WORDS} từ tối thiểu`}
          </span>
        </div>
      </div>
      <PrivacyNote />
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <DialogClose render={<Button type="button" variant="soft" size="brand" disabled={busy} />}>Huỷ</DialogClose>
        <Button size="brand" onClick={parse} disabled={count < JD_MIN_WORDS || busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Đang tách các mục…" : "Tiếp tục"}
        </Button>
      </div>
    </div>
  )
}

function Head({ step, sub, title = "Thêm JD của bạn" }: { step?: number; sub: string; title?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {step && <p className="text-xs font-semibold tracking-[0.03em] text-ink-3 uppercase">Bước {step}/2</p>}
        <DialogTitle className="mt-0.5 text-[22px] leading-7 font-semibold text-ink">{title}</DialogTitle>
        <DialogDescription className="mt-1 text-[15px] leading-6 text-ink-2">{sub}</DialogDescription>
      </div>
      <DialogClose
        render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 rounded-full text-ink-3 hover:text-ink" />}
        aria-label="Đóng"
      >
        <X className="size-[18px]" strokeWidth={1.75} />
      </DialogClose>
    </div>
  )
}

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 text-[13px] leading-5 text-ink-3">
      <LockKeyhole className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      Chỉ bạn thấy JD này. Quản trị viên có thể đưa vị trí phổ biến vào thư viện chung, không kèm tên bạn.
    </p>
  )
}

// ---------- Bước 2: xem lại ----------

const REQUIRED = ["title", "level", "description", "requirements"] as const

function ReviewStep({
  initial,
  skills,
  editing,
  onBack,
  onSave,
}: {
  initial: JdFields
  skills: JobDescription["skills"]
  editing: boolean
  onBack?: () => void
  onSave: (fields: JdFields) => Promise<void>
}) {
  const [f, setF] = useState<JdFields>(() => ({ ...initial }))
  const [more, setMore] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof JdFields>(key: K, value: JdFields[K]) => setF((prev) => ({ ...prev, [key]: value }))
  const missing = (key: (typeof REQUIRED)[number]) => submitted && !String(f[key] ?? "").trim()
  const filled = OPTIONAL_FIELDS.filter((k) => {
    const v = f[k]
    return Array.isArray(v) ? v.length > 0 : Boolean(v)
  }).length
  const summary = [f.company, f.location, f.salary].filter(Boolean).join(" · ")

  async function save() {
    setSubmitted(true)
    if (REQUIRED.some((k) => !String(f[k] ?? "").trim())) return
    setBusy(true)
    setError(null)
    try {
      await onSave(clean(f))
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Chưa lưu được JD.")
      setBusy(false)
    }
  }

  return (
    <div className="flex max-h-[calc(100dvh-32px)] flex-col">
      <div className="px-6 pt-6 sm:px-[26px] sm:pt-[26px]">
        <Head
          step={editing ? undefined : 2}
          title={editing ? "Sửa JD của bạn" : "Thêm JD của bạn"}
          sub="Kiểm tra thông tin đã tự điền. Sửa nếu chưa đúng."
        />
      </div>
      <div className="grid min-h-0 flex-1 gap-3.5 overflow-y-auto px-6 pt-4 pb-1 [scrollbar-width:thin] sm:px-[26px]">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Field label="Tên vị trí" error={missing("title") && "Hãy nhập tên vị trí."}>
            <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Cấp bậc" error={missing("level") && "Hãy chọn cấp bậc."}>
            <Choice value={f.level} items={options(LEVEL_LABEL)} onChange={(v) => set("level", v)} placeholder="Chọn cấp bậc" />
          </Field>
        </div>
        <Field label="Mô tả công việc" error={missing("description") && "Hãy nhập mô tả công việc."}>
          <Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} className={areaClass} />
        </Field>
        <Field label="Yêu cầu ứng viên" error={missing("requirements") && "Hãy nhập yêu cầu ứng viên."}>
          <Textarea value={f.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} className={areaClass} />
        </Field>

        <div className="rounded-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore(!more)}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-ink">Thông tin thêm</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
              {more ? "Không bắt buộc" : `Đã điền ${filled} / ${OPTIONAL_FIELDS.length}${summary ? ` · ${summary}` : ""}`}
            </span>
            <ChevronDown className={cn("size-4 shrink-0 text-ink-3 transition-transform", more && "rotate-180")} aria-hidden />
          </button>
          {more && <MoreFields f={f} set={set} />}
        </div>

        {skills.length > 0 && (
          <div className="grid gap-2 rounded-[14px] bg-panel px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">
              Kỹ năng nhận ra từ JD <span className="font-normal text-ink-3">{skills.length} kỹ năng · mức quan trọng chính xác sau lần phân tích</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s.name} className="inline-flex h-[26px] items-center rounded-full bg-card px-2.5 text-[13px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--line)]">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {!editing && <PrivacyNote />}
      </div>
      <div className="flex flex-col-reverse gap-2.5 px-6 pt-4 pb-6 sm:flex-row sm:justify-between sm:px-[26px] sm:pb-[26px]">
        {onBack ? (
          <Button type="button" variant="soft" size="brand" onClick={onBack} disabled={busy}>
            Quay lại
          </Button>
        ) : (
          <DialogClose render={<Button type="button" variant="soft" size="brand" disabled={busy} />}>Huỷ</DialogClose>
        )}
        <Button size="brand" onClick={save} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Lưu thay đổi" : "Lưu JD"}
        </Button>
      </div>
    </div>
  )
}

/** Bỏ khoảng trắng thừa; chuỗi rỗng thành null (để xoá được trường không bắt buộc). */
function clean(f: JdFields): JdFields {
  const out: JdFields = {}
  for (const [k, v] of Object.entries(f) as [keyof JdFields, unknown][]) {
    if (!(k in EMPTY_FIELDS)) continue
    ;(out as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() || null : v
  }
  return out
}

const EMPTY_FIELDS: Record<keyof JdFields, null> = {
  title: null,
  company: null,
  level: null,
  industry: null,
  employment_type: null,
  work_mode: null,
  location: null,
  salary: null,
  deadline: null,
  experience: null,
  majors: null,
  description: null,
  requirements: null,
  benefits: null,
  how_to_apply: null,
}

function MoreFields({ f, set }: { f: JdFields; set: <K extends keyof JdFields>(key: K, value: JdFields[K]) => void }) {
  return (
    <div className="grid gap-3 border-t border-line px-4 pt-3.5 pb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Công ty">
          <Input value={f.company ?? ""} onChange={(e) => set("company", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Ngành">
          <Choice
            value={f.industry}
            items={JD_INDUSTRIES.map((v) => ({ value: v, label: v }))}
            onChange={(v) => set("industry", v)}
            placeholder="Chọn ngành"
          />
        </Field>
        <Field label="Hình thức">
          <Choice value={f.employment_type} items={options(EMPLOYMENT_LABEL)} onChange={(v) => set("employment_type", v)} placeholder="Chọn hình thức" />
        </Field>
        <Field label="Nơi làm việc">
          <Choice value={f.work_mode} items={options(WORK_MODE_LABEL)} onChange={(v) => set("work_mode", v)} placeholder="Chọn nơi làm việc" />
        </Field>
        <Field label="Địa điểm">
          <Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Mức lương">
          <Input
            value={f.salary ?? ""}
            onChange={(e) => set("salary", e.target.value)}
            placeholder="Ví dụ 12 – 15 triệu"
            className={inputClass}
          />
        </Field>
        <Field label="Kinh nghiệm">
          <Choice value={f.experience} items={options(EXPERIENCE_LABEL)} onChange={(v) => set("experience", v)} placeholder="Chọn mức" />
        </Field>
        <Field label="Hạn nộp">
          <Input type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} className={inputClass} />
        </Field>
      </div>
      <Field label="Chuyên ngành phù hợp">
        <MajorsInput value={f.majors ?? []} onChange={(v) => set("majors", v)} />
      </Field>
      <Field label="Quyền lợi">
        <Textarea value={f.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} className={areaClass} />
      </Field>
      <Field label="Cách ứng tuyển">
        <Textarea value={f.how_to_apply ?? ""} onChange={(e) => set("how_to_apply", e.target.value)} className={areaClass} />
      </Field>
    </div>
  )
}

// ---------- Ô nhập dùng chung (cả form quản trị) ----------

export function Field({ label, error, children }: { label: ReactNode; error?: string | false; children: ReactNode }) {
  return (
    <label className="grid min-w-0 content-start gap-[7px]">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error && <span className="text-[13px] text-bad">{error}</span>}
    </label>
  )
}

export function Choice<T extends string>({
  value,
  items,
  onChange,
  placeholder,
}: {
  value: T | null | undefined
  items: { value: T; label: string }[]
  onChange: (value: T) => void
  placeholder: string
}) {
  return (
    <Select items={items} value={value ?? null} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger className="h-11! w-full rounded-xl border-line-strong bg-card px-3.5 text-[15px] text-ink">
        <SelectValue placeholder={placeholder} />
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

/** Nhập chuyên ngành dạng thẻ: Enter hoặc dấu phẩy để thêm, nút x để bỏ. */
export function MajorsInput({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const name = draft.trim().replace(/,$/, "")
    if (name && !value.includes(name)) onChange([...value, name])
    setDraft("")
  }
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl bg-card px-2.5 py-1.5 shadow-[inset_0_0_0_1px_var(--line-strong)] focus-within:shadow-[inset_0_0_0_1px_var(--ink)]">
      {value.map((m) => (
        <span key={m} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface pr-1.5 pl-2.5 text-[13px] font-medium text-ink-2">
          {m}
          <button type="button" aria-label={`Bỏ ${m}`} onClick={() => onChange(value.filter((x) => x !== m))} className="grid size-4 place-items-center rounded-full hover:bg-line">
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            add()
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        placeholder={value.length ? "" : "Thêm chuyên ngành"}
        className="h-7 min-w-[120px] flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  )
}
