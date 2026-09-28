"use client"

import { createContext, useCallback, useContext, type ReactNode } from "react"

import { api } from "@/lib/api"
import type { Role, UserProfile } from "@/lib/types"
import { useApi } from "@/lib/use-api"

const ProfileContext = createContext<UserProfile | undefined>(undefined)

/** Tải hồ sơ người dùng một lần cho cả khung giao diện. */
export function ProfileProvider({ role, children }: { role: Role; children: ReactNode }) {
  const fetchMe = useCallback(() => api.getMe(role), [role])
  const { data } = useApi(fetchMe)
  return <ProfileContext.Provider value={data}>{children}</ProfileContext.Provider>
}

/** undefined trong lúc đang tải. */
export function useProfile(): UserProfile | undefined {
  return useContext(ProfileContext)
}
