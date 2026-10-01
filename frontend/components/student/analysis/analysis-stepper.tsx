import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StepItem {
  title: string
  description: string
}

/**
 * Thanh 3 bước của luồng phân tích (Figma: "Section - Stepper Header").
 * `current` bắt đầu từ 0; các bước trước đó hiển thị "Đã xong".
 */
export function AnalysisStepper({
  steps,
  current,
  onStepClick,
}: {
  steps: StepItem[]
  current: number
  /** Cho phép bấm vào bước đã xong để quay lại. */
  onStepClick?: (index: number) => void
}) {
  return (
    <ol className="grid gap-3 rounded-[20px] border border-line bg-card p-4 shadow-card md:grid-cols-3">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        const clickable = done && onStepClick
        return (
          <li
            key={step.title}
            aria-current={active ? "step" : undefined}
            onClick={clickable ? () => onStepClick(index) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onStepClick(index)
                    }
                  }
                : undefined
            }
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            title={clickable ? `Quay lại bước ${index + 1}` : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2",
              active ? "bg-blue-soft/60" : done ? "bg-surface" : "opacity-70",
              clickable && "cursor-pointer transition-colors hover:bg-blue-soft/40",
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full font-heading text-base font-bold",
                done && "bg-good text-white",
                active && "bg-blue text-on-blue shadow-[0_6px_14px_-6px_var(--blue)]",
                !done && !active && "bg-surface text-ink-3",
              )}
            >
              {done ? <Check className="size-5" aria-hidden /> : index + 1}
            </span>
            <div className="grid min-w-0">
              <span className="flex items-center gap-2">
                <span className={cn("font-heading text-base font-bold", active ? "text-blue" : done ? "text-ink" : "text-ink-3")}>
                  {index + 1}. {step.title}
                </span>
                {done && <Badge variant="good">Đã xong</Badge>}
                {active && <span className="size-1.5 rounded-full bg-blue" aria-hidden />}
              </span>
              <span className="truncate text-xs text-ink-2" title={step.description}>
                {step.description}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
