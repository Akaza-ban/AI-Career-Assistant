import Link from "next/link"
import type { ReactNode } from "react"

import { Logo } from "@/components/brand/logo"
import { ThemeToggleButton } from "@/components/shell/theme-switch"
import { cn } from "@/lib/utils"

/** Khung chung của các trang tài khoản: dải pastel, logo, một thẻ trắng ở giữa (DESIGN.md 7). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="aurora-band" aria-hidden />
      <header className="relative z-10 flex h-16 items-center justify-between px-4 sm:h-[76px] sm:px-10">
        <Logo />
        <span className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-ink-2 hover:text-ink max-sm:hidden">
            Về trang giới thiệu
          </Link>
          <ThemeToggleButton className="-mr-2" />
        </span>
      </header>
      <main className="relative z-10 grid justify-items-center px-4 pt-6 pb-16 sm:pt-12 sm:pb-20">{children}</main>
    </div>
  )
}

export function AuthCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid w-full max-w-[440px] gap-5 sm:rounded-panel sm:bg-card sm:p-9 sm:shadow-[var(--shadow-sm-token),0_0_0_1px_var(--line)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div>
      <h1 className="font-heading text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      {description && <p className="mt-1.5 text-[15px] text-ink-2">{description}</p>}
    </div>
  )
}

/** Đường kẻ có chữ ở giữa ("hoặc"). */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-ink-3 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
      hoặc
    </div>
  )
}
