import type { Metadata } from "next"

import { AnalysisResult } from "@/components/student/analysis/analysis-result"

export const metadata: Metadata = { title: "Kết quả phân tích" }

export default async function AnalysisResultPage({ params }: PageProps<"/student/analysis/[id]">) {
  const { id } = await params
  return <AnalysisResult id={id} />
}
