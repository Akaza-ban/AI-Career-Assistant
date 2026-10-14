import type { Metadata } from "next"

import { NewAnalysis } from "@/components/student/analysis/new-analysis"

export const metadata: Metadata = { title: "Phân tích CV & JD" }

// ?cv=<id>: CV được chọn sẵn khi bấm "Phân tích" từ màn CV của tôi.
// ?jd=<id>[,<id>]: vị trí chọn sẵn (chế độ 1 vị trí lấy vị trí đầu). ?mode=multi: chế độ so với nhiều vị trí.
export default async function NewAnalysisPage({ searchParams }: PageProps<"/student/analysis/new">) {
  const { cv, jd } = await searchParams
  const cvId = typeof cv === "string" ? cv : null
  const jdIds = typeof jd === "string" ? jd.split(",").filter(Boolean) : []
  return <NewAnalysis key={`${cvId ?? "default"}|${jdIds.join(",")}`} initialCvId={cvId} initialJdIds={jdIds} />
}
