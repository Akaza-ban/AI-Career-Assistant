import type { Metadata } from "next"

import { ShareWithAdvisor } from "@/components/student/share/share-with-advisor"

export const metadata: Metadata = { title: "Chia sẻ với Cố vấn" }

export default function Page() {
  return <ShareWithAdvisor />
}
