import type { ReactNode } from "react"

import { ChatProvider } from "@/components/chat/chat-context"
import { ChatPanel } from "@/components/chat/chat-panel"
import { AppTopbar } from "@/components/shell/app-topbar"
import { NoticeBanner } from "@/components/shell/notice-banner"
import { ProfileProvider } from "@/components/shell/profile-context"
import { SidebarNav } from "@/components/shell/sidebar-nav"
import type { Role } from "@/lib/types"

/**
 * Khung giao diện chính: sidebar cố định (desktop), topbar dính trên cùng,
 * dải thông báo, vùng nội dung và khung chat SV ↔ cố vấn. Dưới 1024px sidebar chuyển vào menu trượt.
 *
 * Sidebar desktop thu gọn thành rail 72px (logo, icon, avatar). Rê chuột (sau 150ms, tránh bung khi chuột
 * chỉ lướt qua) hoặc Tab bằng bàn phím thì mở ra 240px, phủ lên nội dung chứ không đẩy nội dung sang phải.
 * Dùng :focus-visible thay vì :focus-within để bấm chuột vào một mục rồi rời đi thì sidebar vẫn thu lại.
 */
export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <ProfileProvider role={role}>
      <ChatProvider role={role}>
        <div className="min-h-screen bg-surface">
          <aside className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-18 overflow-hidden border-r border-line/60 bg-card shadow-[0_1px_4px_rgb(11_27_58/0.04)] transition-[width,box-shadow] duration-200 ease-out hover:w-60 hover:shadow-[8px_0_24px_-12px_rgb(11_27_58/0.18)] hover:delay-150 has-[:focus-visible]:w-60 has-[:focus-visible]:shadow-[8px_0_24px_-12px_rgb(11_27_58/0.18)] lg:block">
            <SidebarNav role={role} collapsible />
          </aside>
          <div className="flex min-h-screen flex-col lg:pl-18">
            <AppTopbar role={role} />
            <NoticeBanner role={role} />
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
          </div>
        </div>
        <ChatPanel />
      </ChatProvider>
    </ProfileProvider>
  )
}
