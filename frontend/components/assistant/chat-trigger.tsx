'use client';

import { useEffect } from "react"
import { Bot, X } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-provider"

export function ChatTrigger() {
  const { isOpen, toggleChat } = useAssistant()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.altKey) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        toggleChat()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggleChat])

  return (
    <button
      type="button"
      id="assistant-chat-trigger"
      aria-label={isOpen ? "Đóng trợ lý" : "Mở trợ lý hướng dẫn EDU-17"}
      aria-expanded={isOpen}
      aria-controls="assistant-chat-panel"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      title="Cần trợ giúp? Bấm hoặc nhấn Ctrl + K (Cmd + K trên Mac)"
      onClick={toggleChat}
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-2xl bg-linear-to-r from-blue via-violet to-blue text-white shadow-float transition-transform duration-200 [background-size:200%_200%] hover:-translate-y-1 hover:shadow-lg active:scale-95 motion-safe:animate-[assistant-gradient_6s_ease_infinite] print:hidden"
    >
      {isOpen ? <X className="size-6" aria-hidden /> : <Bot className="size-7" aria-hidden />}
      <span className="sr-only">Ctrl + K / Cmd + K</span>
    </button>
  )
}
