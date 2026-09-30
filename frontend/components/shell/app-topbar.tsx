"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronRight, CircleHelp, LogOut, Menu, Settings } from "lucide-react"
import { toast } from "sonner"

import { ChatLauncher } from "@/components/chat/chat-launcher"
import { advisorShell, getBreadcrumb, studentShell } from "@/components/shell/nav-config"
import { NotificationMenu } from "@/components/shell/notification-menu"
import { useProfile } from "@/components/shell/profile-context"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AppTopbar({ role }: { role: Role }) {
  const pathname = usePathname()
  const config = role === "advisor" ? advisorShell : studentShell
  const profile = useProfile()
  const [menuOpen, setMenuOpen] = useState(false)
  const crumbs = getBreadcrumb(config, pathname)

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-card/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon-lg" className="-ml-2 lg:hidden" aria-label="Mở menu" />}
            >
              <Menu className="size-5" aria-hidden />
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
              <SidebarNav role={role} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1 text-xs font-medium whitespace-nowrap">
              {/* Luồng nhiều bước (ví dụ Phân tích → Tối ưu → Xuất) thì bỏ mục "Không gian..." cho gọn. */}
              {crumbs.length === 1 && <li className="hidden text-ink-2 sm:block">{config.workspaceLabel}</li>}
              {crumbs.map((crumb, index) => (
                <li
                  key={crumb.label}
                  className={cn(
                    "flex items-center gap-1",
                    crumb.href ? "shrink-0" : "min-w-0",
                    // Màn hình hẹp: chỉ giữ mục cha gần nhất và trang hiện tại
                    crumb.href && index < crumbs.length - 2 && "hidden sm:flex",
                  )}
                >
                  {(index > 0 || crumbs.length === 1) && (
                    <ChevronRight className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                  )}
                  {crumb.href ? (
                    <Link href={crumb.href} className="truncate text-ink-2 transition-colors hover:text-blue">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate text-ink" aria-current="page">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <ChatLauncher />
            <NotificationMenu role={role} />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="rounded-lg text-ink-2 hover:text-ink"
                    aria-label="Trợ giúp"
                    onClick={() => toast.info("Trung tâm trợ giúp đang được xây dựng.")}
                  />
                }
              >
                <CircleHelp className="size-5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Trợ giúp</TooltipContent>
            </Tooltip>
          </div>

          <span className="hidden rounded-full bg-blue-soft px-2.5 py-1 text-xs font-medium text-ink-2 sm:inline">
            {config.roleLabel}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" className="rounded-full" aria-label="Tài khoản" />}
            >
              <UserAvatar name={profile?.full_name} src={profile?.avatar_url} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="grid gap-0.5 py-1.5">
                  <span className="truncate text-sm font-semibold text-ink">{profile?.full_name ?? "…"}</span>
                  <span className="truncate text-xs font-normal">{profile?.subtitle}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {config.settingsHref && (
                <DropdownMenuItem render={<Link href={config.settingsHref} />}>
                  <Settings aria-hidden />
                  Cài đặt & Quyền riêng tư
                </DropdownMenuItem>
              )}
              <DropdownMenuItem render={<Link href="/" />}>
                <LogOut aria-hidden />
                Đổi vai trò
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
