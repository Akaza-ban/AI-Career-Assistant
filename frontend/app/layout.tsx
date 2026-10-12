import type { Metadata } from "next"
import { Be_Vietnam_Pro, Plus_Jakarta_Sans } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { AssistantProvider } from "@/components/assistant/assistant-provider"
import { ChatTrigger } from "@/components/assistant/chat-trigger"
import { ChatPanel } from "@/components/assistant/chat-panel"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const heading = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-head",
})

const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
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
      className={`${heading.variable} ${body.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider>
          <TooltipProvider>
            <AssistantProvider>
              {children}
              <ChatTrigger />
              <ChatPanel />
            </AssistantProvider>
          </TooltipProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
