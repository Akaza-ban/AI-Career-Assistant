"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState, type FormEvent } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

import { AuthCard, AuthHeading } from "@/components/auth/auth-shell"
import {
  CheckField,
  DobField,
  dobToIso,
  FormAlert,
  PasswordField,
  TextField,
  isEmail,
  normalizePhone,
  type FieldHint,
} from "@/components/auth/auth-fields"
import { PolicySections, PolicySummary } from "@/components/auth/data-policy-dialog"
import { PasswordRuleList } from "@/components/common/password-rules"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { DATA_POLICY_UPDATED_AT } from "@/lib/data-policy"
import { setAuthMode } from "@/lib/session"
import { isStrongPassword } from "@/lib/password"
import { cn } from "@/lib/utils"


/** Tuổi tối thiểu 15; ngày sinh không ở tương lai. */
function dobError(v: string): string | null {
  if (!v) return "Hãy chọn đủ ngày, tháng và năm sinh."
  const iso = dobToIso(v)
  if (!iso) return "Ngày sinh chưa đúng."
  const d = new Date(`${iso}T00:00:00`)
  const now = new Date()
  if (d > now) return "Ngày sinh không thể ở tương lai."
  const fifteen = new Date(now.getFullYear() - 15, now.getMonth(), now.getDate())
  if (d > fifteen) return "Bạn cần từ 15 tuổi trở lên để tạo tài khoản."
  if (d.getFullYear() < 1940) return "Ngày sinh chưa đúng."
  return null
}

export function RegisterForm() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: "", dob: "", phone: "", email: "", password: "", confirm: "" })
  const [consent, setConsent] = useState(false)
  const [pledge, setPledge] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailTaken, setEmailTaken] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const policyTitleId = useId()

  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }))
    if (key === "email") setEmailTaken(false)
    setFormError(null)
  }

  const errors = {
    fullName: form.fullName.trim().length < 2 ? "Hãy nhập họ và tên." : null,
    dob: dobError(form.dob),
    phone: !form.phone.trim() ? "Hãy nhập số điện thoại." : !normalizePhone(form.phone) ? "Cần đủ 10 chữ số, bắt đầu bằng 0." : null,
    email: !form.email.trim() ? "Hãy nhập email." : !isEmail(form.email) ? "Email chưa đúng định dạng." : null,
    password: !isStrongPassword(form.password) ? "Mật khẩu chưa đạt các điều kiện bên dưới." : null,
    confirm: !form.confirm ? "Hãy nhập lại mật khẩu." : form.confirm !== form.password ? "Hai mật khẩu chưa khớp." : null,
  }
  const valid = Object.values(errors).every((e) => !e)
  const show = (key: keyof typeof errors): FieldHint => (submitted && errors[key] ? { tone: "error", text: errors[key] } : null)

  const confirmHint: FieldHint =
    form.confirm && form.confirm === form.password
      ? { tone: "ok", text: "Đã khớp" }
      : form.confirm.length >= form.password.length && form.confirm && form.confirm !== form.password
        ? { tone: "error", text: "Hai mật khẩu chưa khớp." }
        : show("confirm")
  const emailHint: FieldHint = emailTaken
    ? {
        tone: "error",
        text: (
          <>
            Email này đã có tài khoản.{" "}
            <Link href="/login" className="font-semibold text-bad underline">
              Đăng nhập
            </Link>
          </>
        ),
      }
    : show("email")

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!valid || !consent || !pledge) return
    setBusy(true)
    try {
      await api.register({
        full_name: form.fullName.trim(),
        date_of_birth: dobToIso(form.dob)!,
        phone: normalizePhone(form.phone)!,
        email: form.email.trim(),
        password: form.password,
        consent: true,
        integrity_pledge: true,
      })
      setAuthMode({ role: "student" })
      router.push("/student")
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") setEmailTaken(true)
      else setFormError(err instanceof ApiError ? err.message : "Chưa tạo được tài khoản. Hãy thử lại.")
      setBusy(false)
    }
  }

  return (
    <AuthCard className="max-w-[1040px] gap-0 overflow-hidden sm:p-0">
      <form onSubmit={submit} noValidate className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Trái: thông tin đăng ký */}
        <div className="grid content-start gap-5 sm:p-9">
          <AuthHeading title="Tạo tài khoản" description="Miễn phí cho sinh viên, dùng được ngay sau khi tạo." />
          {formError && <FormAlert>{formError}</FormAlert>}
          <TextField label="Họ và tên" autoComplete="name" value={form.fullName} onChange={set("fullName")} hint={show("fullName")} disabled={busy} autoFocus />
          <DobField label="Ngày sinh" value={form.dob} onChange={set("dob")} hint={show("dob")} disabled={busy} />
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-3.5">
            <TextField
              label="Số điện thoại"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={set("phone")}
              hint={show("phone")}
              disabled={busy}
              className="tabular-nums"
            />
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} hint={emailHint} disabled={busy} />
          </div>
          <div className="grid gap-2.5">
            <PasswordField label="Mật khẩu" autoComplete="new-password" value={form.password} onChange={set("password")} hint={show("password")} disabled={busy} />
            <PasswordRuleList password={form.password} showErrors={submitted} />
          </div>
          <PasswordField label="Xác nhận mật khẩu" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} hint={confirmHint} disabled={busy} />
          <p className="text-sm text-ink-2 max-lg:hidden">
            Đã có tài khoản?{" "}
            <Link href="/login" className="font-semibold">
              Đăng nhập
            </Link>
          </p>
        </div>

        {/* Phải: chính sách dữ liệu và đồng ý. Chiều cao theo cột trái; phần chính sách cuộn bên trong. */}
        <div className="mt-8 flex flex-col gap-4 rounded-[20px] bg-panel p-4 sm:mt-0 sm:rounded-none sm:p-9 lg:border-l lg:border-line">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-ink">
              <ShieldCheck className="size-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <h2 id={policyTitleId} className="text-lg leading-6 font-semibold text-ink">
                Chính sách dữ liệu
              </h2>
              <p className="text-[13px] text-ink-3">Cập nhật {DATA_POLICY_UPDATED_AT} · Đọc trước khi đồng ý</p>
            </div>
          </div>
          <PolicySummary columns={1} className="bg-card" />
          <div
            role="region"
            aria-labelledby={policyTitleId}
            tabIndex={0}
            className="max-h-[300px] overflow-y-auto rounded-card bg-card px-5 shadow-[0_0_0_1px_var(--line)] [scrollbar-width:thin] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:max-h-none lg:min-h-[200px] lg:flex-1 lg:basis-0"
          >
            <PolicySections compact />
          </div>
          <div className="grid gap-3">
            <CheckField checked={consent} onChange={setConsent} invalid={submitted && !consent}>
              Tôi đồng ý để CareerV xử lý CV và câu trả lời phỏng vấn của tôi để đưa ra gợi ý.
            </CheckField>
            <CheckField checked={pledge} onChange={setPledge} invalid={submitted && !pledge}>
              Tôi cam kết chỉ đưa vào CV những kinh nghiệm có thật.
            </CheckField>
          </div>
          <Button
            type="submit"
            variant="dark"
            size="brand"
            className={cn("h-12 w-full", !busy && "disabled:bg-[color-mix(in_oklch,var(--surface),var(--ink)_6%)] disabled:text-ink-3 disabled:opacity-100")}
            disabled={busy || !consent || !pledge}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
          </Button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2 sm:mt-0 sm:pb-7 lg:hidden">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  )
}
