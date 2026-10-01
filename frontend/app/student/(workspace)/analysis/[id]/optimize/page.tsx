import type { Metadata } from "next"

import { CvOptimizer } from "@/components/student/optimizer/cv-optimizer"

export const metadata: Metadata = { title: "Trình tối ưu CV" }

export default async function OptimizePage({ params }: PageProps<"/student/analysis/[id]/optimize">) {
  const { id } = await params
  return <CvOptimizer analysisId={id} />
}
