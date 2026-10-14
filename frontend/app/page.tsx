import type { Metadata } from "next"

import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: { absolute: "CareerV" },
  description: "CareerV so CV với mô tả công việc, gợi ý sửa từng câu và cho sinh viên luyện phỏng vấn thử theo khung STAR. Miễn phí cho sinh viên.",
}

export default function Home() {
  return <LandingPage />
}
