"use client"

import { useId, useState, type ComponentProps, type ReactNode } from "react"
import { Check, CircleAlert, Eye, EyeOff } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Ô nhập cao 46px của trang tài khoản; viền chuyển màu mực khi focus. */
export const authInput =
  "h-[46px] rounded-xl border-line-strong bg-card px-3.5 text-[15px] md:text-[15px] placeholder:text-ink-3/70 focus-visible:border-ink focus-visible:ring-ink/10"

export type FieldHint = { tone: "ok" | "error" | "muted"; text: ReactNode } | null

function HintLine({ id, hint }: { id: string; hint: FieldHint }) {
  if (!hint) return null
  return (
    <p
      id={id}
      className={cn(
        "flex items-start gap-1.5 text-[13px] leading-5",
        hint.tone === "ok" ? "text-good" : hint.tone === "error" ? "text-bad" : "text-ink-3",
      )}
    >
      {hint.tone === "ok" && <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}
      {hint.tone === "error" && <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden />}
      <span>{hint.text}</span>
    </p>
  )
}

interface TextFieldProps extends Omit<ComponentProps<"input">, "onChange" | "value"> {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: FieldHint
  /** Phần tử bên phải nhãn, ví dụ link "Quên mật khẩu?". */
  aside?: ReactNode
}

export function TextField({ label, value, onChange, hint = null, aside, className, ...props }: TextFieldProps) {
  const id = useId()
  return (
    <div className="grid min-w-0 content-start gap-[7px]">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {aside}
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hint?.tone === "error" ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(authInput, className)}
        {...props}
      />
      <HintLine id={`${id}-hint`} hint={hint} />
    </div>
  )
}

export function PasswordField({ label, value, onChange, hint = null, aside, className, ...props }: TextFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="grid min-w-0 content-start gap-[7px]">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hint?.tone === "error" ? true : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(authInput, "pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface hover:text-ink"
        >
          {visible ? <EyeOff className="size-[18px]" strokeWidth={1.75} aria-hidden /> : <Eye className="size-[18px]" strokeWidth={1.75} aria-hidden />}
        </button>
      </div>
      <HintLine id={`${id}-hint`} hint={hint} />
    </div>
  )
}

const DOB_MIN_YEAR = 1940
const pad2 = (n: number) => String(n).padStart(2, "0")
const daysIn = (month: number, year: number) => new Date(year, month, 0).getDate()

interface DobFieldProps {
  label: string
  /** "dd/mm/yyyy" khi đã chọn đủ ngày, tháng, năm; "" khi còn thiếu. */
  value: string
  onChange: (value: string) => void
  hint?: FieldHint
  disabled?: boolean
  /** Năm sinh muộn nhất trong danh sách = năm nay − minAge. */
  minAge?: number
}

/**
 * Ngày sinh chọn bằng 3 ô Ngày / Tháng / Năm, không phải gõ theo định dạng. Lịch bấm chọn bất tiện với ngày sinh
 * (phải lùi hàng chục năm) nên dùng danh sách. Giá trị trả ra vẫn là "dd/mm/yyyy" như dobToIso cần.
 */
export function DobField({ label, value, onChange, hint = null, disabled, minAge = 15 }: DobFieldProps) {
  const id = useId()
  const initial = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  const [parts, setParts] = useState(() => ({
    day: initial ? Number(initial[1]) : null,
    month: initial ? Number(initial[2]) : null,
    year: initial ? Number(initial[3]) : null,
  }))

  const lastYear = new Date().getFullYear() - minAge
  const years = Array.from({ length: lastYear - DOB_MIN_YEAR + 1 }, (_, i) => lastYear - i)
  const dayCount = parts.month ? daysIn(parts.month, parts.year ?? 2000) : 31

  function update(next: Partial<typeof parts>) {
    const merged = { ...parts, ...next }
    // Đổi sang tháng ngắn hơn (31 → tháng 2): lùi về ngày cuối tháng thay vì để ngày không có thật
    if (merged.day && merged.month) merged.day = Math.min(merged.day, daysIn(merged.month, merged.year ?? 2000))
    setParts(merged)
    const { day, month, year } = merged
    onChange(day && month && year ? `${pad2(day)}/${pad2(month)}/${year}` : "")
  }

  const invalid = hint?.tone === "error"
  const trigger =
    "h-[46px] data-[size=default]:h-[46px] w-full min-w-0 rounded-xl border-line-strong bg-card px-3.5 text-[15px] text-ink tabular-nums data-placeholder:text-ink-3/80 focus-visible:border-ink focus-visible:ring-ink/10"
  const part = (
    name: string,
    current: number | null,
    options: { value: number; label: string }[],
    onPick: (v: number) => void,
  ) => (
    <Select
      items={options.map((o) => ({ value: String(o.value), label: o.label }))}
      value={current === null ? null : String(current)}
      onValueChange={(v) => v && onPick(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={`${label}: ${name.toLowerCase()}`}
        aria-invalid={invalid && current === null ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={trigger}
      >
        <SelectValue placeholder={name} className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="grid min-w-0 content-start gap-[7px]">
      <span id={`${id}-label`} className="text-sm font-semibold text-ink">
        {label}
      </span>
      <div role="group" aria-labelledby={`${id}-label`} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
        {part(
          "Ngày",
          parts.day,
          Array.from({ length: dayCount }, (_, i) => ({ value: i + 1, label: pad2(i + 1) })),
          (day) => update({ day }),
        )}
        {part(
          "Tháng",
          parts.month,
          Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
          (month) => update({ month }),
        )}
        {part(
          "Năm",
          parts.year,
          years.map((y) => ({ value: y, label: String(y) })),
          (year) => update({ year }),
        )}
      </div>
      <HintLine id={`${id}-hint`} hint={hint} />
    </div>
  )
}

export function CheckField({
  checked,
  onChange,
  invalid,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-[21px] text-ink-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-invalid={invalid || undefined}
        className="mt-px size-5 rounded-md border-[1.5px] border-line-strong bg-card data-checked:border-ink data-checked:bg-ink data-checked:text-on-ink"
      />
      <span>{children}</span>
    </label>
  )
}

/** Hộp báo lỗi chung của form (sai mật khẩu, mất kết nối…). */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl bg-bad-soft px-3.5 py-3 text-sm leading-[21px] text-bad">
      <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>{children}</span>
    </div>
  )
}

// ---------- Kiểm tra dữ liệu (backend kiểm tra lại cùng quy tắc) ----------

/** Gõ ngày sinh dạng dd/mm/yyyy: chỉ giữ chữ số và tự chèn dấu gạch chéo. */
export function formatDob(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/")
}

/** "14/05/2003" → "2003-05-14"; null nếu chưa đủ hoặc không phải ngày có thật. */
export function dobToIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) return null
  return `${yyyy}-${mm}-${dd}`
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/** Số điện thoại Việt Nam: 10 chữ số bắt đầu bằng 0, chấp nhận "+84" và dấu cách / chấm / gạch. */
export function normalizePhone(v: string): string | null {
  const digits = v.replace(/[\s.-]/g, "").replace(/^\+84/, "0")
  return /^0\d{9}$/.test(digits) ? digits : null
}
