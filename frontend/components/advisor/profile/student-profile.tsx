"use client"

import Link from "next/link"
import { useCallback, useRef, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  History,
  IdCard,
  Lock,
  Mail,
  MessagesSquare,
  NotebookPen,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"

import { ProfileCvTab } from "@/components/advisor/profile/profile-cv-tab"
import { ProfileInterviewTab } from "@/components/advisor/profile/profile-interview-tab"
import { ProfileNotesTab } from "@/components/advisor/profile/profile-notes-tab"
import { FlagDetail, StudentStatusBadge } from "@/components/advisor/student-status"
import { Panel } from "@/components/common/panel"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AdvisorInterviewItem, AdvisorNote, AdvisorStudentDetail } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export type ProfileTab = "cv" | "interviews" | "notes"

// Figma: frame "Hồ sơ sinh viên - Phỏng vấn & STAR" (18:6025) và "Hồ sơ sinh viên - Ghi chú & CV" (18:6676).
// PRD US-ADV-01 AC3 (403), US-ADV-03.
export function StudentProfile({ studentId, initialTab }: { studentId: string; initialTab: ProfileTab }) {
  const fetchDetail = useCallback(() => api.getAdvisorStudent(studentId), [studentId])
  const { data: detail, error, reload } = useApi(fetchDetail)
  const [tab, setTab] = useState<ProfileTab>(initialTab)
  // Thay đổi cục bộ sau khi nhận xét / sửa ghi chú; null = dùng dữ liệu vừa tải.
  const [reviewed, setReviewed] = useState<Record<string, AdvisorInterviewItem>>({})
  const [notes, setNotes] = useState<AdvisorNote[] | null>(null)
  const noteInput = useRef<HTMLTextAreaElement>(null)

  function selectTab(next: ProfileTab) {
    setTab(next)
    history.replaceState(null, "", `?tab=${next}`)
  }

  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403
    return (
      <Panel className="grid justify-items-center gap-3 py-14 text-center">
        {forbidden ? <ShieldAlert className="size-9 text-bad" aria-hidden /> : <AlertCircle className="size-8 text-bad" aria-hidden />}
        <p className="font-heading text-lg font-bold">{forbidden ? "Bạn không có quyền xem hồ sơ này" : "Không tải được hồ sơ sinh viên"}</p>
        <p className="max-w-md text-sm text-ink-2">
          {forbidden
            ? "Sinh viên này không thuộc danh sách được phân công cho bạn. Hệ thống không trả về bất kỳ dữ liệu nào của sinh viên."
            : error.message}
        </p>
        <div className="flex gap-2">
          <Button variant="soft" nativeButton={false} render={<Link href="/advisor/students" />}>
            Về danh sách sinh viên
          </Button>
          {!forbidden && <Button onClick={reload}>Thử lại</Button>}
        </div>
      </Panel>
    )
  }
  if (!detail) return <ProfileSkeleton />

  const interviews = detail.interviews.map((i) => reviewed[i.id] ?? i)
  const pending = interviews.filter((i) => i.shared && !i.review).length
  const noteList = notes ?? detail.notes
  const hidden = detail.student.shared_items === 0

  const tabs: { value: ProfileTab; label: string; icon: LucideIcon; count?: number; badge?: number }[] = [
    { value: "cv", label: "CV & JD mục tiêu", icon: FileText, count: detail.cvs.length },
    { value: "interviews", label: "Phỏng vấn & STAR", icon: MessagesSquare, count: interviews.length, badge: pending },
    { value: "notes", label: "Ghi chú nội bộ", icon: NotebookPen, count: noteList.length },
  ]

  return (
    <div className="grid gap-6">
      <Link href="/advisor/students" className="flex w-fit items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-blue">
        <ArrowLeft className="size-4" aria-hidden />
        Quay lại danh sách sinh viên
      </Link>

      <ProfileHeader
        detail={detail}
        onAddNote={() => {
          selectTab("notes")
          requestAnimationFrame(() => noteInput.current?.focus())
        }}
      />

      <ProfileStats detail={detail} interviewCount={interviews.length} />

      <div role="tablist" aria-label="Hồ sơ sinh viên" className="flex flex-wrap gap-1 rounded-2xl bg-card p-1.5 shadow-card ring-1 ring-line">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.value
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              id={`tab-${t.value}`}
              aria-selected={active}
              aria-controls={`panel-${t.value}`}
              onClick={() => selectTab(t.value)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-blue-soft text-blue" : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t.label}
              {t.count !== undefined && <span className="text-xs text-ink-3">({t.count})</span>}
              {!!t.badge && (
                <span className="rounded-full bg-blue px-1.5 text-[11px] font-bold text-on-blue" aria-label={`${t.badge} chờ nhận xét`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {hidden && tab !== "notes" ? (
          <Panel className="grid justify-items-center gap-3 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-surface text-ink-3">
              <Lock className="size-6" aria-hidden />
            </span>
            <p className="font-heading text-lg font-bold">Sinh viên chưa chia sẻ dữ liệu</p>
            <p className="max-w-md text-sm text-ink-2">
              Bạn chỉ xem được CV và báo cáo phỏng vấn khi sinh viên bật chia sẻ. Ghi chú nội bộ của bạn vẫn dùng được bình thường.
            </p>
            <Button variant="soft" nativeButton={false} render={<a href={`mailto:${detail.student.email}`} />}>
              <Mail aria-hidden />
              Gửi email mời sinh viên chia sẻ
            </Button>
          </Panel>
        ) : tab === "cv" ? (
          <ProfileCvTab detail={detail} />
        ) : tab === "interviews" ? (
          <ProfileInterviewTab
            detail={detail}
            interviews={interviews}
            onReviewed={(item) => setReviewed((r) => ({ ...r, [item.id]: item }))}
          />
        ) : (
          <ProfileNotesTab
            inputRef={noteInput}
            studentId={detail.student.id}
            studentName={detail.student.full_name}
            notes={noteList}
            suggestions={detail.session_suggestions}
            onNotesChange={setNotes}
          />
        )}
      </div>
    </div>
  )
}

function ProfileHeader({ detail, onAddNote }: { detail: AdvisorStudentDetail; onAddNote: () => void }) {
  const s = detail.student
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-5">
        <UserAvatar name={s.full_name} src={s.avatar_url} className="size-20 [&_[data-slot=avatar-fallback]]:text-2xl" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="flex flex-wrap items-center gap-3 font-heading text-[26px] leading-8 font-bold">
            {s.full_name}
            <StudentStatusBadge student={s} className="text-sm" />
          </h1>
          <FlagDetail student={s} />
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="flex items-center gap-1.5">
              <IdCard className="size-4" aria-hidden />
              MSSV: <strong className="text-ink">{s.student_code}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="size-4" aria-hidden />
              {s.major} · Khoá {s.cohort}
            </span>
            <Badge variant={s.shared_items > 0 ? "violet" : "neutral"} className="h-auto px-2 py-0.5">
              <Lock aria-hidden />
              Đã chia sẻ {s.shared_items}/{s.total_items} mục dữ liệu
            </Badge>
          </p>
          <p className="flex items-center gap-1.5 text-sm">
            <Briefcase className="size-4 text-blue" aria-hidden />
            {s.target_title ? (
              <span className="font-medium text-blue">
                Mục tiêu: {s.target_title}
                {s.target_company && ` (${s.target_company})`}
              </span>
            ) : (
              <span className="text-ink-2">Chưa chọn vị trí ứng tuyển</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" className="h-11 px-4" nativeButton={false} render={<a href={`mailto:${s.email}`} />}>
          <Mail aria-hidden />
          Gửi email
        </Button>
        <Button className="h-11 px-4" onClick={onAddNote}>
          <NotebookPen aria-hidden />
          Thêm ghi chú riêng
        </Button>
      </div>
    </Panel>
  )
}

function Stat({ label, icon: Icon, iconClass, children }: { label: string; icon: LucideIcon; iconClass: string; children: ReactNode }) {
  return (
    <Panel className="flex items-start justify-between gap-3 p-5">
      <div className="grid min-w-0 gap-1.5">
        <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">{label}</p>
        {children}
      </div>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", iconClass)}>
        <Icon className="size-5" aria-hidden />
      </span>
    </Panel>
  )
}

function ProfileStats({ detail, interviewCount }: { detail: AdvisorStudentDetail; interviewCount: number }) {
  const s = detail.student
  const lastActivity = detail.recent_activity[0]
  const minutes = detail.interviews.reduce((sum, i) => sum + i.duration_seconds, 0) / 60
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Điểm gần nhất" icon={Award} iconClass="bg-blue-soft text-blue">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold">{s.latest_score ?? "—"}</span>
          <span className="text-sm text-ink-2">/100</span>
        </p>
        <p className="text-xs">
          {s.score_delta !== null ? (
            <span className={cn("font-semibold", s.score_delta >= 0 ? "text-good" : "text-bad")}>
              {s.score_delta >= 0 ? "+" : ""}
              {s.score_delta} so với vòng đầu ({s.first_score})
            </span>
          ) : (
            <span className="text-ink-2">Chưa đủ dữ liệu để so sánh</span>
          )}
        </p>
      </Stat>
      <Stat label="Số buổi đã luyện" icon={MessagesSquare} iconClass="bg-violet-soft text-violet">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold">{interviewCount}</span>
          <span className="text-sm text-ink-2">buổi</span>
        </p>
        {minutes > 0 && <p className="text-xs text-ink-2">Tổng {Math.round(minutes)} phút thực hành</p>}
      </Stat>
      <Stat label="ATS CV mới nhất" icon={FileText} iconClass="bg-blue-soft text-blue">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold text-blue">{s.latest_ats ?? "—"}</span>
          <span className="text-sm text-ink-2">/100</span>
        </p>
        <p className="text-xs text-ink-2">
          {detail.latest_gap ? `Khớp ${detail.latest_gap.match_score}% với JD mục tiêu` : "Chưa có phân tích được chia sẻ"}
        </p>
      </Stat>
      <Stat label="Hoạt động cuối" icon={History} iconClass="bg-surface text-ink-2">
        <p className="font-heading text-xl font-bold">{s.last_active_at ? formatRelativeTime(s.last_active_at) : "—"}</p>
        {lastActivity && <p className="line-clamp-2 text-xs text-ink-2">{lastActivity.title}</p>}
      </Stat>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải hồ sơ">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-36 rounded-[20px]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-2xl" />
      <Skeleton className="h-96 rounded-[20px]" />
    </div>
  )
}
