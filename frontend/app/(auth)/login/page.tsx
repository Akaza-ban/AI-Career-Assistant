import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function Page({ searchParams }: PageProps<"/login">) {
  // ?expired=1: bị chuyển về vì phiên đăng nhập đã hết.
  const { expired } = await searchParams
  return <LoginForm expired={expired === "1"} />
}
