import type { Metadata } from "next"

import { ChangeTemporaryPassword } from "@/components/auth/password-reset"

export const metadata: Metadata = { title: "Đặt mật khẩu của bạn" }

export default function Page() {
  return <ChangeTemporaryPassword />
}
