import type { Metadata } from "next"

import { CohortProgress } from "@/components/advisor/progress/cohort-progress"

export const metadata: Metadata = { title: "Theo dõi tiến bộ" }

export default function Page() {
  return <CohortProgress />
}
