"use client"

import { useState, type FormEvent } from "react"
import { Copy, Loader2, RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

import { generateTempPassword } from "@/components/admin/admin-bits"
import { FormAlert, TextField, authInput, isEmail, type FieldHint } from "@/components/auth/auth-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, ApiError } from "@/lib/api"
import { copyText } from "@/lib/clipboard"
import { isStrongPassword } from "@/lib/password"
import type { AdminAdvisor } from "@/lib/types"
import { cn } from "@/lib/utils"

export type AdvisorDialogMode = { kind: "create" } | { kind: "edit"; advisor: AdminAdvisor } | { kind: "reset"; advisor: AdminAdvisor }

const TEXT = {
  create: {
    title: "Thêm cố vấn",
    description: "Tạo tài khoản và gửi mật khẩu tạm cho cố vấn.",
    submit: "Tạo tài khoản",
  },
  edit: { title: "Sửa thông tin cố vấn", description: "Email mới sẽ dùng để đăng nhập từ lần sau.", submit: "Lưu thay đổi" },
  reset: {
    title: "Đặt lại mật khẩu tạm",
    description: "Cố vấn bị đăng xuất khỏi mọi thiết bị và phải đổi mật khẩu này ở lần đăng nhập tới.",
    submit: "Đặt mật khẩu tạm",
  },
}

/** Bản vẽ ThemCoVan: tạo tài khoản cố vấn bằng mật khẩu tạm; cùng khung cho Sửa thông tin và Đặt lại mật khẩu tạm. */
export function AdvisorDialog({
  mode,
  onOpenChange,
  onSaved,
}: {
  mode: AdvisorDialogMode | null
  onOpenChange: (open: boolean) => void
  onSaved: (advisor: AdminAdvisor) => void
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-panel p-6 shadow-dialog ring-line sm:max-w-[520px] sm:p-[26px]">
        {/* key: mở lại thì form về giá trị ban đầu của cố vấn đang chọn */}
        {mode && (
          <AdvisorForm
            key={mode.kind === "create" ? "create" : `${mode.kind}:${mode.advisor.id}`}
            mode={mode}
            onDone={(advisor) => {
              onSaved(advisor)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AdvisorForm({ mode, onDone }: { mode: AdvisorDialogMode; onDone: (advisor: AdminAdvisor) => void }) {
  const current = mode.kind === "create" ? null : mode.advisor
  const [fullName, setFullName] = useState(current?.full_name ?? "")
  const [email, setEmail] = useState(current?.email ?? "")
  const [title, setTitle] = useState(current?.title ?? "")
  const [password, setPassword] = useState(() => (mode.kind === "edit" ? "" : generateTempPassword()))
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailTaken, setEmailTaken] = useState<string | null>(null)
  const text = TEXT[mode.kind]
  const showProfile = mode.kind !== "reset"
  const showPassword = mode.kind !== "edit"

  const fieldError = (show: boolean, message: string): FieldHint => (submitted && show ? { tone: "error", text: message } : null)
  const nameHint = fieldError(fullName.trim().length < 2, "Hãy nhập họ và tên.")
  const emailHint: FieldHint =
    emailTaken && emailTaken === email.trim().toLowerCase()
      ? { tone: "error", text: "Email này đã có tài khoản." }
      : fieldError(!isEmail(email), email.trim() ? "Email chưa đúng định dạng." : "Hãy nhập email.")
  const titleHint: FieldHint = fieldError(!title.trim(), "Hãy nhập chức danh.") ?? {
    tone: "muted",
    text: "Sinh viên thấy dòng này ở trang Chia sẻ với cố vấn.",
  }
  const passwordHint: FieldHint = fieldError(!isStrongPassword(password), "Mật khẩu tạm cần ít nhất 8 ký tự, có cả chữ và số.") ?? {
    tone: "muted",
    text: "Cố vấn phải đổi mật khẩu này ở lần đăng nhập đầu tiên.",
  }

  async function copy() {
    if (await copyText(password)) toast.success("Đã chép mật khẩu tạm.")
    else toast.error("Không chép được, hãy chọn và chép thủ công.")
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const invalidProfile = showProfile && (fullName.trim().length < 2 || !isEmail(email) || !title.trim())
    if (invalidProfile || (showPassword && !isStrongPassword(password))) return
    setBusy(true)
    setError(null)
    try {
      if (mode.kind === "create") {
        const advisor = await api.createAdvisor({ full_name: fullName, email, title, temporary_password: password })
        toast.success(`Đã tạo tài khoản cho ${advisor.full_name}.`, {
          description: "Gửi email đăng nhập và mật khẩu tạm cho cố vấn.",
        })
        onDone(advisor)
      } else if (mode.kind === "edit") {
        const changes = {
          ...(fullName.trim() !== mode.advisor.full_name && { full_name: fullName }),
          ...(email.trim().toLowerCase() !== mode.advisor.email && { email }),
          ...(title.trim() !== mode.advisor.title && { title }),
        }
        const advisor = Object.keys(changes).length ? await api.updateAdvisor(mode.advisor.id, changes) : mode.advisor
        toast.success("Đã lưu thông tin cố vấn.")
        onDone(advisor)
      } else {
        const advisor = await api.resetAdvisorPassword(mode.advisor.id, password)
        toast.success(`Đã đặt mật khẩu tạm mới cho ${advisor.full_name}.`)
        onDone(advisor)
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_taken") setEmailTaken(email.trim().toLowerCase())
      else setError(err instanceof Error ? err.message : "Chưa lưu được. Hãy thử lại.")
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-[18px]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">{text.title}</DialogTitle>
          <DialogDescription className="mt-1 text-[15px] leading-6 text-ink-2">
            {mode.kind === "create" ? text.description : <>{current?.full_name} · {text.description}</>}
          </DialogDescription>
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 rounded-full text-ink-3 hover:text-ink" />}
          aria-label="Đóng"
        >
          <X className="size-[18px]" strokeWidth={1.75} />
        </DialogClose>
      </div>

      {error && <FormAlert>{error}</FormAlert>}

      {showProfile && (
        <>
          <TextField label="Họ và tên" value={fullName} onChange={setFullName} hint={nameHint} autoComplete="off" />
          <TextField
            label="Email đăng nhập"
            type="email"
            value={email}
            onChange={setEmail}
            hint={emailHint}
            autoComplete="off"
            inputMode="email"
          />
          <TextField label="Chức danh" value={title} onChange={setTitle} hint={titleHint} autoComplete="off" />
        </>
      )}

      {showPassword && <TempPasswordField value={password} onChange={setPassword} hint={passwordHint} onCopy={copy} />}

      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
        <DialogClose render={<Button type="button" variant="soft" size="brand" disabled={busy} />}>Huỷ</DialogClose>
        <Button type="submit" size="brand" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {text.submit}
        </Button>
      </div>
    </form>
  )
}

function TempPasswordField({
  value,
  onChange,
  hint,
  onCopy,
}: {
  value: string
  onChange: (value: string) => void
  hint: FieldHint
  onCopy: () => void
}) {
  const id = "temp-password"
  const pill =
    "h-[46px] shrink-0 gap-1.5 rounded-xl border-transparent bg-card px-3.5 text-sm font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel"
  return (
    <div className="grid gap-[7px]">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        Mật khẩu tạm
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ""))}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={hint?.tone === "error" ? true : undefined}
          aria-describedby={`${id}-hint`}
          className={cn(authInput, "min-w-0 flex-1 font-mono tabular-nums")}
        />
        <Button type="button" variant="outline" className={pill} onClick={() => onChange(generateTempPassword())}>
          <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="max-sm:sr-only">Tạo lại</span>
        </Button>
        <Button type="button" variant="outline" className={pill} onClick={onCopy}>
          <Copy className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="max-sm:sr-only">Chép</span>
        </Button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className={cn("text-[13px] leading-5", hint.tone === "error" ? "text-bad" : "text-ink-3")}>
          {hint.text}
        </p>
      )}
    </div>
  )
}
