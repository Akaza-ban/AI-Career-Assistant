import type { Metadata } from "next"

import { StudentHistory } from "@/components/student/history/student-history"

export const metadata: Metadata = { title: "Lịch sử & tiến bộ" }

export default function Page() {
  return <StudentHistory />
}
