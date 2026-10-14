import type { Metadata } from "next"

import { JdForm } from "@/components/admin/jd-form"

export const metadata: Metadata = { title: "Sửa JD" }

export default async function Page({ params }: PageProps<"/admin/jds/[id]">) {
  const { id } = await params
  return <JdForm id={id} />
}
