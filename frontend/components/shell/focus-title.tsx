"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type TitleState = [string | null, (title: string | null) => void]

const FocusTitleContext = createContext<TitleState>([null, () => {}])

/** Giữ tên vị trí của buổi phỏng vấn để thanh trên của chế độ tập trung hiện ở giữa. */
export function FocusTitleProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null)
  return <FocusTitleContext.Provider value={state}>{children}</FocusTitleContext.Provider>
}

/** Ô giữa thanh trên; trống khi trang chưa biết vị trí. */
export function FocusTitleSlot({ fallback }: { fallback: string }) {
  const [title] = useContext(FocusTitleContext)
  return <span className="truncate text-sm font-semibold text-ink">{title ?? fallback}</span>
}

/** Trang Phòng chờ / Phòng phỏng vấn đặt tên vị trí lên thanh trên. */
export function SetFocusTitle({ title }: { title: string }) {
  const [, setTitle] = useContext(FocusTitleContext)
  useEffect(() => {
    setTitle(title)
    return () => setTitle(null)
  }, [title, setTitle])
  return null
}
