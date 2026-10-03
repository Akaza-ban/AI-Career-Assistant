import type { Metadata } from "next"

import { InterviewSetup } from "@/components/student/interview/interview-setup"

export const metadata: Metadata = { title: "Thiết lập phỏng vấn" }

// ?jd=<id>: chọn sẵn vị trí (ví dụ từ trang Kết quả phân tích); ?cv=<id>: chọn sẵn CV (ví dụ khi "Quay lại" từ phòng chờ).
export default async function InterviewSetupPage({ searchParams }: PageProps<"/student/interview/new">) {
  const { jd, cv } = await searchParams
  return (
    <InterviewSetup initialJdId={typeof jd === "string" ? jd : null} initialCvId={typeof cv === "string" ? cv : null} />
  )
}
