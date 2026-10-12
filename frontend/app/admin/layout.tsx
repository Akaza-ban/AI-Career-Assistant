import { AppShell } from "@/components/shell/app-shell"
import { AuthGuard } from "@/components/shell/auth-guard"

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AuthGuard role="admin">
      <AppShell role="admin">{children}</AppShell>
    </AuthGuard>
  )
}
