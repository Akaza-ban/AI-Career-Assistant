import { AppShell } from "@/components/shell/app-shell"
import { AuthGuard } from "@/components/shell/auth-guard"

export default function AdvisorLayout({ children }: LayoutProps<"/advisor">) {
  return (
    <AuthGuard role="advisor">
      <AppShell role="advisor">{children}</AppShell>
    </AuthGuard>
  )
}
