import type { Metadata } from "next"

import { NewAnalysis } from "@/components/student/analysis/new-analysis"

export const metadata: Metadata = { title: "Phân tích CV & JD" }

// ?cv=<id>: CV được chọn sẵn khi bấm "Phân tích" từ màn CV của tôi.
export default async function NewAnalysisPage({ searchParams }: PageProps<"/student/analysis/new">) {
  const { cv } = await searchParams
  return <NewAnalysis key={typeof cv === "string" ? cv : "default"} initialCvId={typeof cv === "string" ? cv : null} />
}
