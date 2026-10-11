"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Mail, TriangleAlert } from "lucide-react"

import { AuthCard, AuthHeading } from "@/components/auth/auth-shell"
import { FormAlert, PasswordField, TextField, isEmail, type FieldHint } from "@/components/auth/auth-fields"
import { homeOf } from "@/components/auth/login-form"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { isStrongPassword } from "@/lib/password"

const RESEND_SECONDS = 60
const BACK_LINK = (
  <Link href="/login" className="justify-self-center text-sm font-semibold text-ink-2 hover:text-ink">
    Quay lại đăng nhập
  </Link>
)

function IconBadge({ children }: { children: React.ReactNode }) {
  return <span className="grid size-[52px] place-items-center rounded-full bg-surface text-ink">{children}</span>
}

/** Bước 1–2: nhập email → "Kiểm tra email của bạn" kèm đếm ngược trước khi được gửi lại. */
export function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  async function send(address: string) {
    setBusy(true)
    setError(null)
    try {
      await api.requestPasswordReset({ email: address })
      setSentTo(address)
      setLeft(RESEND_SECONDS)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa gửi được link. Hãy thử lại.")
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (isEmail(email)) void send(email.trim())
  }

  if (sentTo) {
    return (
      <AuthCard className="max-w-[420px] justify-items-start">
        <IconBadge>
          <Mail className="size-[22px]" strokeWidth={1.75} aria-hidden />
        </IconBadge>
        <AuthHeading
          title="Kiểm tra email của bạn"
          description={
            <>
              Nếu <b className="font-semibold text-ink">{sentTo}</b> đã có tài khoản, link đặt lại mật khẩu đã được gửi tới. Link dùng được trong 30 phút.
            </>
          }
        />
        {error && <FormAlert>{error}</FormAlert>}
        <Button variant="soft" size="brand" className="h-12 w-full" disabled={left > 0 || busy} onClick={() => send(sentTo)}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {left > 0 ? (
            <>
              Gửi lại sau <span className="tabular-nums">{`0:${String(left).padStart(2, "0")}`}</span>
            </>
          ) : (
            "Gửi lại link"
          )}
        </Button>
        {BACK_LINK}
      </AuthCard>
    )
  }

  const hint: FieldHint = submitted && !isEmail(email) ? { tone: "error", text: email.trim() ? "Email chưa đúng định dạng." : "Hãy nhập email." } : null
  return (
    <AuthCard className="max-w-[420px]">
      <AuthHeading title="Quên mật khẩu" description="Nhập email tài khoản, chúng tôi sẽ gửi link đặt lại mật khẩu." />
      <form onSubmit={submit} noValidate className="grid gap-5">
        {error && <FormAlert>{error}</FormAlert>}
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={setEmail} hint={hint} disabled={busy} autoFocus />
        <Button type="submit" variant="dark" size="brand" className="h-12 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Đang gửi…" : "Gửi link đặt lại"}
        </Button>
      </form>
      {BACK_LINK}
    </AuthCard>
  )
}

/** Bước 3: mở link trong email (`/reset-password?token=…`) để đặt mật khẩu mới. */
export function ResetPassword({ token }: { token: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; expired: boolean } | null>(null)

  if (!token || error?.expired) {
    return (
      <AuthCard className="max-w-[420px] justify-items-start">
        <IconBadge>
          <TriangleAlert className="size-[22px]" strokeWidth={1.75} aria-hidden />
        </IconBadge>
        <AuthHeading title="Link đã hết hạn" description="Link đặt lại mật khẩu không hợp lệ hoặc đã quá 30 phút. Hãy yêu cầu link mới." />
        <Button variant="dark" size="brand" className="h-12 w-full" nativeButton={false} render={<Link href="/forgot-password" />}>
          Gửi link mới
        </Button>
        {BACK_LINK}
      </AuthCard>
    )
  }

  const strong = isStrongPassword(password)
  const passwordHint: FieldHint =
    submitted && !strong
      ? { tone: "error", text: "Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số, không có khoảng trắng." }
      : { tone: strong ? "ok" : "muted", text: "Ít nhất 8 ký tự, có cả chữ và số, không có khoảng trắng" }
  const confirmHint: FieldHint =
    confirm && confirm === password
      ? { tone: "ok", text: "Đã khớp" }
      : (confirm && confirm.length >= password.length) || (submitted && confirm !== password)
        ? { tone: "error", text: confirm ? "Hai mật khẩu chưa khớp." : "Hãy nhập lại mật khẩu." }
        : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!strong || confirm !== password) return
    setBusy(true)
    setError(null)
    try {
      const { role } = await api.confirmPasswordReset({ token: token!, new_password: password })
      router.push(homeOf(role))
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      setError({ message: apiErr?.message ?? "Chưa lưu được mật khẩu. Hãy thử lại.", expired: apiErr?.code === "invalid_token" })
      setBusy(false)
    }
  }

  return (
    <AuthCard className="max-w-[420px]">
      <AuthHeading title="Đặt mật khẩu mới" description="Chọn mật khẩu mới cho tài khoản CareerX của bạn." />
      <form onSubmit={submit} noValidate className="grid gap-5">
        {error && <FormAlert>{error.message}</FormAlert>}
        <PasswordField label="Mật khẩu mới" autoComplete="new-password" value={password} onChange={setPassword} hint={passwordHint} disabled={busy} autoFocus />
        <PasswordField label="Nhập lại mật khẩu" autoComplete="new-password" value={confirm} onChange={setConfirm} hint={confirmHint} disabled={busy} />
        <Button type="submit" variant="dark" size="brand" className="h-12 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Đang lưu…" : "Lưu và đăng nhập"}
        </Button>
      </form>
    </AuthCard>
  )
}
