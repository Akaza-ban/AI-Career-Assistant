import { AppShell } from "@/components/shell/app-shell"

export default function AdvisorLayout({ children }: LayoutProps<"/advisor">) {
  return <AppShell role="advisor">{children}</AppShell>
}
