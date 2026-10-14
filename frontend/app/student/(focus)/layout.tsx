import { AuthGuard } from "@/components/shell/auth-guard"
import { FocusShell } from "@/components/shell/focus-shell"

export default function InterviewFocusLayout({ children }: LayoutProps<"/student">) {
  return (
    <AuthGuard role="student">
      <FocusShell>{children}</FocusShell>
    </AuthGuard>
  )
}
