"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Logo } from "@/components/brand/logo"
import { advisorShell, isNavActive, studentShell } from "@/components/shell/nav-config"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Sidebar desktop 252px (DESIGN.md 5.2): logo, các mục chia nhóm, mục đang chọn nền đen. */
export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const config = role === "advisor" ? advisorShell : studentShell

  return (
    <div className="flex h-full flex-col px-3.5 pt-5 pb-4">
      <Logo href={config.nav[0].href} className="px-2 pb-5" />

      <nav aria-label="Điều hướng chính" className="flex flex-col gap-0.5">
        {config.nav.map((item, index) => {
          const active = isNavActive(item, pathname)
          const Icon = item.icon
          const startsGroup = item.group && item.group !== config.nav[index - 1]?.group
          return (
            <div key={item.href} className="contents">
              {startsGroup && <div className="px-3 pt-4 pb-1.5 text-xs font-medium text-ink-3">{item.group}</div>}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors",
                  active ? "bg-ink font-semibold text-white" : "font-medium text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
