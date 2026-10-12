import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface AiProgressProps {
  title: string
  description?: string
  steps: string[]
  /** Chỉ số bước đang chạy (0-based). Bằng steps.length nghĩa là đã xong hết. */
  current: number
  className?: string
}

/** Tiến độ tác vụ AI 3–30 giây: các bước có tên và thanh gradient pastel chạy (DESIGN.md mục 9). */
export function AiProgress({ title, description, steps, current, className }: AiProgressProps) {
  const width = Math.min(100, Math.round(((current + 0.5) / steps.length) * 100))
  return (
    <section
      aria-live="polite"
      aria-busy={current < steps.length}
      className={cn("flex flex-col gap-5 rounded-panel border border-line bg-card p-6 sm:p-8", className)}
    >
      <div>
        <h2 className="font-heading text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      <ol className="flex flex-wrap gap-x-7 gap-y-2.5">
        {steps.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={label}
              className={cn("flex items-center gap-2.5 text-sm font-medium", done || active ? "text-ink" : "text-ink-3")}
            >
              <span
                className={cn(
                  "grid size-[22px] place-items-center rounded-full",
                  done ? "bg-ink text-white" : active ? "bg-blue-soft text-blue" : "bg-surface",
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                {active && <span className="size-[7px] animate-pulse rounded-full bg-current" aria-hidden />}
              </span>
              {label}
            </li>
          )
        })}
      </ol>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <div className="ai-run h-full rounded-full transition-[width] duration-500" style={{ width: `${width}%` }} />
      </div>
    </section>
  )
}
