'use client';

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Target } from "lucide-react"

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
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60]">
      <div
        aria-hidden
        className="absolute rounded-xl border-2 border-blue-500 shadow-[0_0_24px_rgba(59,130,246,0.65),0_0_0_9999px_rgba(15,23,42,0.12)] motion-safe:animate-pulse"
        style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
      >
        <div className="absolute -inset-1 rounded-xl border-2 border-indigo-400/50" />
      </div>
      <div
        role="status"
        className="absolute flex max-w-[calc(100vw-1rem)] items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-lg"
        style={{ top: Math.max(8, rect.top >= 48 ? rect.top - 44 : Math.min(rect.bottom + 12, window.innerHeight - 44)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)) }}
      >
        <Target className="size-3.5 shrink-0" aria-hidden />
        {tooltip || "Trợ lý đang chỉ vào đây"}
      </div>
    </div>,
    document.body,
  )
}
