import type { Metadata } from "next"

import { AdminStudentList, type AssignFilter } from "@/components/admin/admin-student-list"

export const metadata: Metadata = { title: "Sinh viên" }

const FILTERS: AssignFilter[] = ["all", "unassigned", "assigned"]

export default async function Page({ searchParams }: PageProps<"/admin/students">) {
  const { filter, advisor, q } = await searchParams
  const initialFilter = FILTERS.find((f) => f === filter) ?? "all"
  const initialAdvisor = typeof advisor === "string" && advisor ? advisor : "all"
  const initialQuery = typeof q === "string" ? q : ""
  return (
    <AdminStudentList
      key={`${initialFilter}:${initialAdvisor}:${initialQuery}`}
      initialFilter={initialFilter}
      initialAdvisor={initialAdvisor}
      initialQuery={initialQuery}
    />
  )
}
