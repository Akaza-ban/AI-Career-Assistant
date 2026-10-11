"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AlertCircle, ChevronDown, ClipboardPaste, Heart, Library, Plus } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { MatchBadge } from "@/components/common/match-badge"
import { useRecommendations, useSavedJds, levelText, metaLine } from "@/components/student/library/library-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { countWords } from "@/lib/text"
import {
  JD_MIN_WORDS,
  type JobDescription,
  type JobLevel,
  type MatchLabel,
  type RequirementImportance,
} from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập sinh", fresher: "Fresher", junior: "Junior" }

/** Nhãn và màu cho mức độ yêu cầu; trọng số theo PRD mục 5.2. */
export const IMPORTANCE_META: Record<RequirementImportance, { label: string; weight: number; chip: string }> = {
  required: { label: "Bắt buộc", weight: 3, chip: "bg-blue-soft text-blue" },
  preferred: { label: "Ưu tiên", weight: 2, chip: "bg-violet-soft text-violet" },
  additional: { label: "Bổ trợ", weight: 1, chip: "bg-surface text-ink-2 ring-1 ring-line" },
}

/** Hai nguồn chọn vị trí, dùng chung cho chế độ 1 vị trí và khung "Thêm vị trí" (WIREFRAMES A4, A5). */
export type JdSource = "list" | "paste"

export const SOURCE_OPTIONS: { value: JdSource; label: string }[] = [
  { value: "list", label: "Gợi ý & đã lưu" },
  { value: "paste", label: "Dán JD" },
]

// ---------- Danh sách gợi ý & đã lưu ----------

export interface PickItem {
  id: string
  title: string
  company: string | null
  level: string | null
  /** Nhãn mức phù hợp khi vị trí nằm trong gợi ý theo CV (chỉ hiện nhãn, DESIGN.md 8.1). */
  label: MatchLabel | null
  saved: boolean
  pasted: boolean
}

export interface PickItemsState {
  items: PickItem[] | undefined
  /** Mọi vị trí SV chọn được (thư viện và JD tự dán), để tra theo id. */
  jds: JobDescription[] | undefined
  /** Lỗi tải gợi ý; vị trí đã lưu vẫn hiện. */
  recError: Error | undefined
  retryRecs: () => void
  error: Error | undefined
  retry: () => void
}

/**
 * Gợi ý theo CV (giữ thứ tự gợi ý) rồi vị trí đã lưu; vị trí truyền qua `extraIds` (ví dụ ?jd=) được thêm lên đầu
 * nếu chưa có trong danh sách.
 */
export function usePickItems(cvId: string | null, extraIds: string[]): PickItemsState {
  const jds = useApi(api.listMyJds)
  const recs = useRecommendations(cvId, false)
  const saved = useSavedJds()

  const items = useMemo(() => {
    if (!jds.data || saved.loading || (recs.loading && !recs.error)) return undefined
    const byId = new Map(jds.data.map((jd) => [jd.id, jd]))
    const labels = new Map((recs.data?.recommendations ?? []).map((r) => [r.jd_id, r.match_label]))
    const toItem = (jd: JobDescription): PickItem => ({
      id: jd.id,
      title: jd.title,
      company: jd.company,
      level: jd.level,
      label: labels.get(jd.id) ?? null,
      saved: saved.savedIds.has(jd.id),
      pasted: jd.source === "pasted",
    })
    const order = [
      ...extraIds,
      ...(recs.data?.recommendations ?? []).map((r) => r.jd_id),
      ...[...saved.savedIds],
    ]
    const seen = new Set<string>()
    const list: PickItem[] = []
    for (const id of order) {
      const jd = byId.get(id)
      if (!jd || seen.has(id)) continue
      seen.add(id)
      list.push(toItem(jd))
    }
    return list
  }, [jds.data, recs.data, recs.loading, recs.error, saved.loading, saved.savedIds, extraIds])

  return {
    items,
    jds: jds.data,
    recError: recs.error,
    retryRecs: recs.reload,
    error: jds.error,
    retry: jds.reload,
  }
}

