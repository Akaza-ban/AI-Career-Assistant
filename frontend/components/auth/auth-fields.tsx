"use client"

import { useId, useState, type ComponentProps, type ReactNode } from "react"
import { Check, CircleAlert, Eye, EyeOff } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
