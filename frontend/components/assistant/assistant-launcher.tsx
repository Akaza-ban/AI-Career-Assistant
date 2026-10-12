"use client"

import { useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-provider"
import { useChat } from "@/components/chat/chat-context"
import { cn } from "@/lib/utils"

/**
 * Nút "Hỏi trợ lý" trên thanh trên cùng (bản vẽ TroLyLoiVao): trên máy tính là nút có chữ, trên điện thoại là biểu
 * tượng. Thay cho nút nổi để không che nội dung và thanh hành động cuối trang.
 */
export function AssistantLauncher() {
  const { isOpen, toggleChat } = useAssistant()
  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-expanded={isOpen}
      aria-controls="assistant-chat-panel"
      aria-label="Hỏi trợ lý hướng dẫn"
      title="Hỏi trợ lý hướng dẫn"
      className={cn(
        "grid size-10 place-items-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-[.97] lg:mr-1.5 lg:flex lg:h-9 lg:w-auto lg:gap-1.5 lg:pr-3.5 lg:pl-3 lg:text-sm lg:font-semibold",
        isOpen ? "bg-ink text-white" : "text-blue hover:bg-surface lg:bg-white/70 lg:text-ink lg:shadow-xs lg:backdrop-blur-[8px] lg:hover:bg-card",
      )}
    >
      <Sparkles className="size-[19px] lg:size-4" strokeWidth={1.75} aria-hidden />
      <span className="hidden lg:inline">Hỏi trợ lý</span>
    </button>
  )
}

/** Khung trợ lý và khung tin nhắn cùng chỗ: mở khung này thì đóng khung kia. */
export function OnePanelAtATime() {
  const chat = useChat()
  const assistant = useAssistant()
  const previous = useRef({ chat: chat.open, assistant: assistant.isOpen })
  const { closeChat: closeMessages } = chat
  const { closeChat: closeAssistant } = assistant

  useEffect(() => {
    const before = previous.current
    if (chat.open && !before.chat) closeAssistant()
    else if (assistant.isOpen && !before.assistant) closeMessages()
    previous.current = { chat: chat.open, assistant: assistant.isOpen }
  }, [chat.open, assistant.isOpen, closeAssistant, closeMessages])

  return null
}
