"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Thanh hành động cố định sát đáy màn hình (ví dụ "Đã chọn: … [Phân tích]"), trải hết vùng nội dung và chừa
 * sidebar 252px của AppShell trên desktop; trên điện thoại nằm ngay trên thanh tab (--tabbar-h). Tự chèn khoảng trống
 * bằng đúng chiều cao thanh để nội dung cuối trang không bị che. Dùng component này cho mọi thanh kiểu này.
 * Chiều cao được ghi vào biến --actionbar-h để nút trợ lý AI nổi phía trên thanh.
 */
export function BottomActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(64)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => {
      setHeight(bar.offsetHeight)
      root.style.setProperty("--actionbar-h", `${bar.offsetHeight}px`)
    })
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--actionbar-h")
    }
  }, [])

  return (
    <>
      <div aria-hidden style={{ height }} />
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-[var(--tabbar-h,0px)] z-30 border-t border-line bg-card/90 backdrop-blur-md lg:left-[252px]"
      >
        <div className={cn("w-full px-4 py-3 sm:px-6 lg:px-10 xl:px-12", className)}>{children}</div>
      </div>
    </>
  )
}
