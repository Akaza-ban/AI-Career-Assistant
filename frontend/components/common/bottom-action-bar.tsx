"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Thanh hành động cố định sát đáy màn hình (ví dụ "Đã chọn: … [Phân tích]"), trải hết vùng nội dung và chừa
 * sidebar 240px của AppShell trên desktop. Tự chèn khoảng trống bằng đúng chiều cao thanh để nội dung cuối trang
 * không bị che, kể cả khi thanh xuống dòng trên màn hình hẹp. Dùng component này cho mọi thanh kiểu này.
 */
export function BottomActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(64)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const observer = new ResizeObserver(() => setHeight(bar.offsetHeight))
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div aria-hidden style={{ height }} />
      <div
        ref={barRef}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-sm lg:left-60"
      >
        <div className={cn("mx-auto w-full max-w-[1200px] px-4 py-3 sm:px-6", className)}>{children}</div>
      </div>
    </>
  )
}
