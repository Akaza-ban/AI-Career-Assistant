"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

// Giai đoạn đầu: khoá bảng màu sáng bất kể cài đặt hệ điều hành, để dễ theo dõi và bắt lỗi.
// Khi làm tính năng đổi sáng/tối: bỏ forcedTheme, đổi defaultTheme="system", bật enableSystem,
// và bỏ comment khối .dark trong app/globals.css.
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    />
  )
}
