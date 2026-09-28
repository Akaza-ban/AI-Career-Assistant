import type { Metadata } from "next"

import { CvExport } from "@/components/student/optimizer/cv-export"

export const metadata: Metadata = { title: "Xuất CV" }

export default async function ExportPage({ params }: PageProps<"/student/analysis/[id]/export">) {
  const { id } = await params
  return <CvExport analysisId={id} />
}
