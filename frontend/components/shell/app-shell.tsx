import type { ReactNode } from "react"

import { ChatProvider } from "@/components/chat/chat-context"
import { ChatPanel } from "@/components/chat/chat-panel"
import { AppTopbar } from "@/components/shell/app-topbar"
import { NoticeBanner } from "@/components/shell/notice-banner"
import { ProfileProvider } from "@/components/shell/profile-context"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import type { Role } from "@/lib/types"

/**
 * Khung giao diện chính: sidebar 240px cố định (desktop), topbar dính trên cùng,
 * dải thông báo, vùng nội dung và khung chat SV ↔ cố vấn. Dưới 1024px sidebar chuyển vào menu trượt.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <ProfileProvider role={role}>
      <ChatProvider role={role}>
        <div className="min-h-screen bg-surface">
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line/60 bg-card shadow-[0_1px_4px_rgb(11_27_58/0.04)] lg:block">
            <SidebarNav role={role} />
          </aside>
          <div className="flex min-h-screen flex-col lg:pl-60">
            <AppTopbar role={role} />
            <NoticeBanner role={role} />
            <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          </div>
        </div>
        <ChatPanel />
      </ChatProvider>
    </ProfileProvider>
  )
}
