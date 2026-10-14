"use client"

import { createContext, useCallback, useContext, type ReactNode } from "react"

import { api } from "@/lib/api"
import type { Role, UserProfile } from "@/lib/types"
import { useApi } from "@/lib/use-api"

const ProfileContext = createContext<UserProfile | undefined>(undefined)
const ReloadProfileContext = createContext<() => void>(() => {})

/** Tải hồ sơ người dùng một lần cho cả khung giao diện. */
export function ProfileProvider({ role, children }: { role: Role; children: ReactNode }) {
  const fetchMe = useCallback(() => api.getMe(role), [role])
  const { data, reload } = useApi(fetchMe)
  return (
    <ReloadProfileContext.Provider value={reload}>
      <ProfileContext.Provider value={data}>{children}</ProfileContext.Provider>
    </ReloadProfileContext.Provider>
  )
}

/** undefined trong lúc đang tải. */
export function useProfile(): UserProfile | undefined {
  return useContext(ProfileContext)
}

/** Tải lại hồ sơ sau khi sửa (ví dụ đổi họ tên ở Cài đặt) để header cập nhật ngay. */
export function useReloadProfile(): () => void {
  return useContext(ReloadProfileContext)
}
