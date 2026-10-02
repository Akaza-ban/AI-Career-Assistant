"use client"

import { useState } from "react"
import { Briefcase, Download, Eye, FileCheck2, FileText, Lock, ScanSearch, Target } from "lucide-react"

import { AdvisorCvDialog, downloadAdvisorCv } from "@/components/advisor/profile/advisor-cv-dialog"
import { CvProgressBlock } from "@/components/advisor/progress-blocks"
import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MATCH_LABEL_META, formatPercent } from "@/lib/analysis"
import { formatBytes, formatDate } from "@/lib/format"
import type { AdvisorCv, AdvisorGap, AdvisorStudentDetail, JobDescription, JobLevel } from "@/lib/types"
import { cn } from "@/lib/utils"

const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập", fresher: "Fresher", junior: "Junior" }

// PRD US-ADV-03: mọi phiên bản CV theo thời gian, JD mục tiêu, kết quả phân tích gần nhất.
// Danh sách phiên bản và điểm khớp luôn xem được; nội dung CV và chi tiết kỹ năng chỉ khi SV chia sẻ CV đó.
export function ProfileCvTab({ detail }: { detail: AdvisorStudentDetail }) {
  const studentId = detail.student.id
  const [viewing, setViewing] = useState<AdvisorCv | null>(null)
  const sharedCount = detail.cvs.filter((cv) => cv.shared).length

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-6">
        <Panel className="grid gap-4">
          <PanelHeader
            icon={FileText}
            title="Các phiên bản CV"
            aside={
              detail.cvs.length > 0 && (
                <span className="text-xs text-ink-2">
                  Đã chia sẻ {sharedCount}/{detail.cvs.length} · Mới nhất trước
                </span>
              )
            }
          />
          {detail.cvs.length === 0 ? (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-2">Sinh viên chưa tải lên CV nào.</p>
          ) : (
            <ol className="grid gap-3">
              {detail.cvs.map((cv) => (
                <li key={cv.id}>
                  <CvCard cv={cv} onView={() => setViewing(cv)} onDownload={() => void downloadAdvisorCv(studentId, cv)} />
                </li>
              ))}
            </ol>
          )}
          <p className="flex items-start gap-2 text-xs text-ink-2">
            <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Chế độ chỉ đọc: mọi chỉnh sửa nội dung CV do sinh viên thực hiện.
          </p>
        </Panel>

        <Panel className="grid gap-4">
          <PanelHeader icon={FileCheck2} title="Độ khớp CV qua các phiên bản" />
          <CvProgressBlock groups={detail.cv_progress} />
        </Panel>
      </div>

      <div className="grid min-w-0 gap-6">
        <TargetJdCard jd={detail.target_jd} />
        {detail.target_jd && <GapCard gap={detail.latest_gap} />}
      </div>

      <AdvisorCvDialog studentId={studentId} cv={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

function CvCard({ cv, onView, onDownload }: { cv: AdvisorCv; onView: () => void; onDownload: () => void }) {
  return (
    <div className={cn("grid gap-3 rounded-2xl p-4", cv.shared ? "border border-blue/15 bg-blue-soft/30" : "bg-surface")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl text-[10px] font-bold uppercase",
            cv.shared ? "bg-card text-blue ring-1 ring-blue/20" : "bg-card text-ink-3",
          )}
          aria-hidden
        >
          {cv.file_type}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate font-heading font-bold text-ink">{cv.file_name}</span>
            {cv.is_active ? <Badge variant="good">CV đang dùng</Badge> : <Badge variant="neutral">Bản {cv.label}</Badge>}
          </p>
          <p className="text-xs text-ink-2">
            Tải lên {formatDate(cv.uploaded_at)} · {formatBytes(cv.size_bytes)}
            {cv.origin === "optimized" && " · Tạo từ Trình tối ưu"}
            {cv.origin === "restored" && cv.restored_from_label && ` · Khôi phục từ ${cv.restored_from_label}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm">
        <span className="text-ink-2">
          Độ khớp JD gần nhất:{" "}
          <strong className="font-heading text-blue">
            {cv.match_score !== null ? `${formatPercent(cv.match_score)}%` : "Chưa phân tích"}
          </strong>
          {cv.target_title && cv.match_score !== null && <span className="text-xs"> ({cv.target_title})</span>}
        </span>
        {cv.shared ? (
          <span className="flex gap-1">
            <Button variant="ghost" className="h-8 px-2.5" onClick={onView}>
              <Eye aria-hidden />
              Xem
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Tải ${cv.file_name}`} onClick={onDownload}>
              <Download aria-hidden />
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-ink-3">
            <Lock className="size-3.5" aria-hidden />
            Chưa chia sẻ nội dung
          </span>
        )}
      </div>
    </div>
  )
}

