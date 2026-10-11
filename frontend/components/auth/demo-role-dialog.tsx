"use client"

import Link from "next/link"
import { ChevronRight, UserRound, UsersRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

const ROLES = [
  { href: "/student", icon: UserRound, title: "Sinh viên", text: "Phân tích CV, tối ưu CV, luyện phỏng vấn" },
  { href: "/advisor", icon: UsersRound, title: "Cố vấn", text: "Theo dõi sinh viên, nhận xét buổi phỏng vấn" },
]

/** Bản demo với dữ liệu mẫu, mở từ trang Đăng nhập (và "Đổi vai trò" trong menu avatar). */
export function DemoRoleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-panel p-6 shadow-dialog ring-line sm:max-w-[520px] sm:p-7">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">Dùng thử bản demo</DialogTitle>
            <DialogDescription className="mt-1.5 text-[15px] leading-6 text-ink-2">
              Dữ liệu mẫu, không cần tài khoản. Bạn đổi được vai trò trong menu avatar.
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
          {ROLES.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-card p-[18px] text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors hover:bg-panel"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface">
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{title}</span>
                <span className="block text-sm text-ink-2">{text}</span>
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-ink-3" aria-hidden />
            </Link>
          ))}
        </div>
        <p className="text-[13px] text-ink-3">Thay đổi trong bản demo không được lưu lại.</p>
      </DialogContent>
    </Dialog>
  )
}
