"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Số đếm nhỏ cạnh nhãn, ví dụ "Đã lưu 2". */
  count?: number
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  "aria-label": string
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * Nhóm lựa chọn dạng pill có nền trắng trượt theo mục đang chọn (DESIGN.md mục 6).
 * Các mục rộng bằng nhau; dùng phím mũi tên để chuyển.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const n = options.length

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const next = (index + (e.key === "ArrowRight" ? 1 : n - 1)) % n
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      onKeyDown={onKeyDown}
      className={cn("relative grid rounded-full bg-surface p-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-[3px] rounded-full bg-card shadow-xs transition-[left] duration-300 ease-spring"
        style={{ width: `calc((100% - 6px) / ${n})`, left: `calc(3px + ${index} * (100% - 6px) / ${n})` }}
      />
      {options.map((option, i) => {
        const selected = i === index
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-[1] rounded-full px-3 font-semibold whitespace-nowrap transition-colors",
              size === "sm" ? "h-8 text-[13px]" : size === "lg" ? "h-10 px-5 text-[15px]" : "h-9 text-sm",
              selected ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1 font-medium tabular-nums opacity-75">{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