function ItemText({ item }: { item: PickItem }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-ink">{item.title}</span>
      <span className="block truncate text-sm text-ink-3">
        {metaLine(item.company, levelText(item.level)) || (item.pasted ? "Không ghi công ty" : "")}
      </span>
    </span>
  )
}

/** Nhãn bên phải một dòng: mức phù hợp (gợi ý), trái tim (đã lưu) hoặc "JD tự dán". */
export function ItemTags({ item }: { item: PickItem }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5">
      {item.label && <MatchBadge label={item.label} />}
      {item.pasted && !item.label && <Badge variant="neutral">JD tự dán</Badge>}
      {item.saved && (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-blue">
          <Heart className="size-4 fill-current" strokeWidth={1.75} aria-hidden />
          <span className={cn(item.label && "sr-only sm:not-sr-only")}>Đã lưu</span>
        </span>
      )}
    </span>
  )
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Đang tải danh sách vị trí">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 border-b border-line py-4 last:border-0">
          <Skeleton className="size-[18px] rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-1/2 max-w-64 rounded" />
            <Skeleton className="h-3.5 w-1/3 max-w-40 rounded" />
          </div>
          <Skeleton className="h-[22px] w-14 rounded-badge" />
        </div>
      ))}
    </div>
  )
}

function RecError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-sm text-ink-2">
      <AlertCircle className="size-4 shrink-0 text-bad" aria-hidden />
      Không tải được vị trí gợi ý.
      <button type="button" onClick={onRetry} className="font-semibold text-blue hover:text-accent-strong">
        Thử lại
      </button>
    </p>
  )
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-line py-6 text-sm text-ink-2">
      <AlertCircle className="size-4 shrink-0 text-bad" aria-hidden />
      Không tải được danh sách vị trí.
      <Button variant="soft" className="h-9 rounded-full px-4" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  )
}

function NoItems({ onPaste }: { onPaste: () => void }) {
  return (
    <EmptyState
      icon={Library}
      title="Chưa có vị trí gợi ý hay đã lưu"
      description="Mở Thư viện JD để tìm vị trí, hoặc dán JD bạn đang nhắm tới."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="soft" className="h-10 rounded-full px-4" nativeButton={false} render={<Link href="/student/library" />}>
            <Library aria-hidden />
            Mở Thư viện JD
          </Button>
          <Button variant="soft" className="h-10 rounded-full px-4" onClick={onPaste}>
            <ClipboardPaste aria-hidden />
            Dán JD
          </Button>
        </div>
      }
    />
  )
}

function LibraryLink() {
  return (
    <Link href="/student/library" className="mt-3.5 inline-block text-sm font-semibold text-blue hover:text-accent-strong">
      Tìm thêm trong Thư viện JD
    </Link>
  )
}

interface ListProps {
  state: PickItemsState
  onPaste: () => void
}

