"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { advisorShell, isNavActive, studentShell } from "@/components/shell/nav-config"
import { useProfile } from "@/components/shell/profile-context"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

// Chữ trong sidebar thu gọn: ẩn khi còn là rail, chỉ hiện khi sidebar đã gần mở hết (khớp với hover:delay-150 +
// duration-200 của <aside> trong AppShell) để không thấy chữ bị cắt dở; khi thu lại thì ẩn ngay.
const revealOnExpand =
  "opacity-0 transition-opacity duration-100 group-hover/sidebar:opacity-100 group-hover/sidebar:delay-[250ms] group-hover/sidebar:duration-150 group-has-[:focus-visible]/sidebar:opacity-100"

interface SidebarNavProps {
  role: Role
  /** Gọi khi bấm một mục (để đóng menu mobile). */
  onNavigate?: () => void
  /**
   * Sidebar desktop: nằm trong <aside className="group/sidebar"> rộng 72px, mở ra khi rê chuột.
   * Mọi thứ căn trái với khoảng cách cố định để logo, icon và avatar đứng yên ở giữa rail khi mở/thu.
   */
  collapsible?: boolean
}

/** Nội dung sidebar, dùng chung cho sidebar cố định (desktop) và Sheet (mobile). */
export function SidebarNav({ role, onNavigate, collapsible = false }: SidebarNavProps) {
  const pathname = usePathname()
  const config = role === "advisor" ? advisorShell : studentShell
  const reveal = collapsible ? revealOnExpand : undefined

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center px-4">
        <Logo href={config.nav[0].href} className="shrink-0" textClassName={reveal} />
      </div>

      <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-4">
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
                "flex items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-xl px-[15px] py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue text-on-blue shadow-[0_6px_14px_-6px_var(--blue)]"
                  : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className={reveal}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 p-3">
        <UserCard reveal={reveal} />
      </div>
    </div>
  )
}

/** Chỉ hiển thị; Cài đặt và các thao tác tài khoản nằm trong menu avatar trên topbar. */
function UserCard({ reveal }: { reveal: string | undefined }) {
  const profile = useProfile()

  return (
    <div className="flex items-center gap-2 overflow-hidden rounded-xl bg-surface p-2">
      <UserAvatar name={profile?.full_name} src={profile?.avatar_url} />
      {profile ? (
        <div className={cn("grid min-w-0", reveal)}>
          <span className="truncate text-sm font-semibold text-ink">{profile.full_name}</span>
          <span className="truncate text-xs text-ink-2">{profile.subtitle}</span>
        </div>
      ) : (
        <div className={cn("grid gap-1.5", reveal)}>
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      )}
    </div>
  )
}
