"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"

import { AuthCard, AuthHeading, OrDivider } from "@/components/auth/auth-shell"
import { FormAlert, PasswordField, TextField, isEmail, type FieldHint } from "@/components/auth/auth-fields"
import { DemoRoleDialog } from "@/components/auth/demo-role-dialog"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"

export const homeOf = (role: "student" | "advisor") => (role === "advisor" ? "/advisor" : "/student")

export function LoginForm({ demoOpen: initialDemoOpen = false }: { demoOpen?: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; wrongPassword: boolean } | null>(null)
  const [demoOpen, setDemoOpen] = useState(initialDemoOpen)

  const emailHint: FieldHint =
    submitted && !email.trim() ? { tone: "error", text: "Hãy nhập email." } : submitted && !isEmail(email) ? { tone: "error", text: "Email chưa đúng định dạng." } : null
  const passwordHint: FieldHint = submitted && !password ? { tone: "error", text: "Hãy nhập mật khẩu." } : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!isEmail(email) || !password) return
    setBusy(true)
    setError(null)
    try {
      const { role } = await api.login({ email: email.trim(), password })
      router.push(homeOf(role))
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null
      setError({
        message: apiErr?.message ?? "Chưa đăng nhập được. Hãy thử lại.",
        wrongPassword: apiErr?.code === "invalid_credentials",
      })
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <AuthHeading title="Đăng nhập" description="Chào mừng bạn quay lại CareerX." />
      <form onSubmit={submit} noValidate className="grid gap-5">
        {error && <FormAlert>{error.message}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(v) => {
            setEmail(v)
            setError(null)
          }}
          hint={emailHint}
          disabled={busy}
          autoFocus
        />
        <PasswordField
          label="Mật khẩu"
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setError(null)
          }}
          hint={passwordHint}
          aria-invalid={error?.wrongPassword || passwordHint ? true : undefined}
          disabled={busy}
          aside={
            <Link href="/forgot-password" className="text-sm font-semibold">
              Quên mật khẩu?
            </Link>
          }
        />
        <Button type="submit" variant="dark" size="brand" className="h-12 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
      <OrDivider />
      <Button variant="outline" size="brand" className="h-12 w-full border-line-strong bg-card text-ink hover:bg-panel" onClick={() => setDemoOpen(true)}>
        Dùng thử bản demo
      </Button>
      <p className="text-center text-sm text-ink-2">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold">
          Tạo tài khoản
        </Link>
      </p>
      <DemoRoleDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </AuthCard>
  )
}
