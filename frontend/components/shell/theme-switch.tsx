"use client"

import { useSyncExternalStore } from "react"
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

export type ThemeChoice = "light" | "dark" | "system"

export const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo máy", icon: Monitor },
]

/** Chỉ biết chế độ đã lưu sau khi chạy ở trình duyệt; trước đó giữ biểu tượng mặc định để tránh lệch khi hydrate. */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

/**
 * Nút một chạm trên thanh trên cùng (app, landing, trang đăng nhập): đổi qua lại sáng / tối theo giao diện đang hiển thị.
 * Muốn theo cài đặt của máy thì gõ "giao diện" trong ô tìm kiếm Ctrl K.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const dark = mounted && resolvedTheme === "dark"
  const label = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-surface hover:text-ink active:scale-[.95]",
        className,
      )}
    >
      {/* Chưa biết chế độ khi render ở máy chủ: hiện mặt trăng, đổi đúng ngay sau khi chạy ở trình duyệt */}
      {dark ? <Sun className="size-[19px]" strokeWidth={1.75} aria-hidden /> : <Moon className="size-[19px]" strokeWidth={1.75} aria-hidden />}
    </button>
  )
}
