import type { Metadata } from "next"

import { InterviewRoom } from "@/components/student/interview/interview-room"

export const metadata: Metadata = { title: "Phòng phỏng vấn" }

export default async function InterviewRoomPage({ params }: PageProps<"/student/interview/[id]">) {
  const { id } = await params
  return <InterviewRoom sessionId={id} />
}
