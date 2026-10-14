"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { AlertCircle, Check, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { FormAlert } from "@/components/auth/auth-fields"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { Zone } from "@/components/common/zone"
import { Choice, Field, MajorsInput } from "@/components/student/library/add-jd-dialog"
import { Facts, JdBody } from "@/components/student/library/jd-detail"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL, JD_INDUSTRIES, LEVEL_LABEL, WORK_MODE_LABEL, options } from "@/lib/jd"
import { JD_MIN_WORDS, type AdminJdDetail, type JdFields, type JdSkill, type RequirementImportance } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const inputClass = "h-11 rounded-xl border-line-strong bg-card px-3.5 text-[15px] md:text-[15px]"
const areaClass = "min-h-[92px] rounded-xl border-line-strong bg-card px-3.5 py-3 text-sm leading-[22px]"
const REQUIRED = ["title", "company", "level", "industry", "experience", "employment_type", "work_mode", "location", "description", "requirements"] as const
const IMPORTANCE: { value: RequirementImportance; label: string }[] = [
  { value: "required", label: "Bắt buộc" },
  { value: "preferred", label: "Ưu tiên" },
  { value: "additional", label: "Cộng thêm" },
]
const words = (text: string | null | undefined) => (text ?? "").split(/\s+/).filter(Boolean).length
const optional = (label: string) => (
  <>
    {label} <span className="font-normal text-ink-3">(không bắt buộc)</span>
  </>
)

/**
 * Bản vẽ QuanTriThemJd: thêm JD vào thư viện (hoặc sửa / đưa JD sinh viên tải lên vào thư viện) theo cấu trúc chung,
 * bắt buộc nhiều trường hơn phía sinh viên và chỉnh mức quan trọng của từng kỹ năng.
 */
export function JdForm({ id, fromId }: { id?: string; fromId?: string }) {
  const sourceId = id ?? fromId ?? null
  const fetchSource = useCallback(() => (sourceId ? api.getAdminJd(sourceId) : Promise.resolve(null)), [sourceId])
  const source = useApi(fetchSource)

  if (source.error) {
    return (
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được JD"
          description={source.error.message}
          action={
            <Button size="brand" nativeButton={false} render={<Link href="/admin/jds" />}>
              Về Thư viện JD
            </Button>
          }
        />
      </Panel>
    )
  }
  if (source.loading) {
    return (
      <div className="grid gap-6 pt-12" aria-busy="true">
        <Skeleton className="h-11 w-96 max-w-full" />
        <Skeleton className="h-[520px] rounded-card" />
      </div>
    )
  }
  return <JdFormBody key={sourceId ?? "new"} source={source.data ?? null} editId={id ?? null} fromId={fromId ?? null} />
}

