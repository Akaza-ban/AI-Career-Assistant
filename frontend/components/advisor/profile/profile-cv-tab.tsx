"use client"

import { useState } from "react"
import { BadgeCheck, Briefcase, Download, Eye, FileText, History, Lock, ScanSearch, Target } from "lucide-react"
import { toast } from "sonner"

import { Panel, PanelHeader } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { CvComparisonCard } from "@/components/student/history/history-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { formatBytes, formatDate } from "@/lib/format"
import type { AdvisorGapSummary, AdvisorStudentDetail, CvVersion, JobDescription } from "@/lib/types"
import { cn } from "@/lib/utils"

const LEVEL_LABEL: Record<JobDescription["level"], string> = { intern: "Thực tập", fresher: "Fresher", junior: "Junior" }

function downloadCv(cv: CvVersion) {
  const url = api.cvDownloadUrl(cv.id)
  if (url) window.open(url, "_blank", "noopener")
  else toast.info(`Bản demo chưa có file thật để tải: ${cv.file_name}`)
}

// PRD US-ADV-03: CV mới nhất + các phiên bản trước theo thời gian, JD mục tiêu, kết quả phân loại khoảng cách gần nhất.
export function ProfileCvTab({ detail }: { detail: AdvisorStudentDetail }) {
  const [latest, ...older] = detail.cvs
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-6">
        <Panel className="grid gap-4">
          <PanelHeader
            icon={FileText}
            title="CV mới nhất"
            aside={
              <Badge variant="blue" className="h-auto px-2 py-0.5">
                Chế độ xem của cố vấn
              </Badge>
            }
          />
          <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-xs text-ink-2">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            Bạn đang xem ở chế độ chỉ đọc. Mọi chỉnh sửa nội dung CV do sinh viên thực hiện.
          </p>
          {latest ? (
            <CvCard cv={latest} gap={detail.latest_gap} highlight />
          ) : (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-ink-2">
              Sinh viên chưa chia sẻ phiên bản CV nào với bạn.
            </p>
          )}
        </Panel>

        <Panel className="grid gap-4">
          <PanelHeader
            icon={History}
            title="Các phiên bản trước"
            aside={<span className="text-xs text-ink-2">Mới nhất trước</span>}
          />
          {older.length === 0 ? (
            <p className="text-sm text-ink-2">Không có phiên bản trước nào được chia sẻ.</p>
          ) : (
            <ol className="grid gap-3">
              {older.map((cv) => (
                <li key={cv.id}>
                  <CvCard cv={cv} gap={null} />
                </li>
              ))}
            </ol>
          )}
          {detail.hidden_cv_count > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <Lock className="size-3.5" aria-hidden />
              {detail.hidden_cv_count} phiên bản CV khác sinh viên chưa chia sẻ.
            </p>
          )}
        </Panel>

        {detail.cv_comparison && <CvComparisonCard comparison={{ ...detail.cv_comparison, analysis_id: null }} />}
      </div>

      <div className="grid min-w-0 gap-6">
        <TargetJdCard jd={detail.target_jd} />
        {detail.target_jd && <GapSummaryCard gap={detail.latest_gap} />}
      </div>
    </div>
  )
}

