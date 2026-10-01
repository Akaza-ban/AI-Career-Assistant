import { ArrowRight, Flag, Hourglass, Lock, Minus, TrendingDown, TrendingUp } from "lucide-react"

import { UserAvatar } from "@/components/shell/user-avatar"
import { formatRelativeTime } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AssignedStudent, StudentStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export type { StudentStatus }

/** Trạng thái hiển thị: cờ "Cần chú ý" trước, sau đó là xu hướng điểm ở vị trí đang luyện. */
export function studentStatus(s: AssignedStudent): StudentStatus {
  return s.flag ? "flagged" : s.trend
}

export const STATUS_META: Record<StudentStatus, { label: string; className: string; icon: typeof Flag }> = {
  flagged: { label: "Cần chú ý", className: "bg-bad-soft text-bad", icon: Flag },
  declining: { label: "Đang giảm", className: "bg-warn-soft text-warn", icon: TrendingDown },
  insufficient: { label: "Chưa đủ dữ liệu", className: "bg-surface text-ink-2", icon: Hourglass },
  stable: { label: "Ổn định", className: "bg-blue-soft text-blue", icon: Minus },
  improving: { label: "Đang tiến bộ", className: "bg-good-soft text-good", icon: TrendingUp },
}

/** Sắp xếp mặc định: SV cần chú ý, đang giảm lên trước. */
export const STATUS_PRIORITY: Record<StudentStatus, number> = {
  flagged: 0,
  declining: 1,
  insufficient: 2,
  stable: 3,
  improving: 4,
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

/** Chi tiết cờ theo US-ADV-02 AC1: các buổi liên quan và thời điểm phát sinh. */
export function FlagDetail({ student }: { student: AssignedStudent }) {
  if (!student.flag) return null
  return (
    <span className="text-xs text-bad">
      Buổi {student.flag.rounds.join(", ")} không tăng điểm · {formatRelativeTime(student.flag.flagged_at).toLowerCase()}
    </span>
  )
}

/** Điểm buổi đầu → gần nhất ở vị trí đang luyện (US-ADV-01 AC1/AC2), thang 0–5. */
export function ScoreDelta({ student, size = "sm" }: { student: AssignedStudent; size?: "sm" | "md" }) {
  if (student.score_delta === null) {
    return (
      <span className="grid text-xs text-ink-2">
        <span className="font-medium">Chưa đủ dữ liệu</span>
        <span className="text-ink-3">
          {student.latest_score === null ? "Chưa có buổi nào" : `Mới có 1 buổi (${formatScore(student.latest_score)}/5)`}
        </span>
      </span>
    )
  }
  const d = student.score_delta
  return (
    <span className={cn("flex items-center gap-1.5 whitespace-nowrap", size === "md" ? "text-sm" : "text-xs")}>
      <span className="text-ink-2">{formatScore(student.first_score!)}</span>
      <ArrowRight className="size-3 text-ink-3" aria-hidden />
      <strong className="font-heading text-ink">{formatScore(student.latest_score!)}</strong>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 font-semibold",
          student.trend === "improving" ? "bg-good-soft text-good" : student.trend === "declining" ? "bg-bad-soft text-bad" : "bg-surface text-ink-2",
        )}
      >
        {d > 0 ? "+" : ""}
        {formatScore(d)}
      </span>
    </span>
  )
}

/** Số tài liệu SV đang chia sẻ; SV chưa chia sẻ gì thì chỉ có số liệu tổng hợp. */
export function SharingBadge({ student }: { student: AssignedStudent }) {
  if (student.shared_items === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-ink-3">
        <Lock className="size-3.5" aria-hidden />
        Chưa chia sẻ tài liệu
      </span>
    )
  }
  return (
    <span className="text-xs text-ink-2">
      Chia sẻ {student.shared_items}/{student.total_items} tài liệu
    </span>
  )
}

export function StudentIdentity({ student, showEmail = true }: { student: AssignedStudent; showEmail?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UserAvatar name={student.full_name} src={student.avatar_url} className="size-10" />
      <span className="grid min-w-0">
        <span className="truncate font-heading font-bold text-ink">{student.full_name}</span>
        <span className="truncate text-xs text-ink-2">
          {student.student_code ? `MSSV ${student.student_code}` : student.subtitle}
          {showEmail && ` · ${student.email}`}
        </span>
      </span>
    </span>
  )
}
