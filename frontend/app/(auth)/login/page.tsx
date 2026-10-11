import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function Page({ searchParams }: PageProps<"/login">) {
  // ?demo=1: mở sẵn hộp chọn vai trò demo ("Đổi vai trò" trong menu avatar trỏ tới đây).
  const { demo } = await searchParams
  return <LoginForm demoOpen={demo === "1"} />
}
