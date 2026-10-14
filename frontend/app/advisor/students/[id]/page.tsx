import type { Metadata } from "next"

import { StudentProfile, type ProfileTab } from "@/components/advisor/profile/student-profile"

export const metadata: Metadata = { title: "Hồ sơ sinh viên" }

const TABS: ProfileTab[] = ["cv", "interviews", "notes"]

export default async function Page({ params, searchParams }: PageProps<"/advisor/students/[id]">) {
  const [{ id }, { tab, review }] = await Promise.all([params, searchParams])
  // ?review=<session_id>: mở thẳng dialog nhận xét của buổi đó (ở tab Phỏng vấn).
  const reviewId = typeof review === "string" && review ? review : null
  const initialTab = reviewId ? "interviews" : (TABS.find((t) => t === tab) ?? "interviews")
  return <StudentProfile key={id} studentId={id} initialTab={initialTab} initialReviewId={reviewId} />
}
