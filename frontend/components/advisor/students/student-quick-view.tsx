"use client"

import Link from "next/link"
import { useCallback } from "react"
import { ArrowRight, FileText, Mail, MessageSquareText, MessagesSquare, Upload } from "lucide-react"

import { FlagDetail, ScoreDelta, StudentStatusBadge } from "@/components/advisor/student-status"
import { ScoreRing } from "@/components/common/score-ring"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { STAR_KEYS, STAR_LABELS, STAR_LEVEL_STYLE, starLevel } from "@/lib/star"
import type { ActivityItem, AssignedStudent } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const ACTIVITY_ICON: Record<ActivityItem["kind"], typeof FileText> = {
  interview: MessagesSquare,
  cv_optimized: Upload,
  advisor_comment: MessageSquareText,
  gap_analysis: FileText,
}

interface StudentQuickViewProps {
  student: AssignedStudent | null
  onClose: () => void
}

// Figma: khung "Xem nhanh sinh viên" ở frame "Sinh viên phụ trách" (18:5405).
export function StudentQuickView({ student, onClose }: StudentQuickViewProps) {
  return (
    <Sheet open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {student && <QuickViewBody student={student} />}
      </SheetContent>
    </Sheet>
  )
}

function QuickViewBody({ student }: { student: AssignedStudent }) {
  const hidden = student.shared_items === 0
  const fetchDetail = useCallback(() => api.getAdvisorStudent(student.id), [student.id])
  const { data: detail } = useApi(fetchDetail)
  const profileHref = `/advisor/students/${encodeURIComponent(student.id)}`

  return (
    <div className="grid gap-5 p-6">
      <SheetHeader className="p-0">
        <SheetTitle className="font-heading text-lg">Xem nhanh sinh viên</SheetTitle>
        <SheetDescription className="sr-only">Tóm tắt điểm, tiêu chí STAR và hoạt động gần nhất của {student.full_name}</SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-4 rounded-2xl bg-blue-soft/50 p-4">
        <UserAvatar name={student.full_name} src={student.avatar_url} className="size-14" />
        <div className="grid min-w-0 gap-1">
          <p className="font-heading text-base font-bold">{student.full_name}</p>
          <p className="text-xs text-ink-2">
            MSSV: {student.student_code} · {student.subtitle}
          </p>
          {student.target_title && (
            <Badge variant="blue" className="h-auto justify-self-start px-2 py-0.5 whitespace-normal">
              {student.target_title}
              {student.target_company && ` · ${student.target_company}`}
            </Badge>
          )}
        </div>
      </div>

      {hidden ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-ink-2">
          Sinh viên chưa chia sẻ dữ liệu nào với bạn. Bạn chỉ xem được thông tin định danh.
        </p>
      ) : (
        <>
          <div className="grid gap-3 rounded-2xl border border-line p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Điểm phỏng vấn gần nhất</p>
              <StudentStatusBadge student={student} />
            </div>
            <div className="flex items-center gap-4">
              {student.latest_score !== null ? (
                <ScoreRing score={student.latest_score} size={84} strokeWidth={8} labelClassName="text-2xl" />
              ) : (
                <span className="grid size-[84px] place-items-center rounded-full bg-surface text-sm text-ink-3">—</span>
              )}
              <div className="grid gap-1.5">
                <ScoreDelta student={student} size="md" />
                <FlagDetail student={student} />
                <span className="text-xs text-ink-2">{student.interview_count} buổi đã chấm điểm</span>
              </div>
            </div>
          </div>

          {student.star_average && (
            <section className="grid gap-3">
              <h3 className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Tiêu chí STAR (trung bình)</h3>
              <ul className="grid gap-3">
                {STAR_KEYS.map((key) => {
                  const score = student.star_average![key]
                  const level = STAR_LEVEL_STYLE[starLevel(score)]
                  return (
                    <li key={key} className="grid gap-1">
                      <p className="flex justify-between text-sm">
                        <span className="text-ink">{STAR_LABELS[key].label}</span>
                        <span className={cn("font-semibold", level.text)}>{score}%</span>
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${score}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              {detail?.star_insight && <p className="text-xs leading-5 text-violet">{detail.star_insight}</p>}
            </section>
          )}

          <section className="grid gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Hoạt động gần nhất</h3>
            {!detail ? (
              <Skeleton className="h-28 rounded-xl" />
            ) : detail.recent_activity.length === 0 ? (
              <p className="text-sm text-ink-2">Chưa có hoạt động nào được chia sẻ.</p>
            ) : (
              <ul className="grid gap-2">
                {detail.recent_activity.slice(0, 3).map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind]
                  return (
                    <li key={a.id} className="flex gap-3 rounded-xl bg-surface p-3">
                      <Icon className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-sm font-medium text-ink">{a.title}</span>
                        <span className="text-xs text-ink-2">
                          {formatRelativeTime(a.occurred_at)} · {a.description}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="grid gap-2">
        <Button size="brand" nativeButton={false} render={<Link href={profileHref} />}>
          Mở hồ sơ đầy đủ
          <ArrowRight aria-hidden />
        </Button>
        <Button variant="soft" className="h-11" nativeButton={false} render={<a href={`mailto:${student.email}`} />}>
          <Mail aria-hidden />
          Gửi email cho sinh viên
        </Button>
      </div>
    </div>
  )
}
