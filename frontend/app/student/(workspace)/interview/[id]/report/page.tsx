import type { Metadata } from "next"

import { InterviewReport } from "@/components/student/interview/interview-report"

export const metadata: Metadata = { title: "Báo cáo phỏng vấn" }

export default async function InterviewReportPage({ params }: PageProps<"/student/interview/[id]/report">) {
  const { id } = await params
  return <InterviewReport sessionId={id} />
}
