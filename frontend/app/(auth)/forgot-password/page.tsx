import type { Metadata } from "next"

import { ForgotPassword } from "@/components/auth/password-reset"

export const metadata: Metadata = { title: "Quên mật khẩu" }

export default function Page() {
  return <ForgotPassword />
}
