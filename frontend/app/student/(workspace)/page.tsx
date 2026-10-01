import type { Metadata } from "next"

import { StudentOverview } from "@/components/student/overview/student-overview"

export const metadata: Metadata = { title: "Tổng quan" }

export default function StudentOverviewPage() {
  return <StudentOverview />
}