/** Chọn một vị trí (radio). Dòng đang chọn có nền panel và viền mực mảnh (bản vẽ PhanTich1). */
export function JdRadioList({
  state,
  value,
  onChange,
  onPaste,
}: ListProps & { value: string | null; onChange: (item: PickItem) => void }) {
  const { items, error, retry, recError, retryRecs } = state
  if (error) return <LoadError onRetry={retry} />
  if (!items) return <ListSkeleton />
  return (
    <div>
      {recError && <RecError onRetry={retryRecs} />}
      {items.length === 0 ? (
        <NoItems onPaste={onPaste} />
      ) : (
        <div role="radiogroup" aria-label="Vị trí gợi ý và đã lưu">
          {items.map((item, i) => {
            const checked = item.id === value
            return (
              <div key={item.id}>
                {i > 0 && <div className="h-px bg-line" aria-hidden />}
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onChange(item)}
                  className={cn(
                    "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3.5 rounded-xl px-2 py-3.5 text-left transition-[background-color,box-shadow] duration-150 hover:bg-panel sm:-mx-3.5 sm:w-[calc(100%+1.75rem)] sm:px-3.5",
                    checked && "bg-panel shadow-[inset_0_0_0_1.5px_var(--ink)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] bg-card",
                      checked ? "border-ink" : "border-line-strong",
                    )}
                  >
                    {checked && <span className="size-2 rounded-full bg-ink" />}
                  </span>
                  <ItemText item={item} />
                  <ItemTags item={item} />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <LibraryLink />
    </div>
  )
}

/** Danh sách trong khung "Thêm vị trí": mỗi dòng có nút "+ Chọn"; ẩn các vị trí đã nằm trong danh sách so sánh. */
export function JdAddList({ state, exclude, onPick, onPaste }: ListProps & { exclude: Set<string>; onPick: (item: PickItem) => void }) {
  const { items, error, retry, recError, retryRecs } = state
  if (error) return <LoadError onRetry={retry} />
  if (!items) return <ListSkeleton rows={3} />
  const rest = items.filter((item) => !exclude.has(item.id))
  return (
    <div>
      {recError && <RecError onRetry={retryRecs} />}
      {items.length === 0 ? (
        <NoItems onPaste={onPaste} />
      ) : rest.length === 0 ? (
        <p className="py-4 text-sm text-ink-2">Bạn đã thêm mọi vị trí gợi ý và đã lưu. Tìm thêm trong Thư viện JD hoặc dán JD.</p>
      ) : (
        <ul>
          {rest.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-line py-3.5 last:border-0 sm:gap-4">
              <ItemText item={item} />
              <span className="hidden sm:flex">
                <ItemTags item={item} />
              </span>
              <Button
                variant="outline"
                className="h-9 shrink-0 rounded-full border-line-strong bg-card px-3.5 text-[13px] font-semibold"
                onClick={() => onPick(item)}
                aria-label={`Chọn ${item.title}`}
              >
                <Plus aria-hidden />
                Chọn
              </Button>
            </li>
          ))}
        </ul>
      )}
      <LibraryLink />
    </div>
  )
}

// ---------- Form dán JD ----------

export interface PastedJd {
  title: string
  company: string
  level: JobLevel | null
  industry: string | null
  description: string
  requirements: string
  benefits: string
  /** "Lưu JD này vào mục Đã lưu để dùng lại". */
  save: boolean
}

export const EMPTY_PASTE: PastedJd = {
  title: "",
  company: "",
  level: null,
  industry: null,
  description: "",
  requirements: "",
  benefits: "",
  save: true,
}

const LEVEL_OPTIONS: { value: JobLevel; label: string }[] = [
  { value: "intern", label: "Thực tập" },
  { value: "fresher", label: "Fresher" },
  { value: "junior", label: "Junior" },
]

export const pasteWords = (v: PastedJd) => countWords(v.description) + countWords(v.requirements)

/** Lỗi của từng ô; rỗng nghĩa là đủ để gửi. */
export function pasteErrors(v: PastedJd): Partial<Record<"title" | "description" | "requirements" | "length", string>> {
  const errors: ReturnType<typeof pasteErrors> = {}
  if (!v.title.trim()) errors.title = "Hãy nhập tên vị trí."
  if (!v.description.trim()) errors.description = "Hãy dán phần mô tả công việc."
  if (!v.requirements.trim()) errors.requirements = "Hãy dán phần yêu cầu ứng viên."
  if (v.description.trim() && v.requirements.trim() && pasteWords(v) < JD_MIN_WORDS) {
    errors.length = `JD còn ngắn (${pasteWords(v)} từ). Hãy bổ sung tối thiểu ${JD_MIN_WORDS} từ ở phần mô tả và yêu cầu.`
  }
  return errors
}

/** Câu ngắn nói còn thiếu gì, đặt cạnh nút chính khi nút đang tắt. */
export function pasteMissingHint(v: PastedJd): string {
  const e = pasteErrors(v)
  const missing = [e.title && "tên vị trí", e.description && "mô tả công việc", e.requirements && "yêu cầu ứng viên"].filter(
    Boolean,
  )
  if (missing.length) return `Còn thiếu ${missing.join(", ")}.`
  return e.length ? `JD cần tối thiểu ${JD_MIN_WORDS} từ.` : ""
}

/** Ghép các mục thành toàn văn JD với tiêu đề từng mục, để backend tách kỹ năng như JD dán một khối. */
export function composeJdText(v: PastedJd): string {
  const meta = [
    v.level && `Cấp bậc: ${LEVEL_OPTIONS.find((o) => o.value === v.level)?.label}`,
    v.industry && `Ngành: ${v.industry}`,
  ].filter(Boolean)
  return [
    meta.join("\n"),
    `Mô tả công việc:\n${v.description.trim()}`,
    `Yêu cầu ứng viên:\n${v.requirements.trim()}`,
    v.benefits.trim() && `Quyền lợi:\n${v.benefits.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

const fieldClass =
  "h-[42px] rounded-[10px] border-line-strong bg-card px-3.5 text-[15px] text-ink placeholder:text-ink-3 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-surface"
const areaClass =
  "min-h-[110px] rounded-[10px] border-line-strong bg-card px-3.5 py-2.5 text-[15px] leading-[1.55] text-ink placeholder:text-ink-3 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-surface"

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p id={id} className="mt-1.5 text-[13px] text-bad">
      {children}
    </p>
  )
}

interface JdPasteFormProps {
  value: PastedJd
  onChange: (value: PastedJd) => void
  /** Hiện lỗi dưới mọi ô (sau khi SV bấm nút chính); nếu không, lỗi hiện sau khi rời từng ô. */
  showErrors: boolean
  /** Ngành có trong thư viện, làm lựa chọn cho ô Ngành. */
  industries: string[]
  /** Tiền tố id để dùng hai form trên cùng trang. */
  idPrefix: string
}

/** Form "Dán JD" chia mục (WIREFRAMES A4): Tổng quan, Mô tả*, Yêu cầu*, Quyền lợi gập lại, ô lưu JD. */
export function JdPasteForm({ value, onChange, showErrors, industries, idPrefix }: JdPasteFormProps) {
  const [benefitsOpen, setBenefitsOpen] = useState(value.benefits.trim() !== "")
  // Lỗi của một ô chỉ hiện sau khi SV rời ô đó, hoặc khi bấm nút chính (showErrors).
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const all = pasteErrors(value)
  const shown = (key: string) => showErrors || touched.has(key)
  const errors = {
    title: shown("title") ? all.title : undefined,
    description: shown("description") ? all.description : undefined,
    requirements: shown("requirements") ? all.requirements : undefined,
    length: shown("requirements") ? all.length : undefined,
  }
  const touch = (key: string) => () => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  const words = pasteWords(value)
  const id = (name: string) => `${idPrefix}-${name}`
  const set = <K extends keyof PastedJd>(key: K, v: PastedJd[K]) => onChange({ ...value, [key]: v })
  const industryItems = industries.map((name) => ({ value: name, label: name }))

  return (
    <div className="grid gap-[18px]">
      <div className="grid gap-x-6 gap-y-[18px] sm:grid-cols-2">
        <div>
          <Label htmlFor={id("title")} className="mb-1.5 text-sm font-medium text-ink">
            Vị trí <span className="text-bad">*</span>
          </Label>
          <Input
            id={id("title")}
            value={value.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={touch("title")}
            placeholder="Ví dụ: Business Analyst Intern"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? id("title-err") : undefined}
            className={fieldClass}
          />
          <FieldError id={id("title-err")}>{errors.title}</FieldError>
        </div>
        <div>
          <Label htmlFor={id("company")} className="mb-1.5 text-sm font-medium text-ink">
            Công ty
          </Label>
          <Input
            id={id("company")}
            value={value.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Ví dụ: FPT Software"
            className={fieldClass}
          />
        </div>
        <div>
          <Label id={id("level-label")} className="mb-1.5 text-sm font-medium text-ink">
            Cấp bậc
          </Label>
          <Select items={LEVEL_OPTIONS} value={value.level} onValueChange={(v) => set("level", (v as JobLevel) ?? null)}>
            <SelectTrigger aria-labelledby={id("level-label")} className={cn(fieldClass, "w-full min-w-0 data-[size=default]:h-[42px] data-placeholder:text-ink-3")}>
              <SelectValue className="min-w-0 truncate" placeholder="Chọn cấp bậc" />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label id={id("industry-label")} className="mb-1.5 text-sm font-medium text-ink">
            Ngành
          </Label>
          <Select items={industryItems} value={value.industry} onValueChange={(v) => set("industry", v ? String(v) : null)}>
            <SelectTrigger aria-labelledby={id("industry-label")} className={cn(fieldClass, "w-full min-w-0 data-[size=default]:h-[42px] data-placeholder:text-ink-3")}>
              <SelectValue className="min-w-0 truncate" placeholder="Chọn ngành" />
            </SelectTrigger>
            <SelectContent>
              {industryItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-1">
        <Label htmlFor={id("desc")} className="mb-1.5 text-sm font-medium text-ink">
          Mô tả công việc <span className="text-bad">*</span>
        </Label>
        <Textarea
          id={id("desc")}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          onBlur={touch("description")}
          placeholder="Dán phần mô tả công việc"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? id("desc-err") : undefined}
          className={areaClass}
        />
        <FieldError id={id("desc-err")}>{errors.description}</FieldError>
      </div>

      <div>
        <Label htmlFor={id("req")} className="mb-1.5 text-sm font-medium text-ink">
          Yêu cầu ứng viên <span className="text-bad">*</span>
        </Label>
        <Textarea
          id={id("req")}
          value={value.requirements}
          onChange={(e) => set("requirements", e.target.value)}
          onBlur={touch("requirements")}
          placeholder="Dán phần yêu cầu"
          aria-invalid={errors.requirements || errors.length ? true : undefined}
          aria-describedby={id("req-help")}
          className={areaClass}
        />
        <FieldError id={id("req-err")}>{errors.requirements ?? errors.length}</FieldError>
        <p id={id("req-help")} className="mt-1.5 text-[13px] text-ink-3">
          <span className={cn("tabular-nums", words >= JD_MIN_WORDS && "text-good")}>{words}</span> / tối thiểu{" "}
          {JD_MIN_WORDS} từ ở phần mô tả và yêu cầu
        </p>
      </div>

      <div className="border-y border-line">
        <button
          type="button"
          onClick={() => setBenefitsOpen((o) => !o)}
          aria-expanded={benefitsOpen}
          aria-controls={id("benefits-panel")}
          className="-mx-2.5 flex w-[calc(100%+1.25rem)] items-center gap-3.5 rounded-lg px-2.5 py-4 text-left transition-colors hover:bg-panel"
        >
          <span className="flex-1 font-medium text-ink">
            Quyền lợi và thông tin khác <span className="font-normal text-ink-3">(không bắt buộc)</span>
          </span>
          <ChevronDown className={cn("size-4 text-ink-3 transition-transform", benefitsOpen && "rotate-180")} aria-hidden />
        </button>
        {benefitsOpen && (
          <div id={id("benefits-panel")} className="pb-4">
            <Textarea
              aria-label="Quyền lợi và thông tin khác"
              value={value.benefits}
              onChange={(e) => set("benefits", e.target.value)}
              placeholder="Dán phần quyền lợi, địa điểm, thời gian làm việc"
              className={areaClass}
            />
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-2">
        <Checkbox
          checked={value.save}
          onCheckedChange={(checked) => set("save", checked === true)}
          className="size-[17px] border-line-strong data-checked:border-ink data-checked:bg-ink data-checked:text-white"
        />
        Lưu JD này vào mục Đã lưu để dùng lại
      </label>
    </div>
  )
}
