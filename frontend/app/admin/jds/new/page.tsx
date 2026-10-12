import type { Metadata } from "next"

import { JdForm } from "@/components/admin/jd-form"

export const metadata: Metadata = { title: "Thêm JD vào thư viện" }

// ?from=<id JD sinh viên tải lên>: "Đưa vào thư viện", điền sẵn từ JD đó
export default async function Page({ searchParams }: PageProps<"/admin/jds/new">) {
  const { from } = await searchParams
  return <JdForm fromId={typeof from === "string" && from ? from : undefined} />
}
