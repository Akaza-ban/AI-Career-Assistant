import { AppShell } from "@/components/shell/app-shell"

export default function StudentLayout({ children }: LayoutProps<"/student">) {
  return <AppShell role="student">{children}</AppShell>
}
