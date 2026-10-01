import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"

import { Logo } from "@/components/brand/logo"
import { ProfileProvider } from "@/components/shell/profile-context"
import { FocusAvatar } from "@/components/shell/focus-avatar"
import { LeaveRoomLink } from "@/components/shell/leave-room-link"

/**
 * Khung "Chế độ tập trung" cho Thiết lập phỏng vấn và Phòng phỏng vấn:
 * không có sidebar, header tối giản với nút Rời phòng.
 */
export function FocusShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider role="student">
      <div className="flex min-h-screen flex-col bg-surface">
        <header className="sticky top-0 z-30 border-b border-line/60 bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-12">
            <div className="flex min-w-0 items-center gap-3">
              <Logo href="/student" compact />
              <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
              <span className="hidden truncate text-sm font-medium text-violet sm:inline">Phòng phỏng vấn thử</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              <span className="hidden items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1 text-xs font-semibold text-violet md:inline-flex">
                <Sparkles className="size-3.5" aria-hidden />
                Chế độ tập trung
              </span>
              <LeaveRoomLink />
              <FocusAvatar />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-12 sm:py-8">{children}</main>
      </div>
    </ProfileProvider>
  )
}
