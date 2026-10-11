import type { Metadata } from "next"

import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: { absolute: "CareerX · CV đúng vị trí, phỏng vấn tự tin hơn" },
  description: "CareerX so CV với mô tả công việc, gợi ý sửa từng câu và cho sinh viên luyện phỏng vấn thử theo khung STAR. Miễn phí cho sinh viên.",
}

export default function Home() {
  return <LandingPage />
}
