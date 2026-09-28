import type { Metadata } from "next"

import { StudentList, type StatusFilter } from "@/components/advisor/students/student-list"

export const metadata: Metadata = { title: "Sinh viên phụ trách" }

const STATUSES: StatusFilter[] = ["all", "pending", "flagged", "insufficient", "improving", "not_shared"]

export default async function Page({ searchParams }: PageProps<"/advisor/students">) {
  const { status } = await searchParams
  const initial = STATUSES.find((s) => s === status) ?? "all"
  return <StudentList key={initial} initialStatus={initial} />
}