function TargetJdCard({ jd }: { jd: JobDescription | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!jd) {
    return (
      <Panel className="grid gap-3">
        <PanelHeader icon={Target} title="Vị trí đang nhắm tới" />
        <p role="status" className="rounded-xl bg-warn-soft/60 p-4 text-sm text-ink">
          <strong>Sinh viên chưa chọn vị trí ứng tuyển.</strong> Kết quả phân tích sẽ hiển thị khi sinh viên phân tích CV với
          một JD hoặc luyện phỏng vấn.
        </p>
      </Panel>
    )
  }
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={Target} title="Vị trí đang nhắm tới" />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-soft text-violet">
          <Briefcase className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <p className="font-heading font-bold text-ink">{jd.title}</p>
          <p className="text-sm text-ink-2">
            {[jd.company, jd.industry, jd.level && LEVEL_LABEL[jd.level]].filter(Boolean).join(" · ") ||
              (jd.source === "pasted" ? "JD sinh viên tự dán" : "")}
          </p>
        </div>
      </div>
      {jd.skills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Kỹ năng yêu cầu">
          {jd.skills.map((s) => (
            <li
              key={s.name}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium",
                s.importance === "required" ? "bg-blue-soft text-blue" : "bg-surface text-ink",
              )}
            >
              {s.name}
            </li>
          ))}
        </ul>
      )}
      {jd.content && (
        <div className="grid gap-2">
          <p className={cn("text-sm leading-6 whitespace-pre-line text-ink-2", !expanded && "line-clamp-5")}>{jd.content}</p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="justify-self-start text-sm font-medium text-blue hover:underline"
          >
            {expanded ? "Thu gọn" : "Xem toàn bộ JD"}
          </button>
        </div>
      )}
    </Panel>
  )
}

const GAP_GROUPS: { key: "missing" | "partial" | "matched"; label: string; hint: string; className: string }[] = [
  { key: "missing", label: "Chưa có", hint: "CV chưa có bằng chứng cho yêu cầu này.", className: "bg-bad-soft text-bad" },
  { key: "partial", label: "Có một phần", hint: "Có liên quan nhưng chưa đủ rõ hoặc chưa đủ mức yêu cầu.", className: "bg-warn-soft text-warn" },
  { key: "matched", label: "Đạt yêu cầu", hint: "", className: "bg-good-soft text-good" },
]

function GapCard({ gap }: { gap: AdvisorGap | null }) {
  return (
    <Panel className="grid gap-4">
      <PanelHeader
        icon={ScanSearch}
        title="Kết quả phân tích gần nhất"
        aside={gap && <span className="text-xs text-ink-2">{formatDate(gap.created_at)}</span>}
      />
      {!gap ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-ink-2">Sinh viên chưa phân tích CV với vị trí này.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
            {gap.match_score !== null && <ScoreRing score={Math.round(gap.match_score)} size={64} strokeWidth={6} labelClassName="text-lg" />}
            <div className="grid gap-1 text-sm">
              <p className="font-medium text-ink">
                CV {gap.cv_label} · {gap.jd.title}
                {gap.match_label && (
                  <Badge variant={MATCH_LABEL_META[gap.match_label].badge} className="ml-2">
                    Độ khớp {MATCH_LABEL_META[gap.match_label].text.toLowerCase()}
                  </Badge>
                )}
              </p>
              {gap.shared && (
                <p className="text-ink-2">
                  {gap.missing.length > 0
                    ? `Còn ${gap.missing.length} yêu cầu chưa có bằng chứng trong CV.`
                    : "CV đã có bằng chứng cho mọi yêu cầu chính."}
                </p>
              )}
            </div>
          </div>
          {gap.shared ? (
            <ul className="grid gap-4">
              {GAP_GROUPS.map((g) => {
                const items = gap[g.key]
                if (items.length === 0) return null
                return (
                  <li key={g.key} className="grid gap-1.5">
                    <p className="text-sm font-semibold text-ink">
                      {g.label} <span className="font-normal text-ink-2">({items.length})</span>
                    </p>
                    {g.hint && <p className="text-xs text-ink-2">{g.hint}</p>}
                    <ul className="flex flex-wrap gap-1.5">
                      {items.map((s) => (
                        <li key={s} className={cn("rounded-lg px-2 py-0.5 text-xs font-medium", g.className)}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-sm text-ink-2">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Sinh viên chưa chia sẻ CV {gap.cv_label} nên bạn chỉ xem được điểm khớp, chưa xem được chi tiết từng kỹ năng.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}
