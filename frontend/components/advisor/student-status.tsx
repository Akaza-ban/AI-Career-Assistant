import { ArrowRight, Flag, Lock, TrendingDown, TrendingUp, Minus, Hourglass } from "lucide-react"

import { UserAvatar } from "@/components/shell/user-avatar"
import { formatRelativeTime } from "@/lib/format"
import type { AssignedStudent } from "@/lib/types"
import { cn } from "@/lib/utils"

export type StudentStatus = "not_shared" | "flagged" | "insufficient" | "improving" | "stable" | "declining"

/** Trạng thái hiển thị của SV. Thứ tự ưu tiên: chưa chia sẻ → cần chú ý → chưa đủ dữ liệu → xu hướng điểm. */
export function studentStatus(s: AssignedStudent): StudentStatus {
  if (s.shared_items === 0) return "not_shared"
  if (s.flagged) return "flagged"
  if (s.score_delta === null) return "insufficient"
  if (s.score_delta >= 5) return "improving"
  if (s.score_delta < 0) return "declining"
  return "stable"
}

export const STATUS_META: Record<StudentStatus, { label: string; className: string; icon: typeof Flag }> = {
  flagged: { label: "Cần chú ý", className: "bg-bad-soft text-bad", icon: Flag },
  not_shared: { label: "Chưa chia sẻ", className: "bg-surface text-ink-2", icon: Lock },
  insufficient: { label: "Chưa đủ dữ liệu", className: "bg-surface text-ink-2", icon: Hourglass },
  improving: { label: "Đang tiến bộ", className: "bg-good-soft text-good", icon: TrendingUp },
  stable: { label: "Ổn định", className: "bg-blue-soft text-blue", icon: Minus },
  declining: { label: "Đang giảm", className: "bg-warn-soft text-warn", icon: TrendingDown },
}

/** Sắp xếp mặc định: SV cần chú ý và có báo cáo chờ nhận xét lên trước. */
export const STATUS_PRIORITY: Record<StudentStatus, number> = {
  flagged: 0,
  declining: 1,
  insufficient: 2,
  stable: 3,
  improving: 4,
  not_shared: 5,
}

export function StudentStatusBadge({ student, className }: { student: AssignedStudent; className?: string }) {
  const meta = STATUS_META[studentStatus(student)]
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", meta.className, className)}>
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  )
}

/** Chi tiết cờ theo US-ADV-02 AC1: thời điểm phát sinh và các vòng liên quan. */
export function FlagDetail({ student }: { student: AssignedStudent }) {
  if (!student.flagged || !student.flag_rounds) return null
  return (
    <span className="text-xs text-bad">
      Vòng {student.flag_rounds.join(", ")} không tăng điểm
      {student.flagged_at && ` · ${formatRelativeTime(student.flagged_at).toLowerCase()}`}
    </span>
  )
}

/** Điểm vòng đầu → gần nhất và delta (US-ADV-01 AC1/AC2). */
export function ScoreDelta({ student, size = "sm" }: { student: AssignedStudent; size?: "sm" | "md" }) {
  if (student.shared_items === 0) return <span className="text-xs text-ink-3">Chưa chia sẻ dữ liệu</span>
  if (student.score_delta === null) {
    return (
      <span className="grid text-xs text-ink-2">
        <span className="font-medium">Chưa đủ dữ liệu</span>
        <span className="text-ink-3">
          {student.interview_count === 0 ? "Chưa có vòng nào" : `Mới có 1 vòng (${student.latest_score} điểm)`}
        </span>
      </span>
    )
  }
  const d = student.score_delta
  return (
    <span className={cn("flex items-center gap-1.5 whitespace-nowrap", size === "md" ? "text-sm" : "text-xs")}>
      <span className="text-ink-2">{student.first_score}</span>
      <ArrowRight className="size-3 text-ink-3" aria-hidden />
      <strong className="font-heading text-ink">{student.latest_score}</strong>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 font-semibold",
          d >= 5 ? "bg-good-soft text-good" : d < 0 ? "bg-bad-soft text-bad" : "bg-surface text-ink-2",
        )}
      >
        {d > 0 ? "+" : ""}
        {d}
      </span>
    </span>
  )
}

export function StudentIdentity({ student, muted = false, showEmail = true }: { student: AssignedStudent; muted?: boolean; showEmail?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UserAvatar name={student.full_name} src={student.avatar_url} className={cn("size-10", muted && "opacity-60")} />
      <span className="grid min-w-0">
        <span className={cn("truncate font-heading font-bold", muted ? "text-ink-2" : "text-ink")}>{student.full_name}</span>
        <span className="truncate text-xs text-ink-2">
          MSSV {student.student_code}
          {showEmail && ` · ${student.email}`}
        </span>
      </span>
    </span>
  )
}
