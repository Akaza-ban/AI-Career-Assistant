import type { Metadata } from "next"

import { InterviewLobby } from "@/components/student/interview/interview-lobby"

export const metadata: Metadata = { title: "Phòng phỏng vấn" }

// ?jd=<id>&cv=<id>: vị trí và CV đã chọn ở trang Thiết lập. Buổi phỏng vấn chỉ được tạo khi SV bấm "Sẵn sàng".
export default async function InterviewLobbyPage({ searchParams }: PageProps<"/student/interview/start">) {
  const { jd, cv } = await searchParams
  return <InterviewLobby jdId={typeof jd === "string" ? jd : null} cvId={typeof cv === "string" ? cv : null} />
}
