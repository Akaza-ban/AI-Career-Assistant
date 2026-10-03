"use client"

import Link from "next/link"
import { useCallback, useRef, useState, type ReactNode } from "react"
import {
  AlertCircle,
  Award,
  Briefcase,
  FileText,
  GraduationCap,
  History,
  IdCard,
  Mail,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"

import { ProfileCvTab } from "@/components/advisor/profile/profile-cv-tab"
import { ProfileInterviewTab } from "@/components/advisor/profile/profile-interview-tab"
import { ProfileNotesTab } from "@/components/advisor/profile/profile-notes-tab"
import { FlagDetail, SharingBadge, StudentStatusBadge } from "@/components/advisor/student-status"
import { useChat } from "@/components/chat/chat-context"
import { Panel } from "@/components/common/panel"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPercent } from "@/lib/analysis"
import { api, ApiError } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AdvisorNote, AdvisorReviewInfo, AdvisorStudentDetail } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

export type ProfileTab = "cv" | "interviews" | "notes"

// Figma: frame "Hồ sơ sinh viên - Phỏng vấn & STAR" (18:6025) và "Hồ sơ sinh viên - Ghi chú & CV" (18:6676).
// PRD US-ADV-01 AC3 (403), US-ADV-03. Số liệu luôn xem được; nội dung theo từng tài liệu SV chia sẻ.
export function StudentProfile({ studentId, initialTab }: { studentId: string; initialTab: ProfileTab }) {
  const fetchDetail = useCallback(() => api.getAdvisorStudent(studentId), [studentId])
  const { data: detail, error, reload } = useApi(fetchDetail)
  const [tab, setTab] = useState<ProfileTab>(initialTab)
  // Thay đổi cục bộ sau khi nhận xét / sửa ghi chú; null = dùng dữ liệu vừa tải.
  const [reviewed, setReviewed] = useState<Record<string, AdvisorReviewInfo>>({})
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

  const interviews = detail.interviews.map((i) => (reviewed[i.id] ? { ...i, review: reviewed[i.id] } : i))
  const pending = interviews.filter((i) => i.shared && !i.review).length
  const noteList = notes ?? detail.notes

  const tabs: { value: ProfileTab; label: string; icon: LucideIcon; count?: number; badge?: number }[] = [
    { value: "cv", label: "CV & JD mục tiêu", icon: FileText, count: detail.cvs.length },
    { value: "interviews", label: "Phỏng vấn & STAR", icon: MessagesSquare, count: interviews.length, badge: pending },
    { value: "notes", label: "Ghi chú nội bộ", icon: NotebookPen, count: noteList.length },
  ]

  return (
    <div className="grid gap-8">
      <ProfileHeader
        detail={detail}
        onAddNote={() => {
          selectTab("notes")
          requestAnimationFrame(() => noteInput.current?.focus())
        }}
      />

      <ProfileStats detail={detail} pending={pending} />

      <div role="tablist" aria-label="Hồ sơ sinh viên" className="-mb-2 flex gap-x-6 overflow-x-auto border-b border-line">
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
                "flex shrink-0 items-center gap-2 border-b-2 px-1 pt-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "border-blue text-blue" : "border-transparent text-ink-2 hover:border-line hover:text-ink",
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
        {tab === "cv" ? (
          <ProfileCvTab detail={detail} />
        ) : tab === "interviews" ? (
          <ProfileInterviewTab
            detail={detail}
            interviews={interviews}
            onReviewed={(sessionId, review) => setReviewed((r) => ({ ...r, [sessionId]: review }))}
          />
        ) : (
          <ProfileNotesTab
            inputRef={noteInput}
            studentId={detail.student.id}
            studentName={detail.student.full_name}
            notes={noteList}
            suggestions={detail.suggestions}
            onNotesChange={setNotes}
          />
        )}
      </div>
    </div>
  )
}

