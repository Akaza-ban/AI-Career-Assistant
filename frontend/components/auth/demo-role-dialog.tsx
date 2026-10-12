"use client"

import { ChevronRight, UserRound, UsersRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/session"

const ICONS = { student: UserRound, advisor: UsersRound }

/**
 * Chọn tài khoản demo trên trang Đăng nhập: chỉ điền sẵn email và mật khẩu vào form,
 * người dùng tự bấm Đăng nhập (Enter). Tài khoản demo đăng nhập / đăng xuất như tài khoản thường.
 */
export function DemoRoleDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (email: string, password: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-panel p-6 shadow-dialog ring-line sm:max-w-[520px] sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">Dùng thử bản demo</DialogTitle>
            <DialogDescription className="mt-1.5 text-[15px] leading-6 text-ink-2">
              Chọn một tài khoản demo, email và mật khẩu sẽ được điền sẵn để bạn đăng nhập.
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 rounded-full text-ink-3 hover:text-ink" />}
            aria-label="Đóng"
          >
            <X className="size-[18px]" strokeWidth={1.75} />
          </DialogClose>
        </div>
        <div className="grid gap-2.5">
          {DEMO_ACCOUNTS.map(({ role, title, text, email }) => {
            const Icon = ICONS[role]
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  onPick(email, DEMO_PASSWORD)
                  onOpenChange(false)
                }}
                className="flex items-center gap-4 rounded-card p-[18px] text-left text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-panel"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="block text-sm text-ink-2">{text}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-ink-3">{email}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-ink-3" aria-hidden />
              </button>
            )
          })}
        </div>
        <p className="text-[13px] text-ink-3">Mật khẩu chung của tài khoản demo: {DEMO_PASSWORD}</p>
      </DialogContent>
    </Dialog>
  )
}
