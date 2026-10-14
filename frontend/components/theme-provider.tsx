"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

// Mặc định theo cài đặt sáng / tối của máy; lựa chọn của người dùng được lưu ở trình duyệt (localStorage "theme").
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange {...props} />
}
