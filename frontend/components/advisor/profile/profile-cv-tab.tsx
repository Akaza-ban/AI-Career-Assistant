"use client"

import { useState } from "react"
import { Download, FileText, Lock } from "lucide-react"

import { AdvisorCvDialog, downloadAdvisorCv } from "@/components/advisor/profile/advisor-cv-dialog"
import { BlockTitle, dayMonth } from "@/components/advisor/profile/profile-bits"
import { CvProgressBlock } from "@/components/advisor/progress-blocks"
import { MatchBadge } from "@/components/common/match-badge"
import { Zone } from "@/components/common/zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPercent } from "@/lib/analysis"
import { formatBytes } from "@/lib/format"
import type { AdvisorCv, AdvisorGap, AdvisorStudentDetail, JobDescription, JobLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập", fresher: "Fresher", junior: "Junior" }

// Bản vẽ HoSoSinhVien, tab CV. PRD US-ADV-03: mọi phiên bản CV, JD mục tiêu, kết quả phân tích gần nhất.
// Danh sách phiên bản và điểm khớp luôn xem được; nội dung CV và chi tiết kỹ năng chỉ khi SV chia sẻ CV đó.
export function ProfileCvTab({ detail }: { detail: AdvisorStudentDetail }) {
  const studentId = detail.student.id
  const [viewing, setViewing] = useState<AdvisorCv | null>(null)
  const active = detail.cvs.find((cv) => cv.is_active) ?? detail.cvs[0] ?? null
  const others = detail.cvs.filter((cv) => cv !== active)

  const open = (cv: AdvisorCv) => setViewing(cv)
  const download = (cv: AdvisorCv) => void downloadAdvisorCv(studentId, cv)

  return (
    <div className="grid items-start gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Zone id="cv-active" title="CV đang dùng" aside={<span className="text-[13px] text-ink-3">Chỉ đọc</span>}>
        <div className="-mt-3">
          {active ? (
            <CvRow cv={active} primary onView={() => open(active)} onDownload={() => download(active)} />
          ) : (
            <p className="border-b border-line py-4 text-sm text-ink-3">Sinh viên chưa tải lên CV nào.</p>
          )}
          {others.length > 0 && (
            <>
              <BlockTitle className="mt-8 mb-1">Phiên bản khác</BlockTitle>
              <ul>
                {others.map((cv) => (
                  <CvRow key={cv.id} cv={cv} onView={() => open(cv)} onDownload={() => download(cv)} />
                ))}
              </ul>
            </>
          )}
          <BlockTitle className="mt-8 mb-1.5">Độ khớp qua các phiên bản</BlockTitle>
          <CvProgressBlock groups={detail.cv_progress} />
        </div>
      </Zone>

      <Zone id="cv-latest-analysis" title="Phân tích gần nhất">
        <div className="-mt-3">
          <GapBlock gap={detail.latest_gap} hasTarget={detail.target_jd !== null} />
          <BlockTitle className="mt-7 mb-1.5">Vị trí đang nhắm</BlockTitle>
          <TargetJd jd={detail.target_jd} />
        </div>
      </Zone>

      <AdvisorCvDialog studentId={studentId} cv={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function CvRow({
  cv,
  primary = false,
  onView,
  onDownload,
}: {
  cv: AdvisorCv
  primary?: boolean
  onView: () => void
  onDownload: () => void
}) {
  const Row = primary ? "div" : "li"
  const origin =
    cv.origin === "optimized"
      ? " · tạo từ Trình tối ưu"
      : cv.origin === "restored" && cv.restored_from_label
        ? ` · khôi phục từ ${cv.restored_from_label}`
        : ""
  return (
    <Row className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b border-line", primary ? "py-4" : "py-3")}>
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[10px] bg-surface text-ink-2",
          primary ? "size-10" : "size-8",
        )}
        aria-hidden
      >
        <FileText className={primary ? "size-[18px]" : "size-4"} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-[1_1_200px]">
        <p className={cn("truncate text-ink", primary ? "font-semibold" : "text-[15px] font-medium")}>{cv.file_name}</p>
        <p className="text-[13px] text-ink-3 sm:text-sm">
          {cv.label} · cập nhật {dayMonth(cv.uploaded_at)} · {formatBytes(cv.size_bytes)}
          {cv.match_score !== null && ` · khớp ${formatPercent(cv.match_score)}%`}
          {origin}
        </p>
      </div>
      {cv.shared ? (
        <span className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-ink-3 hover:text-ink"
            aria-label={`Tải ${cv.file_name}`}
            onClick={onDownload}
          >
            <Download strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            className="h-8 rounded-full bg-card px-3 text-[13px] font-semibold text-ink ring-1 ring-line-strong ring-inset hover:bg-panel"
            onClick={onView}
          >
            Xem CV
          </Button>
        </span>
      ) : (
        <span className="ml-auto flex items-center gap-1.5 text-[13px] text-ink-3">
          <Lock className="size-3.5" strokeWidth={1.75} aria-hidden />
          Chưa chia sẻ nội dung
        </span>
      )}
    </Row>
  )
}

function GapBlock({ gap, hasTarget }: { gap: AdvisorGap | null; hasTarget: boolean }) {
  if (!gap) {
    return (
      <p className="border-b border-line py-4 text-sm text-ink-3">
        {hasTarget ? "Sinh viên chưa phân tích CV với vị trí này." : "Kết quả sẽ hiện khi sinh viên phân tích CV với một JD."}
      </p>
    )
  }
  return (
    <>
      <div className="border-b border-line py-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="min-w-0 flex-[1_1_180px] font-medium text-ink">
            {gap.jd.title}
            {gap.jd.company && ` · ${gap.jd.company}`}
          </span>
          {gap.match_score !== null && (
            <b className="font-semibold text-ink tabular-nums">{formatPercent(gap.match_score)}%</b>
          )}
          {gap.match_label && <MatchBadge label={gap.match_label} />}
        </div>
        <p className="mt-0.5 text-sm text-ink-3">
          {dayMonth(gap.created_at)} · CV {gap.cv_label}
        </p>
      </div>
      <BlockTitle className="mt-7 mb-1.5">Kỹ năng còn thiếu</BlockTitle>
      {gap.shared ? (
        gap.missing.length + gap.partial.length === 0 ? (
          <p className="pt-1.5 text-sm text-ink-3">CV đã có bằng chứng cho mọi yêu cầu chính.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 pt-1.5" aria-label="Kỹ năng còn thiếu">
            {gap.missing.map((s) => (
              <li key={s}>
                <Badge variant="warn" className="h-[22px] px-2">
                  {s}
                </Badge>
              </li>
            ))}
            {gap.partial.map((s) => (
              <li key={s}>
                <Badge variant="neutral" className="h-[22px] px-2">
                  {s} · một phần
                </Badge>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="flex items-start gap-2 pt-1.5 text-sm text-ink-3">
          <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Sinh viên chưa chia sẻ CV {gap.cv_label}: bạn chỉ xem được điểm khớp, chưa xem được từng kỹ năng.
        </p>
      )}
    </>
  )
}

function TargetJd({ jd }: { jd: JobDescription | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!jd) {
    return <p className="border-b border-line py-3 text-sm text-ink-3">Sinh viên chưa chọn vị trí ứng tuyển.</p>
  }
  const meta =
    [jd.company, jd.industry, jd.level && LEVEL_LABEL[jd.level]].filter(Boolean).join(" · ") ||
    (jd.source === "pasted" ? "JD sinh viên tự dán" : "")
  const required = jd.skills.filter((s) => s.importance === "required").map((s) => s.name)
  return (
    <div className="border-b border-line py-3">
      <p className="text-ink">{jd.title}</p>
      {meta && <p className="text-sm text-ink-3">{meta}</p>}
      {required.length > 0 && <p className="mt-1.5 text-sm text-ink-2">Yêu cầu chính: {required.join(", ")}</p>}
      {jd.content && (
        <>
          {expanded && <p className="mt-2 text-sm leading-6 whitespace-pre-line text-ink-2">{jd.content}</p>}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-1.5 text-sm font-semibold text-blue hover:text-accent-strong"
          >
            {expanded ? "Thu gọn" : "Xem mô tả JD"}
          </button>
        </>
      )}
    </div>
  )
}
