"use client"

import { useRouter } from "next/navigation"

import { api } from "@/lib/api"
import { clearAuthMode } from "@/lib/session"

/** Đăng xuất (cả tài khoản demo) rồi về trang Đăng nhập. */
export function useSignOut() {
  const router = useRouter()
  return async function signOut() {
    await api.logout().catch(() => {})
    clearAuthMode()
    router.push("/login")
  }
}
