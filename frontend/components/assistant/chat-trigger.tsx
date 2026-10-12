'use client';

import { Bot, X } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-provider"

export function ChatTrigger() {
  const { isOpen, toggleChat } = useAssistant()

  return (
    <button
      type="button"
      id="assistant-chat-trigger"
      aria-label={isOpen ? "Đóng trợ lý" : "Mở trợ lý hướng dẫn"}
      aria-expanded={isOpen}
      aria-controls="assistant-chat-panel"
      aria-haspopup="dialog"
      title="Cần trợ giúp? Hỏi trợ lý hướng dẫn"
      onClick={toggleChat}
      className="fixed right-4 bottom-[calc(var(--tabbar-h,0px)+var(--actionbar-h,0px)+1rem)] z-40 sm:right-6 lg:bottom-[calc(var(--actionbar-h,0px)+1.5rem)] flex size-14 items-center justify-center rounded-2xl bg-linear-to-r from-blue via-violet to-blue text-white shadow-float transition-transform duration-200 [background-size:200%_200%] hover:-translate-y-1 hover:shadow-lg active:scale-95 motion-safe:animate-[assistant-gradient_6s_ease_infinite] print:hidden"
    >
      {isOpen ? <X className="size-6" aria-hidden /> : <Bot className="size-7" aria-hidden />}
    </button>
  )
}
