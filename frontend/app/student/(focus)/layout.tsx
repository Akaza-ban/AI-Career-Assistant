import { FocusShell } from "@/components/shell/focus-shell"

export default function InterviewFocusLayout({ children }: LayoutProps<"/student">) {
  return <FocusShell>{children}</FocusShell>
}
