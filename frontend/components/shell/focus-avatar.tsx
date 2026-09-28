"use client"

import { useProfile } from "@/components/shell/profile-context"
import { UserAvatar } from "@/components/shell/user-avatar"

export function FocusAvatar() {
  const profile = useProfile()
  return <UserAvatar name={profile?.full_name} src={profile?.avatar_url} />
}
