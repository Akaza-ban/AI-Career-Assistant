import { AppShell } from "@/components/shell/app-shell"
import { AuthGuard } from "@/components/shell/auth-guard"

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return (
    <AuthGuard role="student">
      <AppShell role="student">{children}</AppShell>
    </AuthGuard>
  )
}
