import type { Metadata } from "next"

import { MyCv } from "@/components/student/cv/my-cv"

export const metadata: Metadata = { title: "CV của tôi" }

export default function MyCvPage() {
  return <MyCv />
}
