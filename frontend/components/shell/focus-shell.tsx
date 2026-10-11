import type { ReactNode } from "react"

import { Logo } from "@/components/brand/logo"
import { ProfileProvider } from "@/components/shell/profile-context"
import { FocusAvatar } from "@/components/shell/focus-avatar"
import { LeaveRoomLink } from "@/components/shell/leave-room-link"

/**
 * Khung "Chế độ tập trung" cho Phòng chờ và Phòng phỏng vấn (DESIGN.md 5.5):
 * không sidebar, không dải pastel, header tối giản với nút Rời phòng.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider role="student">
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1260px] items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Logo href="/student" />
              <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
              <span className="hidden truncate text-sm font-medium text-ink-2 sm:inline">Phòng phỏng vấn thử</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <LeaveRoomLink />
              <FocusAvatar />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1260px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </ProfileProvider>
  )
}
