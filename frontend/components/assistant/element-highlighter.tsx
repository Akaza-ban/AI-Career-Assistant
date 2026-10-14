'use client';

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Crosshair } from "lucide-react"

interface ElementHighlighterProps {
  selector: string | null
  tooltip?: string
  durationMs?: number
  onDismiss: () => void
}

export function ElementHighlighter({ selector, tooltip, durationMs = 5000, onDismiss }: ElementHighlighterProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!selector) return
    let element: Element | null
    try {
      element = document.querySelector(selector)
    } catch {
      onDismiss()
      return
    }
    if (!element) {
      onDismiss()
      return
    }

    const initial = element.getBoundingClientRect()
    if (initial.top < 0 || initial.left < 0 || initial.bottom > window.innerHeight || initial.right > window.innerWidth) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    }
    let frame = 0
    const updateRect = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!element.isConnected) {
          onDismiss()
          return
        }
        setRect(element.getBoundingClientRect())
      })
    }
    updateRect()
    const observer = new ResizeObserver(updateRect)
    observer.observe(element)
    window.addEventListener("resize", updateRect)
    // Capture scroll events from nested scroll containers as well as the window.
    window.addEventListener("scroll", updateRect, true)
    element.addEventListener("click", onDismiss)
    const timer = window.setTimeout(onDismiss, Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 5000)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
      element.removeEventListener("click", onDismiss)
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [selector, durationMs, onDismiss])

  if (!selector || !rect) return null
  // Ưu tiên chữ trên chính nút ("Bắt đầu phân tích ở đây"); mô tả chung của hành động chỉ dùng khi không đọc được.
  const name = targetLabel(selector)
  const label = name ? `${name} ở đây` : tooltip || "Trợ lý đang chỉ vào đây"
  const above = rect.top >= 56
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        aria-hidden
        className="absolute rounded-xl shadow-[0_0_0_2px_var(--ink),0_0_0_7px_color-mix(in_oklab,var(--blue)_22%,transparent),0_0_0_9999px_rgb(24_24_27/0.28)] motion-safe:animate-in motion-safe:fade-in-0"
        style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: Math.min(999, rect.height / 2 + 6) }}
      />
      <div
        role="status"
        className="absolute flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-[10px] bg-ink px-3 py-[7px] text-[13px] font-semibold text-on-ink shadow-[0_8px_20px_-6px_rgb(24_24_27/0.3)]"
        style={{
          top: above ? rect.top - 50 : Math.min(rect.bottom + 14, window.innerHeight - 44),
          left: Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268)),
        }}
      >
        <Crosshair className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        {label}
      </div>
    </div>,
    document.body,
  )
}

/** Tên ngắn của phần tử đang được chỉ (chữ trên nút), để nhãn và khung chat nói rõ đang chỉ gì. */
export function targetLabel(selector: string): string | null {
  try {
    const element = document.querySelector(selector)
    const text = (element?.getAttribute("aria-label") || element?.textContent || "").replace(/\s+/g, " ").trim()
    return text && text.length <= 40 ? text : null
  } catch {
    return null
  }
}
