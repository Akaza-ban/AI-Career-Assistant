"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { isNavActive, shellOf } from "@/components/shell/nav-config"
import { toggleSidebar } from "@/lib/sidebar"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Nhãn nền đậm hiện khi rê chuột / Tab tới (bản vẽ SidebarThuGon). `group/tip` đặt ở phần tử cha.
 * `side="bottom"` cho nút thu gọn khi sidebar đang mở rộng: sidebar cắt phần tràn ngang nên nhãn nằm bên dưới nút.
 */
function Tip({ children, collapsedOnly = false, side = "right" }: { children: ReactNode; collapsedOnly?: boolean; side?: "right" | "bottom" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-50 hidden items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-on-ink shadow-[0_8px_20px_-6px_rgb(0_0_0/0.3)]",
        "before:absolute before:border-[5px] before:border-transparent",
        side === "right"
          ? "top-1/2 left-[calc(100%+10px)] -translate-y-1/2 before:top-1/2 before:right-full before:-translate-y-1/2 before:border-r-ink"
          : "top-[calc(100%+8px)] right-0 before:right-2.5 before:bottom-full before:border-b-ink",
        collapsedOnly
          ? "sidebar-collapsed:group-hover/tip:flex sidebar-collapsed:group-focus-visible/tip:flex"
          : "group-hover/tip:flex group-focus-visible/tip:flex",
      )}
    >
      {children}
    </span>
  )
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-[5px] bg-on-ink/15 px-1.5 py-px font-sans text-[11px] font-semibold">{children}</kbd>
)

const toggleButton =
  "group/tip relative grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface hover:text-ink"

/** Ctrl B (Cmd B trên Mac) thu gọn / mở rộng, như các ứng dụng soạn thảo quen thuộc. */
function useSidebarShortcut() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      e.preventDefault()
      toggleSidebar()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}

/**
 * Sidebar desktop (DESIGN.md 5.2): logo, các mục chia nhóm, mục đang chọn nền đậm.
 * Thu gọn còn 72px: chỉ hình logo và biểu tượng, tên nhóm thành đường kẻ mảnh, rê chuột hiện nhãn tên mục.
 */
export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname()
  const config = shellOf(role)
  useSidebarShortcut()

  return (
    <div className="flex h-full flex-col px-3.5 pt-5 pb-4 sidebar-collapsed:px-0">
      <div className="flex items-center pb-5 pl-2 sidebar-collapsed:flex-col sidebar-collapsed:gap-3.5 sidebar-collapsed:pb-3 sidebar-collapsed:pl-0">
        <Logo href={config.nav[0].href} className="sidebar-collapsed:gap-0" textClassName="sidebar-collapsed:hidden" />
        <button type="button" onClick={toggleSidebar} aria-label="Thu gọn thanh bên" className={cn(toggleButton, "ml-auto -mr-1 sidebar-collapsed:hidden")}>
          <PanelLeftClose className="size-[18px]" strokeWidth={1.75} aria-hidden />
          <Tip side="bottom">
            Thu gọn <Kbd>Ctrl B</Kbd>
          </Tip>
        </button>
        <button type="button" onClick={toggleSidebar} aria-label="Mở rộng thanh bên" className={cn(toggleButton, "hidden sidebar-collapsed:grid")}>
          <PanelLeftOpen className="size-[18px]" strokeWidth={1.75} aria-hidden />
          <Tip>
            Mở rộng <Kbd>Ctrl B</Kbd>
          </Tip>
        </button>
      </div>

      <nav aria-label="Điều hướng chính" className="flex flex-col gap-0.5">
        {config.nav.map((item, index) => {
          const active = isNavActive(item, pathname)
          const Icon = item.icon
          const startsGroup = item.group && item.group !== config.nav[index - 1]?.group
          return (
            <div key={item.href} className="contents">
              {startsGroup && (
                <>
                  <div className="px-3 pt-4 pb-1.5 text-xs font-medium text-ink-3 sidebar-collapsed:hidden">{item.group}</div>
                  <span aria-hidden className="mx-auto mt-3.5 mb-2 hidden h-px w-5 bg-line-strong sidebar-collapsed:block" />
                </>
              )}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/tip relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
                  "sidebar-collapsed:mx-auto sidebar-collapsed:size-11 sidebar-collapsed:justify-center sidebar-collapsed:p-0",
                  active ? "bg-ink font-semibold text-on-ink" : "font-medium text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="sidebar-collapsed:sr-only">{item.label}</span>
                <Tip collapsedOnly>{item.label}</Tip>
              </Link>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
