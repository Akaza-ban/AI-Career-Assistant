import type { Metadata } from "next"

import { AdminOverview } from "@/components/admin/admin-overview"

export const metadata: Metadata = { title: "Tổng quan hệ thống" }

export default function Page() {
  return <AdminOverview />
}
