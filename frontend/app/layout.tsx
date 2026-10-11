import type { Metadata } from "next"
import { Hanken_Grotesk } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

// Một font grotesk cho cả tiêu đề và nội dung (DESIGN.md 3.4), có dấu tiếng Việt.
const sans = Hanken_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: {
    default: "CareerX",
    template: "%s · CareerX",
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
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