function ProfileHeader({ detail, onAddNote }: { detail: AdvisorStudentDetail; onAddNote: () => void }) {
  const s = detail.student
  const { openChat } = useChat()
  return (
    <header className="flex flex-wrap items-center justify-between gap-5 py-2">
      <div className="flex min-w-0 items-center gap-5">
        <UserAvatar name={s.full_name} src={s.avatar_url} className="size-20 [&_[data-slot=avatar-fallback]]:text-2xl" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="flex flex-wrap items-center gap-3 font-heading text-[32px] leading-10 font-bold">
            {s.full_name}
            <StudentStatusBadge student={s} className="text-sm" />
          </h1>
          <FlagDetail student={s} />
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            {s.student_code && (
              <span className="flex items-center gap-1.5">
                <IdCard className="size-4" aria-hidden />
                MSSV: <strong className="text-ink">{s.student_code}</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <GraduationCap className="size-4" aria-hidden />
              {s.major && s.cohort ? `${s.major} · Khoá ${s.cohort}` : s.subtitle}
            </span>
            <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-blue">
              <Mail className="size-4" aria-hidden />
              {s.email}
            </a>
            <SharingBadge student={s} />
          </p>
          <p className="flex items-center gap-1.5 text-sm">
            <Briefcase className="size-4 text-blue" aria-hidden />
            {s.target ? (
              <span className="font-medium text-blue">
                Đang luyện: {s.target.title}
                {s.target.company && ` (${s.target.company})`}
              </span>
            ) : (
              <span className="text-ink-2">Chưa chọn vị trí ứng tuyển</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" className="h-11 px-4" onClick={() => openChat(s.id)}>
          <MessageCircle aria-hidden />
          Nhắn tin
        </Button>
        <Button className="h-11 px-4" onClick={onAddNote}>
          <NotebookPen aria-hidden />
          Thêm ghi chú riêng
        </Button>
      </div>
    </header>
  )
}

function Stat({ label, icon: Icon, iconClass, children }: { label: string; icon: LucideIcon; iconClass: string; children: ReactNode }) {
  return (
    <Panel className="flex items-start justify-between gap-3 p-4">
      <div className="grid min-w-0 gap-1.5">
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {children}
      </div>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", iconClass)}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
    </Panel>
  )
}

function ProfileStats({ detail, pending }: { detail: AdvisorStudentDetail; pending: number }) {
  const s = detail.student
  const minutes = detail.interviews.reduce((sum, i) => sum + i.duration_seconds, 0) / 60
  const latestCv = detail.cvs[0]
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Điểm STAR gần nhất" icon={Award} iconClass="bg-blue-soft text-blue">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold">
            {s.latest_score !== null ? formatScore(s.latest_score) : "—"}
          </span>
          <span className="text-sm text-ink-2">/5</span>
        </p>
        <p className="text-xs">
          {s.score_delta !== null ? (
            <span
              className={cn(
                "font-semibold",
                s.trend === "improving" ? "text-good" : s.trend === "declining" ? "text-bad" : "text-ink-2",
              )}
            >
              {s.score_delta > 0 ? "+" : ""}
              {formatScore(s.score_delta)} so với buổi đầu ({formatScore(s.first_score!)})
            </span>
          ) : (
            <span className="text-ink-2">Chưa đủ dữ liệu để so sánh</span>
          )}
        </p>
      </Stat>
      <Stat label="Số buổi đã luyện" icon={MessagesSquare} iconClass="bg-violet-soft text-violet">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold">{s.interview_count}</span>
          <span className="text-sm text-ink-2">buổi</span>
        </p>
        <p className="text-xs text-ink-2">
          {s.interview_count > 0
            ? `${s.focus_session_count} buổi ở vị trí đang luyện · ${Math.round(minutes)} phút`
            : "Chưa luyện phỏng vấn"}
        </p>
      </Stat>
      <Stat label="Độ khớp CV gần nhất" icon={FileText} iconClass="bg-blue-soft text-blue">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-[32px] leading-9 font-bold text-blue">
            {s.latest_match !== null ? formatPercent(s.latest_match) : "—"}
          </span>
          <span className="text-sm text-ink-2">%</span>
        </p>
        <p className="line-clamp-2 text-xs text-ink-2">
          {detail.latest_gap
            ? `CV ${detail.latest_gap.cv_label} · ${detail.latest_gap.jd.title}`
            : latestCv
              ? "Chưa phân tích CV với JD nào"
              : "Chưa tải lên CV"}
        </p>
      </Stat>
      <Stat label="Hoạt động cuối" icon={History} iconClass="bg-surface text-ink-2">
        <p className="font-heading text-xl font-bold">{s.last_active_at ? formatRelativeTime(s.last_active_at) : "—"}</p>
        <p className="text-xs text-ink-2">
          {pending > 0 ? `${pending} báo cáo chờ bạn nhận xét` : "Không có báo cáo chờ nhận xét"}
        </p>
      </Stat>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Đang tải hồ sơ">
      <div className="flex items-center gap-5 py-2">
        <Skeleton className="size-20 rounded-full" />
        <div className="grid flex-1 gap-2.5">
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-5 w-[480px] max-w-full" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-10 w-96 max-w-full" />
      <Skeleton className="h-96 rounded-[20px]" />
    </div>
  )
}
