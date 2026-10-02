import type { Metadata } from "next"

import { CvDetail } from "@/components/student/cv/cv-detail"

export const metadata: Metadata = { title: "Chi tiết CV" }

export default async function CvDetailPage({ params }: PageProps<"/student/cv/[id]">) {
  const { id } = await params
  return <CvDetail id={id} />
}
