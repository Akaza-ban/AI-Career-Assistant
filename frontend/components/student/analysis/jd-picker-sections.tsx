"use client"

import { useState } from "react"
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  CircleCheck,
  ClipboardPaste,
  FileText,
  Info,
  Library,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Panel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatBytes } from "@/lib/format"
import { countWords } from "@/lib/text"
import {
  JD_MIN_WORDS,
  type CvVersion,
  type JobDescription,
  type JobLevel,
  type RequirementImportance,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập sinh", fresher: "Fresher", junior: "Junior" }

/** Nhãn và màu cho mức độ yêu cầu; trọng số theo PRD mục 5.2. */
export const IMPORTANCE_META: Record<RequirementImportance, { label: string; weight: number; chip: string }> = {
  required: { label: "Bắt buộc", weight: 3, chip: "bg-blue-soft text-blue" },
  preferred: { label: "Ưu tiên", weight: 2, chip: "bg-violet-soft text-violet" },
  additional: { label: "Bổ trợ", weight: 1, chip: "bg-surface text-ink-2 ring-1 ring-line" },
}

// ---------- Cột trái ----------

interface SelectedCvCardProps {
  selected: CvVersion
  /** Quay lại bước 1 để chọn CV khác. */
  onChangeCv: () => void
}

export function SelectedCvCard({ selected, onChangeCv }: SelectedCvCardProps) {
  return (
    <Panel className="grid min-w-0 gap-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-bold tracking-wide uppercase">
        <FileText className="size-4 text-blue" aria-hidden />
        CV đã chọn
      </h2>
      <div className="grid gap-1 rounded-xl bg-surface p-3">
        <p className="truncate font-semibold text-ink" title={selected.file_name}>
          {selected.file_name}
        </p>
        <p className="text-xs text-ink-2">
          {selected.label} · {selected.file_type.toUpperCase()} · {formatBytes(selected.size_bytes)}
        </p>
      </div>
      <Button variant="secondary" className="h-9 bg-blue-soft text-blue" onClick={onChangeCv}>
        <ArrowLeftRight aria-hidden />
        Đổi tệp CV khác
      </Button>
    </Panel>
  )
}

export function IntegrityBox() {
  return (
    <section className="grid gap-2 rounded-[20px] bg-blue-soft/60 p-5">
      <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
        <ShieldCheck className="size-4 text-blue" aria-hidden />
        Nguyên tắc đối soát minh bạch
      </h2>
      <p className="text-sm leading-6 text-ink-2">
        AI chỉ diễn đạt lại kinh nghiệm bạn đã có, không thêm thành tích. Mỗi đánh giá đều trích nguyên văn câu trong CV
        làm bằng chứng.
      </p>
    </section>
  )
}

// ---------- Tab thư viện JD ----------

interface JdLibraryPickerProps {
  items: JobDescription[] | undefined
  selected: JobDescription | null
  onSelect: (jd: JobDescription) => void
}

/** Chọn JD bằng dropdown; chọn xong hiển thị ngay thông tin JD để SV biết vị trí đó yêu cầu gì. */
export function JdLibraryPicker({ items, selected, onSelect }: JdLibraryPickerProps) {
  const options = (items ?? []).map((jd) => ({
    value: jd.id,
    label: `${jd.title}${jd.company ? ` – ${jd.company}` : ""}`,
  }))

  return (
    <Panel className="grid min-w-0 gap-5">
      <div className="grid gap-1">
        <h2 className="font-heading text-lg font-bold">Chọn vị trí từ thư viện JD</h2>
        <p className="text-sm text-ink-2">Bộ JD chuẩn hoá cho sinh viên mới ra trường, đã gắn mức độ cho từng yêu cầu.</p>
      </div>

      {!items ? (
        <Skeleton className="h-10 rounded-lg" />
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="jd-library-select" className="text-xs font-semibold">
            Vị trí ứng tuyển <span className="text-bad">*</span>
          </Label>
          <Select
            items={options}
            value={selected?.id ?? null}
            onValueChange={(value) => {
              const jd = items.find((j) => j.id === value)
              if (jd) onSelect(jd)
            }}
          >
            <SelectTrigger id="jd-library-select" className="h-11 w-full min-w-0 bg-surface" aria-label="Vị trí ứng tuyển">
              <SelectValue className="min-w-0 truncate" placeholder={`Chọn một trong ${items.length} vị trí…`} />
            </SelectTrigger>
            <SelectContent>
              {items.map((jd) => (
                <SelectItem key={jd.id} value={jd.id}>
                  <span className="grid">
                    <span className="font-medium">{jd.title}</span>
                    <span className="text-xs text-ink-2">
                      {[jd.company, jd.level && LEVEL_LABEL[jd.level]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selected ? (
        <JdDetails jd={selected} />
      ) : (
        items && (
          <p className="flex items-center gap-2 rounded-xl bg-surface p-4 text-sm text-ink-2">
            <Library className="size-4 shrink-0 text-ink-3" aria-hidden />
            Chọn một vị trí để xem mô tả công việc và các kỹ năng yêu cầu.
          </p>
        )
      )}
    </Panel>
  )
}

function JdDetails({ jd }: { jd: JobDescription }) {
  const [expanded, setExpanded] = useState(false)
  const groups = (Object.keys(IMPORTANCE_META) as RequirementImportance[])
    .map((importance) => ({ importance, skills: jd.skills.filter((s) => s.importance === importance) }))
    .filter((g) => g.skills.length > 0)

  return (
    <section className="grid gap-4 rounded-2xl border border-line p-4" aria-label={`Thông tin JD ${jd.title}`}>
      <div className="grid gap-1">
        <h3 className="font-heading text-base font-bold text-ink">{jd.title}</h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          {jd.company && (
            <span className="flex items-center gap-1">
              <Building2 className="size-3.5" aria-hidden />
              {jd.company}
            </span>
          )}
          {jd.industry && <span>· {jd.industry}</span>}
          {jd.level && <span className="font-medium text-blue">· {LEVEL_LABEL[jd.level]}</span>}
        </p>
      </div>

      <div className="grid gap-2.5">
        {groups.map(({ importance, skills }) => {
          const meta = IMPORTANCE_META[importance]
          return (
            <div key={importance} className="grid gap-1.5 sm:grid-cols-[120px_1fr] sm:items-start">
              <p className="pt-1 text-xs font-semibold text-ink">
                {meta.label} <span className="font-normal text-ink-3">(×{meta.weight})</span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <li key={s.name} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", meta.chip)}>
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="grid gap-2 border-t border-line pt-3">
        <p className={cn("text-sm leading-6 whitespace-pre-line text-ink-2", !expanded && "line-clamp-6")}>{jd.content}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-blue hover:underline"
        >
          {expanded ? "Thu gọn" : "Xem toàn bộ JD"}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>
    </section>
  )
}

// ---------- Tab dán JD ----------

export interface PastedJd {
  title: string
  company: string
  text: string
}

interface JdPasteFormProps {
  value: PastedJd
  onChange: (value: PastedJd) => void
  /** Hiện lỗi sau khi SV đã bắt đầu nhập. */
  showErrors: boolean
}

export function JdPasteForm({ value, onChange, showErrors }: JdPasteFormProps) {
  const words = countWords(value.text)
  const enough = words >= JD_MIN_WORDS
  const titleError = showErrors && !value.title.trim()
  const textError = showErrors && value.text.trim() !== "" && !enough

  return (
    <Panel className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="font-heading text-lg font-bold">Dán bản mô tả công việc (JD) của bạn</h2>
        <p className="text-sm text-ink-2">
          Cung cấp tiêu đề và nội dung yêu cầu công việc để AI bóc tách chính xác bộ kỹ năng.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="jd-title" className="text-xs font-semibold">
            Tiêu đề vị trí tuyển dụng <span className="text-bad">*</span>
          </Label>
          <Input
            id="jd-title"
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Ví dụ: Business Analyst Intern"
            aria-invalid={titleError || undefined}
            className="h-10 bg-surface"
          />
          {titleError && <p className="text-xs text-bad">Hãy nhập tiêu đề vị trí.</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="jd-company" className="text-xs font-semibold">
            Tên công ty / Doanh nghiệp <span className="font-normal text-ink-3">(Tuỳ chọn)</span>
          </Label>
          <Input
            id="jd-company"
            value={value.company}
            onChange={(e) => onChange({ ...value, company: e.target.value })}
            placeholder="Ví dụ: Công ty Công nghệ A"
            className="h-10 bg-surface"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="jd-text" className="text-xs font-semibold">
            Nội dung mô tả & yêu cầu chi tiết <span className="text-bad">*</span>
          </Label>
          {enough && (
            <span className="flex items-center gap-1 text-xs font-medium text-good">
              <CircleCheck className="size-3.5" aria-hidden />
              Đủ độ dài
            </span>
          )}
        </div>
        <Textarea
          id="jd-text"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={"VỊ TRÍ: ...\nMô tả công việc:\n- ...\nYêu cầu ứng viên:\n- ..."}
          aria-invalid={textError || undefined}
          aria-describedby="jd-text-help"
          className="min-h-64 bg-surface text-sm leading-6"
        />
        <div id="jd-text-help" className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={cn(
              "rounded-md px-2 py-1 font-medium",
              enough ? "bg-good-soft text-good" : textError ? "bg-bad-soft text-bad" : "bg-blue-soft text-blue",
            )}
          >
            {words} từ {enough ? "(đạt yêu cầu)" : `/ tối thiểu ${JD_MIN_WORDS} từ`}
          </span>
          <span className="text-ink-2">JD càng chi tiết, kết quả đối chiếu càng chính xác.</span>
        </div>
        {textError && (
          <p className="text-xs text-bad" role="alert">
            Nội dung JD quá ngắn. Hãy bổ sung JD đầy đủ hơn (tối thiểu {JD_MIN_WORDS} từ) trước khi phân tích.
          </p>
        )}
      </div>

      <p className="flex gap-2 rounded-xl bg-blue-soft/60 p-3 text-xs leading-5 text-ink">
        <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
        <span>
          <strong className="font-semibold text-blue">Mẹo:</strong> Hãy dán đầy đủ phần &quot;Yêu cầu ứng viên&quot; và
          &quot;Ưu tiên&quot; để AI xác định đúng kỹ năng bắt buộc và kỹ năng ưu tiên.
        </span>
      </p>
    </Panel>
  )
}

export const JD_TABS = [
  { value: "recommended", label: "AI gợi ý theo CV", icon: Sparkles },
  { value: "library", label: "Chọn từ thư viện JD", icon: Library },
  { value: "compare", label: "So sánh 2–5 JD", icon: ArrowLeftRight },
  { value: "paste", label: "Dán JD của bạn", icon: ClipboardPaste },
] as const

export type JdTab = (typeof JD_TABS)[number]["value"]

export { JdRecommendationPicker } from "./jd-recommendation-picker"
export { JdComparisonPicker } from "./jd-comparison-picker"
