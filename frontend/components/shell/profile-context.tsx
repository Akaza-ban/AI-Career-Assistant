"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

import { api, ApiError } from "@/lib/api"
import type { Role, UserProfile } from "@/lib/types"

const ProfileContext = createContext<UserProfile | undefined>(undefined)

/** Tải hồ sơ người dùng một lần cho cả khung giao diện. */
export function ProfileProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>()
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    api.getMe().then((user) => {
      if (!active) return
      if (user.role !== role) {
        window.location.replace(user.role === "advisor" ? "/advisor" : "/student")
        return
      }
      setProfile(user)
    }).catch((cause: unknown) => {
      if (!active) return
      if (cause instanceof ApiError && cause.status === 401) window.location.replace("/login")
      else setError(cause instanceof Error ? cause.message : "Không tải được tài khoản.")
    })
    return () => { active = false }
  }, [role])
  if (!profile || profile.role !== role) return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center" aria-live="polite">
      <p>{error || "Đang kiểm tra phiên đăng nhập…"}</p>
      {error && <button type="button" onClick={() => window.location.reload()} className="text-blue underline">Thử lại</button>}
    </main>
  )
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

/** undefined trong lúc đang tải. */
export function useProfile(): UserProfile | undefined {
  return useContext(ProfileContext)
}
