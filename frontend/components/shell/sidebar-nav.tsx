"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { advisorShell, isNavActive, studentShell } from "@/components/shell/nav-config"
import { useProfile } from "@/components/shell/profile-context"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SidebarNavProps {
  role: Role
  /** Gọi khi bấm một mục (để đóng menu mobile). */
  onNavigate?: () => void
}

/** Nội dung sidebar, dùng chung cho sidebar cố định (desktop) và Sheet (mobile). */
export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const config = role === "advisor" ? advisorShell : studentShell

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center px-4">
        <Logo href={config.nav[0].href} />
      </div>

      <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pt-4">
        {config.nav.map((item) => {
          const active = isNavActive(item, pathname)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue text-on-blue shadow-[0_6px_14px_-6px_var(--blue)]"
                  : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 p-3">
        <UserCard settingsHref={config.settingsHref} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function UserCard({ settingsHref, onNavigate }: { settingsHref: string | null; onNavigate?: () => void }) {
  const profile = useProfile()

  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-surface p-2">
      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar name={profile?.full_name} src={profile?.avatar_url} />
        {profile ? (
          <div className="grid min-w-0">
            <span className="truncate text-sm font-semibold text-ink">{profile.full_name}</span>
            <span className="truncate text-xs text-ink-2">{profile.subtitle}</span>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        )}
      </div>
      {settingsHref && (
        <Link
          href={settingsHref}
          onClick={onNavigate}
          aria-label="Cài đặt & Quyền riêng tư"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-card hover:text-ink"
        >
          <Settings className="size-[18px]" aria-hidden />
        </Link>
      )}
    </div>
  )
}
