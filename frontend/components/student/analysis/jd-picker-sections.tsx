"use client"

import { useMemo, useState } from "react"
import {
  ArrowLeftRight,
  CircleCheck,
  ClipboardPaste,
  FileText,
  Info,
  Library,
  Search,
  ShieldCheck,
} from "lucide-react"

import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatBytes } from "@/lib/format"
import { countWords } from "@/lib/text"
import { JD_MIN_WORDS, type CvVersion, type JobDescription, type JobLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

export const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập sinh", fresher: "Fresher", junior: "Junior" }

// ---------- Cột trái ----------

interface SelectedCvCardProps {
  selected: CvVersion
  /** Quay lại bước 1 để chọn CV khác. */
  onChangeCv: () => void
}

export function SelectedCvCard({ selected, onChangeCv }: SelectedCvCardProps) {
  return (
    <Panel className="grid min-w-0 gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold tracking-wide uppercase">
          <FileText className="size-4 text-blue" aria-hidden />
          CV đã chọn
        </h2>
        {selected.ats_score !== null && selected.ats_score >= 80 && (
          <Badge variant="good" className="h-auto px-2.5 py-0.5">
            Đạt chuẩn ATS
          </Badge>
        )}
      </div>
      <div className="grid gap-1 rounded-xl bg-surface p-3">
        <p className="truncate font-semibold text-ink" title={selected.file_name}>
          {selected.file_name}
        </p>
        <p className="text-xs text-ink-2">
          {selected.label} · {selected.file_type.toUpperCase()} · {formatBytes(selected.size_bytes)}
          {selected.ats_score !== null && (
            <>
              {" "}
              · Điểm ATS: <span className="font-semibold text-good">{selected.ats_score}/100</span>
            </>
          )}
        </p>
      </div>
      {selected.target_title && (
        <p className="text-sm text-ink-2">
          Vị trí đang gắn: <span className="text-ink">{selected.target_title}</span>
        </p>
      )}
      <Button variant="secondary" className="h-9 bg-blue-soft text-blue" onClick={onChangeCv}>
        <ArrowLeftRight aria-hidden />
        Đổi tệp CV khác
      </Button>
    </Panel>
  )
}

export function BaseMatchCard({ score }: { score: number }) {
  return (
    <Panel className="flex items-center gap-4">
      <ScoreRing score={score} size={72} strokeWidth={7} labelClassName="text-lg" />
      <div className="grid gap-0.5">
        <p className="font-heading font-bold">Điểm ATS hiện tại</p>
        <p className="text-sm text-ink-2">Mức cơ sở trước khi đối chiếu sâu với JD bạn chọn.</p>
      </div>
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
        AI đối chiếu trực tiếp từng bằng chứng thực tế trong CV của bạn với JD được chọn để phát hiện khoảng trống năng
        lực thật, tuyệt đối không tự chế số liệu.
      </p>
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
  /** Hiện lỗi sau khi người dùng bấm "Bắt đầu phân tích". */
  showErrors: boolean
}

export function JdPasteForm({ value, onChange, showErrors }: JdPasteFormProps) {
  const words = countWords(value.text)
  const enough = words >= JD_MIN_WORDS
  const titleError = showErrors && !value.title.trim()
  const textError = showErrors && !enough

  return (
    <Panel className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="font-heading text-lg font-bold">Chi tiết bản mô tả công việc (JD)</h2>
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
          <strong className="font-semibold text-blue">Lưu ý phân tích:</strong> Nếu JD quá ngắn hoặc thiếu phần tiêu chí
          đánh giá, kết quả đối chiếu từ khoá ATS sẽ kém chính xác. Hãy dán đầy đủ phần &quot;Yêu cầu ứng viên&quot;.
        </span>
      </p>
    </Panel>
  )
}

// ---------- Tab thư viện JD ----------

type LevelFilter = "all" | JobLevel

interface JdLibraryProps {
  items: JobDescription[] | undefined
  selectedId: string | null
  onSelect: (jd: JobDescription) => void
}

export function JdLibrary({ items, selectedId, onSelect }: JdLibraryProps) {
  const [level, setLevel] = useState<LevelFilter>("all")
  const [query, setQuery] = useState("")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter(
      (jd) =>
        (level === "all" || jd.level === level) &&
        (!q || jd.title.toLowerCase().includes(q) || jd.skills.some((s) => s.toLowerCase().includes(q))),
    )
  }, [items, level, query])

  const levels: { value: LevelFilter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "intern", label: "Thực tập" },
    { value: "fresher", label: "Fresher" },
    { value: "junior", label: "Junior" },
  ]

  return (
    <Panel className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-heading text-lg font-bold">Thư viện JD chuẩn hoá theo ngành</h2>
          <p className="text-sm text-ink-2">Chọn nhanh một khung JD mẫu phổ biến cho sinh viên mới ra trường.</p>
        </div>
        <div role="group" aria-label="Lọc cấp độ" className="flex items-center gap-1">
          {levels.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={level === l.value}
              onClick={() => setLevel(l.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                level === l.value ? "bg-blue text-on-blue" : "bg-surface text-ink-2 hover:bg-blue-soft",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo chức danh, kỹ năng (SQL, Figma, Marketing)..."
          aria-label="Tìm JD trong thư viện"
          className="h-10 bg-surface pl-9"
        />
      </div>

      {!items ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl bg-surface py-8 text-center text-sm text-ink-2">Không có JD nào khớp bộ lọc.</p>
      ) : (
        <div role="radiogroup" aria-label="Thư viện JD" className="grid gap-3 sm:grid-cols-2">
          {visible.map((jd) => {
            const selected = jd.id === selectedId
            return (
              <button
                key={jd.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(jd)}
                className={cn(
                  "grid gap-2 rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-blue bg-blue-soft/50 ring-2 ring-blue/20" : "border-line bg-surface/60 hover:border-blue/40",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2",
                        selected ? "border-blue" : "border-ink-3",
                      )}
                    >
                      {selected && <span className="size-2 rounded-full bg-blue" />}
                    </span>
                    <span className="grid">
                      <span className="font-heading font-bold text-ink">{jd.title}</span>
                      <span className="text-xs text-ink-2">
                        {jd.industry} • <span className="text-blue">{LEVEL_LABEL[jd.level]}</span>
                      </span>
                    </span>
                  </span>
                  {selected && <Badge variant="good">Đã chọn</Badge>}
                </span>
                <span className="flex flex-wrap gap-1.5 pl-6.5">
                  {jd.skills.map((skill) => (
                    <span key={skill} className="rounded-md bg-card px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line">
                      {skill}
                    </span>
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

export const JD_TABS = [
  { value: "paste", label: "Dán JD trực tiếp", icon: ClipboardPaste },
  { value: "library", label: "Chọn từ thư viện JD", icon: Library },
] as const

export type JdTab = (typeof JD_TABS)[number]["value"]
