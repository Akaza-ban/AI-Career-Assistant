import type { Metadata } from "next"

import { CompareResult } from "@/components/student/analysis/compare-result"

export const metadata: Metadata = { title: "So sánh vị trí" }

// ?cv=<id>&jd=<id>,<id>[,<id>]: lựa chọn nằm trong URL nên tải lại trang hoặc chia sẻ link vẫn ra đúng kết quả.
export default async function CompareAnalysisPage({ searchParams }: PageProps<"/student/analysis/compare">) {
  const { cv, jd } = await searchParams
  const cvId = typeof cv === "string" && cv ? cv : null
  const jdIds = typeof jd === "string" ? jd.split(",").filter(Boolean) : []
  return <CompareResult key={`${cvId}|${jdIds.join(",")}`} cvId={cvId} jdIds={jdIds} />
}
