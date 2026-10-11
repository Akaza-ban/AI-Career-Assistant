"use client"

import Link from "next/link"
import { useCallback, useRef, useState, type ReactNode } from "react"
import { AlertCircle, Mail, PenLine, ShieldAlert } from "lucide-react"

import { DeltaBadge, OutOfFive, score1, signed } from "@/components/advisor/profile/profile-bits"
import { ProfileCvTab } from "@/components/advisor/profile/profile-cv-tab"
import { ProfileInterviewTab } from "@/components/advisor/profile/profile-interview-tab"
import { ProfileNotesTab } from "@/components/advisor/profile/profile-notes-tab"
import { FlagDetail, SharingBadge, StudentStatusBadge } from "@/components/advisor/student-status"
import { useChat } from "@/components/chat/chat-context"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { SegmentedControl } from "@/components/common/segmented-control"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPercent } from "@/lib/analysis"
import { api, ApiError } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AdvisorNote, AdvisorReviewInfo, AdvisorStudentDetail } from "@/lib/types"
import { useApi } from "@/lib/use-api"

export type ProfileTab = "cv" | "interviews" | "notes"

// Bản vẽ HoSoSinhVien (WIREFRAMES.md A21). PRD US-ADV-01 AC3 (403), US-ADV-03.
// Số liệu luôn xem được; nội dung theo từng tài liệu SV chia sẻ.
export function StudentProfile({
  studentId,
  initialTab,
  initialReviewId = null,
}: {
  studentId: string
  initialTab: ProfileTab
  /** Mã buổi cần mở dialog nhận xét ngay khi tải (từ `?review=`). */
  initialReviewId?: string | null
}) {
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
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={forbidden ? ShieldAlert : AlertCircle}
          title={forbidden ? "Bạn không có quyền xem hồ sơ này" : "Không tải được hồ sơ sinh viên"}
          description={
            forbidden
              ? "Sinh viên này không thuộc danh sách được phân công cho bạn. Hệ thống không trả về dữ liệu nào của sinh viên."
              : error.message
          }
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="soft" size="brand" nativeButton={false} render={<Link href="/advisor/students" />}>
                Về danh sách sinh viên
              </Button>
              {!forbidden && (
                <Button size="brand" onClick={reload}>
                  Thử lại
                </Button>
              )}
            </div>
          }
        />
      </Panel>
    )
  }
  if (!detail) return <ProfileSkeleton />

  const interviews = detail.interviews.map((i) => (reviewed[i.id] ? { ...i, review: reviewed[i.id] } : i))
  const noteList = notes ?? detail.notes

  return (
    <div>
      <ProfileHeader
        detail={detail}
        onAddNote={() => {
          selectTab("notes")
          requestAnimationFrame(() => noteInput.current?.focus())
        }}
      />

      <ProfileStats detail={detail} />

      <SegmentedControl
        aria-label="Hồ sơ sinh viên"
        value={tab}
        onChange={selectTab}
        options={[
          { value: "interviews", label: "Phỏng vấn" },
          { value: "cv", label: "CV" },
          { value: "notes", label: "Ghi chú", count: noteList.length },
        ]}
        size="lg"
        className="mt-10 w-full sm:w-fit"
      />

      <div role="tabpanel" aria-label={tab === "cv" ? "CV" : tab === "interviews" ? "Phỏng vấn" : "Ghi chú"} className="mt-9">
        {tab === "cv" ? (
          <ProfileCvTab detail={detail} />
        ) : tab === "interviews" ? (
          <ProfileInterviewTab
            detail={detail}
            interviews={interviews}
            initialReviewId={initialReviewId}
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
  const meta = [s.email, s.phone].filter(Boolean).join(" · ")
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pt-8 pb-8 md:pt-12 md:pb-10">
      <div className="flex min-w-0 flex-[1_1_480px] items-start gap-4 md:items-center md:gap-[18px]">
        <UserAvatar
          name={s.full_name}
          src={s.avatar_url}
          className="size-12 md:size-16 [&_[data-slot=avatar-fallback]]:bg-blue-soft [&_[data-slot=avatar-fallback]]:text-base [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-accent-strong"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-heading text-[30px] leading-9 font-semibold tracking-[-0.025em] text-balance text-ink md:text-[40px] md:leading-[46px]">
              {s.full_name}
            </h1>
            <StudentStatusBadge student={s} />
          </div>
          <p className="mt-1.5 text-base leading-[26px] text-ink-2 md:text-[17px]">
            {meta} · {s.target ? `Đang nhắm: ${s.target.title}` : "Chưa chọn vị trí ứng tuyển"}
          </p>
          {s.flag && (
            <p className="mt-1">
              <FlagDetail student={s} />
            </p>
          )}
        </div>
      </div>
      <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
        <Button
          variant="ghost"
          size="brand"
          className="glass flex-1 text-ink shadow-xs hover:bg-white sm:flex-none"
          onClick={onAddNote}
        >
          <PenLine aria-hidden />
          Thêm ghi chú
        </Button>
        <Button size="brand" className="flex-1 sm:flex-none" onClick={() => openChat(s.id)}>
          <Mail aria-hidden />
          Nhắn tin
        </Button>
      </div>
    </header>
  )
}

function Metric({ label, badge, value, sub }: { label: string; badge?: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex min-h-[22px] flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-ink md:text-base">{label}</h3>
        {badge}
      </div>
      <p className="mt-1.5 text-[26px] leading-8 text-ink tabular-nums">{value}</p>
      {sub && <div className="mt-1 text-[13px] leading-5 text-ink-3">{sub}</div>}
    </div>
  )
}

function ProfileStats({ detail }: { detail: AdvisorStudentDetail }) {
  const s = detail.student
  const gap = detail.latest_gap
  const cvDelta = gap ? (detail.cv_progress.find((g) => g.jd.id === gap.jd.id)?.delta ?? null) : null
  const minutes = Math.round(detail.interviews.reduce((sum, i) => sum + i.duration_seconds, 0) / 60)

  return (
    <section
      aria-label="Chỉ số chính"
      className="grid grid-cols-2 gap-x-6 gap-y-7 border-b border-line pt-1 pb-8 lg:grid-cols-4 lg:gap-x-11"
    >
      <Metric
        label="Điểm STAR gần nhất"
        badge={
          s.score_delta !== null && s.score_delta !== 0 && <DeltaBadge value={s.score_delta} text={signed(s.score_delta, score1)} />
        }
        value={s.latest_score !== null ? <OutOfFive score={s.latest_score} /> : "—"}
        sub={
          s.score_delta !== null
            ? `Buổi đầu ${score1(s.first_score!)} ở cùng vị trí`
            : s.latest_score === null
              ? "Chưa có buổi nào"
              : "Mới có 1 buổi ở vị trí này"
        }
      />
      <Metric
        label="Độ khớp CV gần nhất"
        badge={cvDelta !== null && cvDelta !== 0 && <DeltaBadge value={cvDelta} text={signed(cvDelta, formatPercent)} />}
        value={s.latest_match !== null ? `${formatPercent(s.latest_match)}%` : "—"}
        sub={gap ? `CV ${gap.cv_label} · ${gap.jd.title}` : detail.cvs.length > 0 ? "Chưa phân tích CV" : "Chưa tải lên CV"}
      />
      <Metric
        label="Số buổi đã luyện"
        value={s.interview_count}
        sub={s.interview_count > 0 ? `${minutes} phút · ${s.focus_session_count} buổi ở vị trí đang luyện` : "Chưa luyện phỏng vấn"}
      />
      <Metric
        label="Hoạt động cuối"
        value={s.last_active_at ? formatRelativeTime(s.last_active_at) : "—"}
        sub={<SharingBadge student={s} />}
      />
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải hồ sơ">
      <div className="flex items-center gap-[18px] pt-8 pb-8 md:pt-12 md:pb-10">
        <Skeleton className="size-14 shrink-0 rounded-full md:size-16" />
        <div className="grid flex-1 gap-2.5">
          <Skeleton className="h-9 w-72 max-w-full md:h-[46px]" />
          <Skeleton className="h-5 w-[420px] max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 border-b border-line pb-8 lg:grid-cols-4 lg:gap-x-11">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-5 w-36 max-w-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-10 h-12 w-80 max-w-full rounded-full" />
      <div className="mt-9 grid gap-14 lg:grid-cols-[1.3fr_1fr]">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  )
}
