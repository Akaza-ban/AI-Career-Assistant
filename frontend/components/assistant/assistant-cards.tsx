'use client';

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { resolveUIRoute } from "@/lib/assistant-navigation"
import type { AssistantCard, AssistantChip, UserRole } from "@/types/assistant"

export function AssistantCards({ cards, role }: { cards: AssistantCard[]; role: UserRole }) {
  return <div className="grid gap-2">{cards.map((card) => {
    const href = resolveUIRoute({ type: "navigate", route_id: card.route_id, params: card.params }, role)
    return href ? <Link key={card.ref} href={href} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm text-blue hover:bg-surface">
      {card.label}<ArrowUpRight className="size-4 shrink-0" aria-hidden />
    </Link> : null
  })}</div>
}

export function AssistantChips({ chips, disabled, onSelect }: {
  chips: AssistantChip[]; disabled: boolean; onSelect: (chip: AssistantChip) => void
}) {
  return <div role="group" aria-label="Lựa chọn gợi ý" className="flex flex-wrap gap-2">
    {chips.map((chip, index) => <button key={`${chip.label}:${index}`} type="button" disabled={disabled}
      onClick={() => onSelect(chip)} className="rounded-full border border-line px-3 py-1.5 text-sm text-blue hover:bg-surface disabled:opacity-50">
      {chip.label}
    </button>)}
  </div>
}
