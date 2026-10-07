'use client';

import { ArrowUpRight, Crosshair, LockKeyhole, Sparkles } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-provider"
import { cn } from "@/lib/utils"
import type { AgentAction } from "@/types/assistant"

export function ActionBadges({ actions }: { actions: AgentAction[] }) {
  const { executeAction, activeAction, isThinking } = useAssistant()
  if (!actions.length) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Hành động được đề xuất">
      {actions.map((action) => {
        const Icon = action.requires_confirmation ? LockKeyhole
          : action.action_type === "NAVIGATE_PAGE" ? ArrowUpRight
          : action.action_type === "HIGHLIGHT_ELEMENT" ? Crosshair : Sparkles
        const label = action.action_type === "NAVIGATE_PAGE" ? "Bấm để chuyển đến trang này ngay"
          : action.action_type === "HIGHLIGHT_ELEMENT" ? "Nhấn để xem vị trí nút"
          : action.description_vi
        return (
          <button
            type="button"
            key={action.id}
            disabled={isThinking}
            onClick={() => { void executeAction(action) }}
            title={action.description_vi}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue/20 bg-blue-soft px-2.5 py-2 text-left text-xs font-medium text-blue transition-colors hover:bg-blue/15 disabled:cursor-not-allowed disabled:opacity-50",
              activeAction?.id === action.id && "ring-2 ring-blue/30",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
