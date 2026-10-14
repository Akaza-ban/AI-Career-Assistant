import type { Metadata } from "next"

import { ResetPassword } from "@/components/auth/password-reset"

export const metadata: Metadata = { title: "Đặt mật khẩu mới" }

export default async function Page({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams
  return <ResetPassword token={typeof token === "string" && token ? token : null} />
}