function CvCard({ cv, gap, highlight = false }: { cv: CvVersion; gap: AdvisorGapSummary | null; highlight?: boolean }) {
  return (
    <div className={cn("grid gap-3 rounded-2xl p-4", highlight ? "border border-blue/15 bg-blue-soft/30" : "bg-surface")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl text-[10px] font-bold uppercase",
            highlight ? "bg-bad text-white" : "bg-card text-ink-2",
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
            Cập nhật {formatDate(cv.uploaded_at)} · {formatBytes(cv.size_bytes)}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Tải ${cv.file_name}`} onClick={() => downloadCv(cv)}>
          <Download aria-hidden />
        </Button>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-card px-3 py-2 text-sm">
        <span className="text-ink-2">
          Điểm ATS: <strong className="font-heading text-blue">{cv.ats_score !== null ? `${cv.ats_score}/100` : "Chưa phân tích"}</strong>
        </span>
        {gap && (
          <span className="flex items-center gap-1 font-medium text-good">
            <BadgeCheck className="size-4" aria-hidden />
            Khớp {gap.match_score}% với JD mục tiêu
          </span>
        )}
      </p>
    </div>
  )
}

function TargetJdCard({ jd }: { jd: JobDescription | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!jd) {
    return (
      <Panel className="grid gap-3">
        <PanelHeader icon={Target} title="JD mục tiêu" />
        <p role="status" className="rounded-xl bg-warn-soft/60 p-4 text-sm text-ink">
          <strong>Sinh viên chưa chọn vị trí ứng tuyển.</strong> Kết quả phân tích khoảng cách sẽ hiển thị khi sinh viên chọn
          một JD mục tiêu.
        </p>
      </Panel>
    )
  }
  return (
    <Panel className="grid gap-4">
      <PanelHeader icon={Target} title="JD mục tiêu" />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-soft text-violet">
          <Briefcase className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <p className="font-heading font-bold text-ink">{jd.title}</p>
          <p className="text-sm text-ink-2">
            {[jd.company, jd.industry, LEVEL_LABEL[jd.level]].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {jd.skills.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Kỹ năng yêu cầu">
          {jd.skills.map((s) => (
            <li key={s} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink">
              {s}
            </li>
          ))}
        </ul>
      )}
      {jd.content && (
        <div className="grid gap-2">
          <p className={cn("text-sm leading-6 whitespace-pre-line text-ink-2", !expanded && "line-clamp-5")}>{jd.content}</p>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="justify-self-start text-sm font-medium text-blue hover:underline">
            {expanded ? "Thu gọn" : "Xem toàn bộ JD"}
          </button>
        </div>
      )}
    </Panel>
  )
}

const GAP_GROUPS: { key: keyof Pick<AdvisorGapSummary, "matched" | "presentation_gaps" | "capability_gaps" | "unclear">; label: string; hint: string; className: string }[] = [
  { key: "capability_gaps", label: "Khoảng cách năng lực", hint: "CV chưa có kinh nghiệm tương ứng; cần học thêm, không sửa bằng câu chữ.", className: "bg-bad-soft text-bad" },
  { key: "presentation_gaps", label: "Khoảng cách trình bày", hint: "Đã có kinh nghiệm nhưng trình bày chưa rõ.", className: "bg-warn-soft text-warn" },
  { key: "unclear", label: "Cần sinh viên xem xét thủ công", hint: "Hệ thống chưa đủ tin cậy để phân loại.", className: "bg-surface text-ink-2" },
  { key: "matched", label: "Đạt yêu cầu", hint: "", className: "bg-good-soft text-good" },
]

function GapSummaryCard({ gap }: { gap: AdvisorGapSummary | null }) {
  return (
    <Panel className="grid gap-4">
      <PanelHeader
        icon={ScanSearch}
        title="Kết quả phân tích gần nhất"
        aside={gap && <span className="text-xs text-ink-2">{formatDate(gap.created_at)}</span>}
      />
      {!gap ? (
        <p className="rounded-xl bg-surface p-4 text-sm text-ink-2">Chưa có kết quả phân tích nào được chia sẻ cho JD này.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
            <ScoreRing score={gap.match_score} size={64} strokeWidth={6} labelClassName="text-lg" />
            <p className="text-sm text-ink-2">
              Độ khớp CV với JD mục tiêu. {gap.capability_gaps.length > 0
                ? `Có ${gap.capability_gaps.length} khoảng cách năng lực cần trao đổi với sinh viên.`
                : "Không phát hiện khoảng cách năng lực."}
            </p>
          </div>
          <ul className="grid gap-4">
            {GAP_GROUPS.map((g) => {
              const items = gap[g.key]
              if (items.length === 0 && g.key !== "capability_gaps") return null
              return (
                <li key={g.key} className="grid gap-1.5">
                  <p className="text-sm font-semibold text-ink">
                    {g.label} <span className="font-normal text-ink-2">({items.length})</span>
                  </p>
                  {g.hint && <p className="text-xs text-ink-2">{g.hint}</p>}
                  {items.length === 0 ? (
                    <p className="text-xs text-good">Không phát hiện khoảng cách năng lực.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {items.map((s) => (
                        <li key={s} className={cn("rounded-lg px-2 py-0.5 text-xs font-medium", g.className)}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}
