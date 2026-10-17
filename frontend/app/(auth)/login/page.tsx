import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function Page(props: {
  searchParams: Promise<{ expired?: string }>
}) {
  const searchParams = await props.searchParams
  return <LoginForm expired={searchParams?.expired === "1"} />
}
