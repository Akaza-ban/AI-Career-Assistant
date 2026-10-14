import type { Metadata } from "next"

import { SavedCompare } from "@/components/student/analysis/compare-result"

export const metadata: Metadata = { title: "So sánh vị trí" }

// Lượt so sánh đã lưu (mở từ Lịch sử & tiến bộ): hiện đúng kết quả lúc so sánh, không chạy lại AI.
export default async function SavedComparePage({ params }: PageProps<"/student/analysis/compare/[id]">) {
  const { id } = await params
  return <SavedCompare key={id} id={id} />
}
