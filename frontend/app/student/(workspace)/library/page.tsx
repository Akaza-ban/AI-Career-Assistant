import type { Metadata } from "next"

import { JdLibrary } from "@/components/student/library/jd-library"

export const metadata: Metadata = { title: "Thư viện JD" }

// ?cv=<id>: gợi ý theo CV này thay cho CV đang dùng.
export default async function LibraryPage({ searchParams }: PageProps<"/student/library">) {
  const { cv } = await searchParams
  return <JdLibrary initialCvId={typeof cv === "string" ? cv : null} />
}
