import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { STATUS_META, studentStatus } from "@/components/advisor/student-status"
import { formatScore } from "@/lib/interview"
import type { AssignedStudent, StudentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

// Mảnh giao diện nhỏ dùng chung cho danh sách SV và Tổng quan cố vấn (bản vẽ CoVanSinhVien / CoVanTongQuan).

/** Nền nhạt + chữ đậm cùng tông, chọn theo tên để mỗi SV giữ một màu cố định. */
const AVATAR_TONES = [
  "bg-blue-soft text-accent-strong",
  "bg-good-soft text-good",
  "bg-warn-soft text-warn",
  "bg-surface text-ink-2",
  "bg-violet-soft text-violet",
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return "?"
  // Tên riêng + chữ đầu của họ: "Phạm Thu Trang" → "PT".
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

function toneOf(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/** Avatar chữ cái đầu trên nền màu nhạt; dùng ảnh khi SV có ảnh đại diện. */
export function StudentAvatar({
  name,
  src,
  className,
}: {
  name: string
  src?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-9 after:hidden", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn("text-xs font-semibold", toneOf(name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}

const STATUS_TONE: Record<StudentStatus, "good" | "warn" | "blue" | "neutral"> = {
  improving: "good",
  stable: "blue",
  declining: "warn",
  flagged: "warn",
  insufficient: "neutral",
}

/** Nhãn trạng thái có chấm tròn (badge 6px, viền mảnh). */
export function StatusPill({ student }: { student: AssignedStudent }) {
  const status = studentStatus(student)
  return (
    <Badge variant={STATUS_TONE[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_META[status].label}
    </Badge>
  )
}

export function PendingPill({ count }: { count: number }) {
  return (
    <Badge variant="blue">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      Chờ nhận xét{count > 1 && <span className="tabular-nums">· {count}</span>}
    </Badge>
  )
}

/** Đường mảnh 56×22 cho điểm buổi đầu → gần nhất; vàng khi điểm giảm. */
export function MiniSparkline({ points, down = false }: { points: number[]; down?: boolean }) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const coords = points
    .map((v, i) => `${((i / (points.length - 1)) * 56).toFixed(1)},${(19 - ((v - min) / span) * 16).toFixed(1)}`)
    .join(" ")
  return (
    <svg width="56" height="22" viewBox="0 0 56 22" className="shrink-0" aria-hidden>
      <polyline
        points={coords}
        fill="none"
        className={down ? "stroke-warn" : "stroke-blue"}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** "2,8 → 4,1": điểm đầu nhạt, điểm gần nhất đậm. */
export function ScoreFromTo({ first, latest }: { first: number; latest: number }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-ink-3">{formatScore(first)} →</span>{" "}
      <b className="font-semibold text-ink">{formatScore(latest)}</b>
    </span>
  )
}
