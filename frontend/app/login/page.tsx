'use client';

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { LogIn } from "lucide-react"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api.getMe().then((user) => {
      if (active) router.replace(user.role === "advisor" ? "/advisor" : "/student")
    }).catch(() => { /* A missing session leaves the credential form available. */ })
    return () => { active = false }
  }, [router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const user = await api.login(email.trim(), password)
      setPassword("")
      // Clear all per-account client state when signing in.
      window.location.replace(user.role === "advisor" ? "/advisor" : "/student")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập.")
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <form onSubmit={submit} className="grid w-full max-w-md gap-5 rounded-2xl border border-line bg-card p-8 shadow-card">
        <div className="grid gap-2">
          <h1 className="font-heading text-2xl font-bold">Đăng nhập CareerX</h1>
          <p className="text-sm text-ink-2">Dùng tài khoản cá nhân để truy cập hồ sơ và tài liệu của bạn.</p>
        </div>
        <label className="grid gap-2 text-sm font-medium" htmlFor="email">
          Email
          <input id="email" type="email" autoComplete="username" required maxLength={255} value={email}
            onChange={(event) => setEmail(event.target.value)} disabled={busy}
            className="rounded-lg border border-line bg-surface px-3 py-2 outline-blue" />
        </label>
        <label className="grid gap-2 text-sm font-medium" htmlFor="password">
          Mật khẩu
          <input id="password" type="password" autoComplete="current-password" required maxLength={1024} value={password}
            onChange={(event) => setPassword(event.target.value)} disabled={busy}
            className="rounded-lg border border-line bg-surface px-3 py-2 outline-blue" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={busy}><LogIn className="size-4" aria-hidden />{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
      </form>
    </main>
  )
}
