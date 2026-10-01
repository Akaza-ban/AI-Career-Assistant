import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  // Bỏ học vị ("ThS.", "TS.") rồi lấy chữ cái đầu của họ và tên.
  const parts = name.replace(/^(ThS|TS|PGS\.TS|GS\.TS)\.?\s+/i, "").trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return "?"
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase()
}

interface UserAvatarProps {
  name: string | undefined
  src: string | null | undefined
  className?: string
}

export function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-8", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-blue-soft font-heading text-xs font-bold text-blue">
        {name ? initials(name) : ""}
      </AvatarFallback>
    </Avatar>
  )
}
