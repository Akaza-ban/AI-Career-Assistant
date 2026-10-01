import type { Metadata } from "next"

import { StudentProfile, type ProfileTab } from "@/components/advisor/profile/student-profile"

export const metadata: Metadata = { title: "Hồ sơ sinh viên" }

const TABS: ProfileTab[] = ["cv", "interviews", "notes"]

export default async function Page({ params, searchParams }: PageProps<"/advisor/students/[id]">) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  const initialTab = TABS.find((t) => t === tab) ?? "interviews"
  return <StudentProfile key={id} studentId={id} initialTab={initialTab} />
}
