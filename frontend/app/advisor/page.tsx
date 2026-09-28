import type { Metadata } from "next"

import { AdvisorOverview } from "@/components/advisor/overview/advisor-overview"

export const metadata: Metadata = { title: "Tổng quan" }

export default function Page() {
  return <AdvisorOverview />
}
