import type { ReactNode } from "react"

import { Logo } from "@/components/brand/logo"
import { FocusAvatar } from "@/components/shell/focus-avatar"
import { FocusTitleProvider, FocusTitleSlot } from "@/components/shell/focus-title"
import { LeaveRoomLink } from "@/components/shell/leave-room-link"
import { ProfileProvider } from "@/components/shell/profile-context"

/**
 * Khung "Chế độ tập trung" cho Phòng chờ và Phòng phỏng vấn (DESIGN.md 5.5):
 * không sidebar, không dải pastel; thanh trên gồm logo · tên vị trí ở giữa · Rời phòng và avatar.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider role="student">
      <FocusTitleProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur-md">
            <div className="mx-auto grid h-16 w-full max-w-[1260px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:grid-cols-[1fr_minmax(0,auto)_1fr] sm:px-6">
              <div className="flex min-w-0 items-center">
                <Logo href="/student" />
              </div>
              <div className="flex min-w-0 justify-center text-center max-sm:hidden">
                <FocusTitleSlot fallback="Phòng phỏng vấn thử" />
              </div>
              <div className="flex shrink-0 items-center justify-end gap-3 max-sm:col-start-3 sm:gap-4">
                <LeaveRoomLink />
                <FocusAvatar />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1260px] flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </FocusTitleProvider>
    </ProfileProvider>
  )
}