function JdFormBody({ source, editId, fromId }: { source: AdminJdDetail | null; editId: string | null; fromId: string | null }) {
  const router = useRouter()
  const [f, setF] = useState<JdFields>(() => (source ? pick(source) : {}))
  const [skills, setSkills] = useState<JdSkill[]>(() => (source?.skills ?? []).map((s) => ({ ...s, importance: s.importance ?? "required" })))
  const [rawText, setRawText] = useState<string | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [preview, setPreview] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof JdFields>(key: K, value: JdFields[K]) => setF((prev) => ({ ...prev, [key]: value }))
  const empty = (key: keyof JdFields) => !String(f[key] ?? "").trim()
  const missing = (key: (typeof REQUIRED)[number]) => submitted && empty(key)

  const filledRequired = REQUIRED.filter((k) => !empty(k)).length
  const contentWords = words(f.description) + words(f.requirements)
  const requiredSkills = skills.filter((s) => s.importance === "required").length
  const checks = [
    { title: "Thông tin chung", detail: `${filledRequired} / ${REQUIRED.length} trường bắt buộc`, ok: filledRequired === REQUIRED.length },
    { title: "Nội dung", detail: `Mô tả và yêu cầu · ${contentWords} từ`, ok: !empty("description") && !empty("requirements") },
    {
      title: "Kỹ năng",
      detail: skills.length ? `${skills.length} kỹ năng, ${requiredSkills} bắt buộc` : "Chưa có kỹ năng",
      ok: requiredSkills > 0,
    },
  ]

  async function save() {
    setSubmitted(true)
    if (!checks.every((c) => c.ok)) {
      setError("Hãy điền đủ các trường bắt buộc và thêm ít nhất một kỹ năng bắt buộc.")
      return
    }
    const text = rawText ?? null
    if (text && words(text) < JD_MIN_WORDS) {
      setError(`Toàn văn đã dán cần tối thiểu ${JD_MIN_WORDS} từ.`)
      return
    }
    setBusy(true)
    setError(null)
    const fields = clean(f)
    try {
      if (editId) {
        await api.updateAdminJd(editId, { ...fields, skills })
        toast.success("Đã lưu thay đổi.")
      } else {
        await api.createAdminJd({ ...fields, skills, text, source_jd_id: fromId })
        toast.success(`Đã thêm “${fields.title}” vào thư viện.`)
      }
      router.push("/admin/jds")
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Chưa lưu được JD.")
      setBusy(false)
    }
  }

  const fromStudent = source?.source === "pasted"
  return (
    <div className="grid gap-8 md:gap-10">
      <PageHeader
        title={editId ? "Sửa JD" : "Thêm JD vào thư viện"}
        description={
          editId
            ? source?.title
            : fromStudent
              ? `Từ JD sinh viên tải lên: “${source?.title}”. JD gốc của sinh viên giữ nguyên.`
              : "Điền theo cấu trúc chung, hoặc dán toàn văn để tự điền."
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-11">
          <PasteBox
            open={pasteOpen}
            onOpenChange={setPasteOpen}
            onParsed={(draft, text) => {
              setF((prev) => ({ ...prev, ...pick(draft, true) }))
              if (draft.skills.length) setSkills(draft.skills)
              setRawText(text)
              toast.success(draft.used_ai ? "Đã tách bằng quy tắc và AI. Hãy kiểm tra lại." : "Đã tự điền. Hãy kiểm tra lại từng trường.")
            }}
          />

          <Zone id="jd-general" title="Thông tin chung">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Tên vị trí" error={missing("title") && "Hãy nhập tên vị trí."}>
                  <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Công ty" error={missing("company") && "Hãy nhập công ty."}>
                <Input value={f.company ?? ""} onChange={(e) => set("company", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Cấp bậc" error={missing("level") && "Hãy chọn cấp bậc."}>
                <Choice value={f.level} items={options(LEVEL_LABEL)} onChange={(v) => set("level", v)} placeholder="Chọn cấp bậc" />
              </Field>
              <Field label="Ngành" error={missing("industry") && "Hãy chọn ngành."}>
                <Choice
                  value={f.industry}
                  items={JD_INDUSTRIES.map((v) => ({ value: v, label: v }))}
                  onChange={(v) => set("industry", v)}
                  placeholder="Chọn ngành"
                />
              </Field>
              <Field label="Kinh nghiệm" error={missing("experience") && "Hãy chọn mức kinh nghiệm."}>
                <Choice value={f.experience} items={options(EXPERIENCE_LABEL)} onChange={(v) => set("experience", v)} placeholder="Chọn mức" />
              </Field>
              <Field label="Hình thức" error={missing("employment_type") && "Hãy chọn hình thức."}>
                <Choice value={f.employment_type} items={options(EMPLOYMENT_LABEL)} onChange={(v) => set("employment_type", v)} placeholder="Chọn hình thức" />
              </Field>
              <Field label="Nơi làm việc" error={missing("work_mode") && "Hãy chọn nơi làm việc."}>
                <Choice value={f.work_mode} items={options(WORK_MODE_LABEL)} onChange={(v) => set("work_mode", v)} placeholder="Chọn nơi làm việc" />
              </Field>
              <Field label="Địa điểm" error={missing("location") && "Hãy nhập địa điểm."}>
                <Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} className={inputClass} />
              </Field>
              <Field label={optional("Mức lương")}>
                <Input value={f.salary ?? ""} onChange={(e) => set("salary", e.target.value)} placeholder="12 – 15 triệu hoặc Thoả thuận" className={inputClass} />
              </Field>
              <Field label={optional("Hạn nộp")}>
                <Input type="date" value={f.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} className={inputClass} />
              </Field>
              <Field label={optional("Chuyên ngành phù hợp")}>
                <MajorsInput value={f.majors ?? []} onChange={(v) => set("majors", v)} />
              </Field>
            </div>
          </Zone>

          <Zone id="jd-content" title="Nội dung">
            <div className="grid gap-4">
              <Field label="Mô tả công việc" error={missing("description") && "Hãy nhập mô tả công việc."}>
                <Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} className={cn(areaClass, "min-h-[120px]")} />
              </Field>
              <Field label="Yêu cầu ứng viên" error={missing("requirements") && "Hãy nhập yêu cầu ứng viên."}>
                <Textarea value={f.requirements ?? ""} onChange={(e) => set("requirements", e.target.value)} className={cn(areaClass, "min-h-[120px]")} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={optional("Quyền lợi")}>
                  <Textarea value={f.benefits ?? ""} onChange={(e) => set("benefits", e.target.value)} placeholder="Lương, thưởng, đào tạo…" className={areaClass} />
                </Field>
                <Field label={optional("Cách ứng tuyển")}>
                  <Textarea value={f.how_to_apply ?? ""} onChange={(e) => set("how_to_apply", e.target.value)} placeholder="Nộp qua đâu, liên hệ ai…" className={areaClass} />
                </Field>
              </div>
            </div>
          </Zone>

          <Zone id="jd-skills" title="Kỹ năng yêu cầu" aside={<span className="text-[13px] text-ink-3">Mức quan trọng dùng để chấm độ khớp CV</span>}>
            <SkillsEditor skills={skills} onChange={setSkills} showError={submitted && requiredSkills === 0} />
          </Zone>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          <div className="grid gap-3 rounded-card bg-card p-5 shadow-[var(--shadow-sm-token),0_0_0_1px_var(--line)]">
            <h2 className="text-base font-semibold text-ink">Trước khi hiển thị</h2>
            <ul className="grid gap-3">
              {checks.map((c) => (
                <li key={c.title} className="flex items-start gap-2.5">
                  <span className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full", c.ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn")}>
                    {c.ok ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : <span className="size-1.5 rounded-full bg-current" aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{c.title}</span>
                    <span className="block text-[13px] text-ink-3">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {error && <FormAlert>{error}</FormAlert>}
            <div className="mt-1 grid gap-2">
              <Button size="brand" className="w-full" onClick={save} disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                {editId ? "Lưu thay đổi" : "Lưu và hiển thị"}
              </Button>
              <Button variant="soft" size="brand" className="w-full" onClick={() => setPreview(true)} disabled={empty("title")}>
                Xem như sinh viên
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-32px)] gap-0 overflow-y-auto rounded-panel p-0 shadow-dialog ring-line sm:max-w-[920px]">
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-line bg-card/95 px-6 py-4 backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-[0.03em] text-ink-3 uppercase">Xem như sinh viên</p>
              <DialogTitle className="truncate text-[22px] leading-7 font-semibold text-ink">{f.title}</DialogTitle>
              <p className="truncate text-[15px] text-ink-2">
                {[f.company, f.level && LEVEL_LABEL[f.level], f.industry].filter(Boolean).join(" · ")}
              </p>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-ink-3 hover:text-ink" />} aria-label="Đóng">
              <X className="size-[18px]" strokeWidth={1.75} />
            </DialogClose>
          </div>
          <div className="grid gap-10 px-6 pt-10 pb-8">
            <Facts jd={{ ...clean(f), id: "preview", title: f.title ?? "", skills, content: "", source: "library", skills_source: "admin" } as AdminJdDetail} />
            <JdBody jd={{ ...clean(f), id: "preview", title: f.title ?? "", skills, content: "", source: "library", skills_source: "admin" } as AdminJdDetail} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const FIELD_KEYS = [
  "title",
  "company",
  "level",
  "industry",
  "employment_type",
  "work_mode",
  "location",
  "salary",
  "deadline",
  "experience",
  "majors",
  "description",
  "requirements",
  "benefits",
  "how_to_apply",
] as const satisfies readonly (keyof JdFields)[]

/** Chỉ các trường của cấu trúc chung; onlyFilled: bỏ trường trống (khi tự điền từ bản tách, không xoá giá trị đã nhập). */
function pick(jd: JdFields, onlyFilled = false): JdFields {
  const out: JdFields = {}
  for (const key of FIELD_KEYS) {
    const value = jd[key]
    if (onlyFilled && (value === null || value === undefined || (Array.isArray(value) && value.length === 0))) continue
    ;(out as Record<string, unknown>)[key] = value
  }
  if (out.industry && !(JD_INDUSTRIES as readonly string[]).includes(out.industry)) out.industry = null
  return out
}

function clean(f: JdFields): JdFields {
  const out = pick(f)
  for (const key of FIELD_KEYS) {
    const value = out[key]
    if (typeof value === "string") (out as Record<string, unknown>)[key] = value.trim() || null
  }
  return out
}

function PasteBox({
  open,
  onOpenChange,
  onParsed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onParsed: (draft: Awaited<ReturnType<typeof api.parseJd>>, text: string) => void
}) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const count = words(text)

  async function parse() {
    setBusy(true)
    setError(null)
    try {
      onParsed(await api.parseJd(text), text)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa tách được JD.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card bg-panel px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 basis-72 text-sm text-ink-2">
          <b className="font-semibold text-ink">Dán toàn văn để tự điền.</b> Hệ thống tách các mục và kỹ năng như ở phía sinh viên; bạn kiểm tra lại từng trường.
        </p>
        {!open && (
          <Button variant="outline" className="h-9 rounded-full border-transparent bg-card px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-strong)]" onClick={() => onOpenChange(true)}>
            Dán JD
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3.5 grid gap-2.5">
          {error && <FormAlert>{error}</FormAlert>}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            aria-label="Toàn văn JD"
            placeholder="Dán toàn văn tin tuyển dụng…"
            className={cn(areaClass, "h-[200px] resize-y")}
          />
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <span className={cn("text-[13px] tabular-nums", count >= JD_MIN_WORDS ? "text-good" : "text-ink-3")}>
              {count} / {JD_MIN_WORDS} từ tối thiểu
            </span>
            <span className="flex gap-2">
              <Button variant="soft" className="h-9 rounded-full px-4" onClick={() => onOpenChange(false)} disabled={busy}>
                Huỷ
              </Button>
              <Button className="h-9 rounded-full px-4" onClick={parse} disabled={busy || count < JD_MIN_WORDS}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                {busy ? "Đang tách…" : "Tự điền"}
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillsEditor({ skills, onChange, showError }: { skills: JdSkill[]; onChange: (s: JdSkill[]) => void; showError: boolean }) {
  const [name, setName] = useState("")
  const update = (i: number, patch: Partial<JdSkill>) => onChange(skills.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const add = () => {
    const value = name.trim()
    if (!value || skills.some((s) => s.name.toLowerCase() === value.toLowerCase())) return setName("")
    onChange([...skills, { name: value, importance: "required", aliases: [] }])
    setName("")
  }
  return (
    <div className="grid gap-3">
      {skills.length > 0 && (
        <ul className="@container">
          {skills.map((s, i) => (
            <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line py-2.5 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto_32px]">
              <span className="text-sm font-medium text-ink">{s.name}</span>
              <Input
                value={(s.aliases ?? []).join(", ")}
                onChange={(e) => update(i, { aliases: e.target.value.split(",").map((a) => a.trim()).filter(Boolean) })}
                aria-label={`Tên gọi khác của ${s.name}`}
                placeholder="Tên gọi khác, cách nhau bởi dấu phẩy"
                className="col-span-2 h-9 rounded-[10px] border-line-strong bg-card text-[13px] @2xl:col-span-1"
              />
              <div role="radiogroup" aria-label={`Mức quan trọng của ${s.name}`} className="col-start-2 row-start-1 flex rounded-full bg-surface p-0.5 text-xs @2xl:col-auto @2xl:row-auto">
                {IMPORTANCE.map((imp) => (
                  <button
                    key={imp.value}
                    type="button"
                    role="radio"
                    aria-checked={s.importance === imp.value}
                    onClick={() => update(i, { importance: imp.value })}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-medium transition-colors",
                      s.importance === imp.value ? "bg-card text-ink shadow-xs" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {imp.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onChange(skills.filter((_, j) => j !== i))}
                aria-label={`Bỏ ${s.name}`}
                className="hidden size-8 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink @2xl:grid"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          aria-label="Thêm kỹ năng"
          placeholder="Thêm kỹ năng"
          className="h-10 flex-1 rounded-xl border-line-strong bg-card px-3.5 text-sm"
        />
        <Button variant="outline" className="h-10 rounded-xl border-transparent bg-card px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line-strong)]" onClick={add}>
          <Plus className="size-4" aria-hidden />
          Thêm
        </Button>
      </div>
      {showError && <p className="text-[13px] text-bad">Hãy thêm ít nhất một kỹ năng bắt buộc.</p>}
    </div>
  )
}
