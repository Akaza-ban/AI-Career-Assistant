'use client';

import { ArrowRight, ArrowUpRight, Crosshair, RotateCcw, type LucideIcon } from "lucide-react"

import { useAssistant } from "@/components/assistant/assistant-provider"
import { getBreadcrumb, shellOf } from "@/components/shell/nav-config"
import { resolveAssistantRoute, resolveUIRoute } from "@/lib/assistant-navigation"
import { cn } from "@/lib/utils"
import type { AgentAction, UIAction, UserRole } from "@/types/assistant"

/** Nhãn ngắn theo loại hành động; trang đích lấy tên từ thanh điều hướng (vd. "Mở Phân tích CV & JD"). */
function describe(action: AgentAction, role: UserRole): { icon: LucideIcon; label: string } {
  switch (action.action_type) {
    case "HIGHLIGHT_ELEMENT":
      return { icon: Crosshair, label: "Chỉ vị trí nút" }
    case "NAVIGATE_PAGE": {
      const route = resolveAssistantRoute(action.params.route, role)
      const page = route ? getBreadcrumb(shellOf(role), route).at(-1)?.label : undefined
      return { icon: ArrowUpRight, label: page ? `Mở ${page}` : "Mở trang" }
    }
    case "START_ANALYSIS":
      return { icon: ArrowRight, label: "Bắt đầu phân tích" }
    case "RESET_VIEW":
      return { icon: RotateCcw, label: "Đặt lại bộ lọc" }
    default:
      return { icon: ArrowRight, label: action.description_vi }
  }
}

export function ActionBadges({ actions, uiActions = [] }: { actions: AgentAction[]; uiActions?: UIAction[] }) {
  const { executeAction, activeAction, isThinking, isExecutingAction, userRole, pathname } = useAssistant()
  // Bỏ nút "Mở …" khi đang ở chính trang đó
  const shown = actions.filter(
    (action) => action.action_type !== "NAVIGATE_PAGE" || resolveAssistantRoute(action.params.route, userRole) !== pathname,
  )
  const links = uiActions.flatMap((action) => {
    if (action.type !== "navigate") return []
    const href = resolveUIRoute(action, userRole)
    return href ? [{ href, label: getBreadcrumb(shellOf(userRole), href).at(-1)?.label ?? "trang" }] : []
  })
  if (!shown.length && !links.length) return null

  return (
    <div className="flex flex-wrap gap-2" aria-label="Hành động được đề xuất">
      {links.map(({ href, label }) => (
        <a key={href} href={href} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel">
          <ArrowUpRight className="size-[15px]" aria-hidden />
          Mở {label}
        </a>
      ))}
      {shown.map((action) => {
        const { icon: Icon, label } = describe(action, userRole)
        return (
          <button
            type="button"
            key={action.id}
            disabled={isThinking || isExecutingAction}
            onClick={() => { void executeAction(action) }}
            title={action.requires_confirmation ? `${action.description_vi} (cần bạn xác nhận)` : action.description_vi}
            className={cn(
              "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,transform] duration-150 hover:bg-panel active:scale-[.97] disabled:pointer-events-none disabled:opacity-50",
              activeAction?.id === action.id && "shadow-[inset_0_0_0_1.5px_var(--ink)]",
            )}
          >
            <Icon className="size-[15px] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
