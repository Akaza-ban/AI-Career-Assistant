import type { LucideIcon } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const BADGE_VARIANT = { good: "good", mid: "blue", low: "neutral", warn: "warn" } as const

/** Badge có chấm tròn như trong app (Cao / Khá, Đã đáp ứng / Còn thiếu…). */
export function LandingBadge({ tone, dot = true, children }: { tone: keyof typeof BADGE_VARIANT; dot?: boolean; children: ReactNode }) {
  return (
    <Badge variant={BADGE_VARIANT[tone]}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </Badge>
  )
}

const TILE_TONE = {
  blue: { from: "#BFE3FF", to: "#7FBFFF", fg: "#fff" },
  violet: { from: "#D3C8FF", to: "#9F86FF", fg: "#fff" },
  pink: { from: "#FFC6DF", to: "#FF8FB8", fg: "#fff" },
  peach: { from: "#FFD3C4", to: "#FF9E7E", fg: "#fff" },
  white: { from: "#FFFFFF", to: "#FFFFFF", fg: "var(--ink)" },
} as const
export type TileTone = keyof typeof TILE_TONE

/** Ô biểu tượng pastel bo góc ở hai bên hero (thay cho minh hoạ hoạt hình kiểu Family). */
export function IconTile({ icon: Icon, size, tone, className, style }: { icon: LucideIcon; size: number; tone: TileTone; className?: string; style?: CSSProperties }) {
  const t = TILE_TONE[tone]
  return (
    <span
      aria-hidden
      className={cn("grid place-items-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        color: t.fg,
        background: `linear-gradient(145deg, ${t.from}, ${t.to})`,
        boxShadow:
          tone === "white"
            ? "0 22px 40px -20px rgb(24 24 27 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.55), 0 0 0 1px var(--line)"
            : `0 22px 40px -20px ${t.to}, inset 0 1px 0 rgb(255 255 255 / 0.55)`,
        ...style,
      }}
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={1.75} />
    </span>
  )
}

export function SectionHeading({ eyebrow, title, description, className, dark = false }: { eyebrow?: string; title: string; description?: string; className?: string; dark?: boolean }) {
  return (
    <div className={cn("max-w-[720px]", className)}>
      {eyebrow && <p className={cn("mb-2.5 text-sm font-semibold", dark ? "text-[#B8A4FF]" : "text-blue")}>{eyebrow}</p>}
      <h2 className={cn("font-heading text-[30px] leading-9 font-semibold tracking-[-0.025em] text-balance md:text-[44px] md:leading-[50px]", dark ? "text-white" : "text-ink")}>
        {title}
      </h2>
      {description && <p className={cn("mt-3.5 text-base leading-[26px] md:mt-4 md:text-lg md:leading-7", dark ? "text-night-mute" : "text-ink-2")}>{description}</p>}
    </div>
  )
}
