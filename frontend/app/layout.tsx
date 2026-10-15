import type { Metadata } from "next"
import { Hanken_Grotesk } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SIDEBAR_INIT_SCRIPT } from "@/lib/sidebar"
import "./globals.css"

// Một font grotesk cho cả tiêu đề và nội dung (DESIGN.md 3.4), có dấu tiếng Việt.
const sans = Hanken_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: {
    default: "CareerV",
    template: "%s · CareerV",
  },
  description: "Trợ lý nghề nghiệp: phân tích CV theo JD và luyện phỏng vấn STAR.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${sans.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Đặt trạng thái sidebar thu gọn trước khi vẽ trang (xem lib/sidebar.ts) */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
