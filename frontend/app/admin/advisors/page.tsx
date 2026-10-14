import type { Metadata } from "next"

import { AdvisorList } from "@/components/admin/advisor-list"

export const metadata: Metadata = { title: "Cố vấn" }

export default async function Page({ searchParams }: PageProps<"/admin/advisors">) {
  const { q, new: create } = await searchParams
  const initialQuery = typeof q === "string" ? q : ""
  return <AdvisorList key={`${initialQuery}:${create}`} initialQuery={initialQuery} openCreate={create === "1"} />
}
