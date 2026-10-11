"use client"

import { Mail } from "lucide-react"

import { useChat } from "@/components/chat/chat-context"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Biểu tượng tin nhắn trên thanh trên cùng, cạnh chuông thông báo: bật / tắt khung chat, kèm số tin chưa đọc. */
export function ChatLauncher() {
  const { open, unread, openChat, closeChat } = useChat()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative size-10 rounded-full text-ink-2 hover:text-ink"
            aria-label={unread > 0 ? `Tin nhắn, ${unread} chưa đọc` : "Tin nhắn"}
            aria-expanded={open}
            onClick={() => (open ? closeChat() : openChat())}
          />
        }
      >
        <Mail className="size-[19px]" strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-blue px-1 text-[10px] leading-none font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>Tin nhắn</TooltipContent>
    </Tooltip>
  )
}
