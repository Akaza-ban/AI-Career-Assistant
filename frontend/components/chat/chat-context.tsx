"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { api } from "@/lib/api"
import type { Role } from "@/lib/types"

/** Hỏi số tin chưa đọc mỗi 20 giây (biểu tượng tin nhắn trên thanh trên cùng). */
const UNREAD_POLL_MS = 20_000

interface ChatState {
  role: Role
  open: boolean
  /** Hội thoại đang mở (mã SV); null = danh sách hội thoại (cố vấn) / hội thoại với cố vấn phụ trách (SV). */
  studentId: string | null
  unread: number
  /** Mở khung chat; cố vấn truyền mã SV để mở thẳng hội thoại với SV đó. */
  openChat: (studentId?: string) => void
  closeChat: () => void
  refreshUnread: () => void
}

const ChatContext = createContext<ChatState | null>(null)

/**
 * Trạng thái khung chat dùng chung cho cả khung giao diện, nên khung vẫn mở khi chuyển trang.
 * Phòng phỏng vấn dùng khung giao diện riêng nên không có chat.
 */
export function ChatProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)

  const refreshUnread = useCallback(() => {
    api.getUnreadMessageCount(role).then(setUnread, () => {
      // Lỗi mạng tạm thời: giữ số cũ, lần hỏi sau thử lại.
    })
  }, [role])

  useEffect(() => {
    refreshUnread()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshUnread()
    }, UNREAD_POLL_MS)
    const onVisible = () => document.visibilityState === "visible" && refreshUnread()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refreshUnread])

  const openChat = useCallback((id?: string) => {
    setStudentId(id ?? null)
    setOpen(true)
  }, [])
  const closeChat = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ role, open, studentId, unread, openChat, closeChat, refreshUnread }),
    [role, open, studentId, unread, openChat, closeChat, refreshUnread],
  )
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat(): ChatState {
  const state = useContext(ChatContext)
  if (!state) throw new Error("useChat phải nằm trong ChatProvider")
  return state
}
