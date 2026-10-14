import type { Metadata } from "next"

import { JdDetail } from "@/components/student/library/jd-detail"

export const metadata: Metadata = { title: "Chi tiết vị trí" }

// ?cv=<id>: mức phù hợp theo CV này thay cho CV đang dùng (đi từ Thư viện JD khi đang chọn CV khác).
export default async function JdDetailPage({ params, searchParams }: PageProps<"/student/library/[id]">) {
  const [{ id }, { cv }] = await Promise.all([params, searchParams])
  return <JdDetail id={id} initialCvId={typeof cv === "string" ? cv : null} />
}
