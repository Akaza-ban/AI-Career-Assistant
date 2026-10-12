"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { LogOut, Menu } from "lucide-react"

import { useSignOut } from "@/components/shell/account-actions"
import { isNavActive, shellOf } from "@/components/shell/nav-config"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

const sheetItem = "flex items-center gap-3 rounded-[10px] px-3 py-3 text-[15px] font-medium text-ink-2 hover:bg-surface"
const tabClass = "flex h-[52px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors"

/**
 * Thanh tab dưới đáy cho màn hình dưới 1024px (DESIGN.md 5.4). Các mục có `tab` trong nav-config nằm trên thanh,
 * các mục còn lại nằm trong sheet "Tôi".
 */
export function MobileTabBar({ role }: { role: Role }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const signOut = useSignOut()
  const config = shellOf(role)
  const tabs = config.nav.filter((item) => item.tab)
  const rest = config.nav.filter((item) => !item.tab)
  const meActive = rest.some((item) => isNavActive(item, pathname))

  return (
    <nav
      aria-label="Điều hướng"
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-card/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-md lg:hidden"
      style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
    >
      {tabs.map((item) => {
        const active = isNavActive(item, pathname)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(tabClass, active ? "font-semibold text-ink" : "font-medium text-ink-3")}
          >
            <span className={cn("mb-0.5 h-0.5 w-6 rounded-b", active ? "bg-ink" : "bg-transparent")} aria-hidden />
            <Icon className="size-[21px]" strokeWidth={1.75} aria-hidden />
            {item.tab}
          </Link>
        )
      })}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button type="button" className={cn(tabClass, meActive ? "font-semibold text-ink" : "font-medium text-ink-3")} />
          }
        >
          <span className={cn("mb-0.5 h-0.5 w-6 rounded-b", meActive ? "bg-ink" : "bg-transparent")} aria-hidden />
          <Menu className="size-[21px]" strokeWidth={1.75} aria-hidden />
          Tôi
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-[22px] px-3 pt-3 pb-6">
          <SheetTitle className="px-3 pb-2 font-heading text-lg font-bold">Tài khoản và mục khác</SheetTitle>
          <div className="grid gap-0.5">
            {rest.map((item) => {
              const active = isNavActive(item, pathname)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] px-3 py-3 text-[15px]",
                    active ? "bg-ink font-semibold text-white" : "font-medium text-ink-2 hover:bg-surface",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
              className={cn(sheetItem, "w-full text-left")}
            >
              <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
              Đăng xuất
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
