import type { Metadata } from "next"

import { FeedbackList } from "@/components/admin/feedback-list"

export const metadata: Metadata = { title: "Nhận xét" }

export default function Page() {
  return <FeedbackList />
}
