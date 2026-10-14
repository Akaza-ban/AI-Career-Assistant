import type { Metadata } from "next"

import { JdAdminList } from "@/components/admin/jd-admin-list"

export const metadata: Metadata = { title: "Thư viện JD" }

export default async function Page({ searchParams }: PageProps<"/admin/jds">) {
  const { tab } = await searchParams
  return <JdAdminList initialTab={tab === "uploaded" ? "uploaded" : "library"} />
}
