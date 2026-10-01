import type { Metadata } from "next"

import { StudentSettingsPage } from "@/components/student/settings/student-settings"

export const metadata: Metadata = { title: "Cài đặt & Quyền riêng tư" }

export default function Page() {
  return <StudentSettingsPage />
}
