"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, CircleCheck, CircleHelp, Quote, SearchX, Sparkles, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { GapAnalysis, SkillAssessment, SkillStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

// B4: bảng đối chiếu kỹ năng JD ↔ CV kèm bằng chứng (Figma: "Bảng phân tích đối chiếu kỹ năng & Dẫn chứng").

const STATUS: Record<
  SkillStatus,
  { label: string; badge: "good" | "warn" | "bad" | "neutral"; icon: typeof CircleCheck }
> = {
  matched: { label: "Đạt yêu cầu", badge: "good", icon: CircleCheck },
  weak: { label: "Mức độ yếu", badge: "warn", icon: AlertTriangle },
  missing: { label: "Thiếu trong CV", badge: "bad", icon: X },
  unclear: { label: "Cần xem xét", badge: "neutral", icon: CircleHelp },
}

type Filter = "all" | "needs" | "capability"

/** Số dòng hiển thị trước khi bấm "Xem toàn bộ". */
const INITIAL_ROWS = 5

/** Thứ tự ưu tiên: mục cần hành động lên trước. */
export function orderedSkills(analysis: GapAnalysis): SkillAssessment[] {
  return [...analysis.weak_skills, ...analysis.missing_skills, ...analysis.unclear_skills, ...analysis.matched_skills]
}

export function MatchingScoreTable({ analysis }: { analysis: GapAnalysis }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const all = useMemo(() => orderedSkills(analysis), [analysis])
  const needs = all.filter((s) => s.status !== "matched")
  const capability = analysis.missing_skills

  const rows = filter === "all" ? all : filter === "needs" ? needs : capability
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS)
  const hidden = rows.length - visible.length

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "Tất cả kỹ năng", count: all.length },
    { value: "needs", label: "Cần bổ sung", count: needs.length },
    { value: "capability", label: "Khoảng cách năng lực", count: capability.length },
  ]

  function toggle(skill: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(skill)) next.delete(skill)
      else next.add(skill)
      return next
    })
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-line bg-card shadow-card" aria-labelledby="skill-table-title">
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-4">
        <div className="grid gap-1">
          <h2 id="skill-table-title" className="font-heading text-lg font-bold">
            Bảng phân tích đối chiếu kỹ năng & Dẫn chứng
          </h2>
          <p className="text-sm text-ink-2">Chi tiết vị trí đoạn văn, từ khoá JD yêu cầu và phương án hoàn thiện cụ thể.</p>
        </div>
        <div role="tablist" aria-label="Lọc kỹ năng" className="flex gap-1 rounded-xl bg-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={filter === t.value}
              onClick={() => {
                setFilter(t.value)
                setShowAll(false)
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                filter === t.value ? "bg-card text-ink shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 border-t border-line px-6 py-10 text-center">
          <CircleCheck className="size-7 text-good" aria-hidden />
          <p className="font-medium text-ink">
            {filter === "capability" ? "Không phát hiện khoảng cách năng lực" : "Không có kỹ năng nào cần bổ sung"}
          </p>
          <p className="text-sm text-ink-2">CV của bạn đã có bằng chứng cho các yêu cầu trong nhóm này.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-t border-line text-left text-sm">
            <thead className="bg-surface text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">
              <tr>
                <th scope="col" className="w-[22%] px-6 py-3">
                  Kỹ năng & yêu cầu JD
                </th>
                <th scope="col" className="w-[14%] px-3 py-3">
                  Đánh giá CV
                </th>
                <th scope="col" className="w-[32%] px-3 py-3">
                  Bằng chứng trích xuất từ CV
                </th>
                <th scope="col" className="px-3 py-3 pr-6">
                  Đề xuất hoàn thiện của AI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((row) => (
                <SkillRow key={row.skill} row={row} expanded={expanded.has(row.skill)} onToggle={() => toggle(row.skill)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-6 py-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          Hiển thị {visible.length}/{rows.length} kỹ năng
          <span aria-hidden>•</span>
          <span className="flex items-center gap-1 text-good">
            <Sparkles className="size-3.5" aria-hidden />
            Mỗi đánh giá kèm dẫn chứng trích từ CV
          </span>
        </span>
        {hidden > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowAll(true)}>
            Xem toàn bộ {hidden} kỹ năng còn lại
            <ChevronDown aria-hidden />
          </Button>
        )}
      </div>
    </section>
  )
}

function SkillRow({ row, expanded, onToggle }: { row: SkillAssessment; expanded: boolean; onToggle: () => void }) {
  const status = STATUS[row.status]
  const StatusIcon = status.icon
  const evidence = row.evidence_span
  const lineLabel = evidence
    ? evidence.line_start === evidence.line_end
      ? `Dòng ${evidence.line_start}`
      : `Dòng ${evidence.line_start}–${evidence.line_end}`
    : null

  return (
    <tr className="align-top">
      <td className="px-6 py-4">
        <p className="font-heading font-bold text-ink">{row.skill}</p>
        {row.requirement_note && <p className="mt-0.5 text-xs text-ink-3">{row.requirement_note}</p>}
      </td>
      <td className="px-3 py-4">
        <Badge variant={status.badge} className="h-auto px-2 py-0.5">
          <StatusIcon aria-hidden />
          {status.label}
        </Badge>
      </td>
      <td className="px-3 py-4">
        {evidence ? (
          <div className="grid gap-1 rounded-lg bg-surface p-3">
            <p className={cn("text-[13px] leading-5 text-ink", !expanded && "line-clamp-2")}>
              <Quote className="mr-1 inline size-3.5 -translate-y-0.5 text-blue" aria-hidden />
              <span className="font-medium">{lineLabel}:</span> “{evidence.text}”
            </p>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="justify-self-start text-xs font-medium text-blue hover:underline"
            >
              {expanded ? "Thu gọn" : "Mở rộng dẫn chứng"}
            </button>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-lg border border-dashed border-line p-3 text-[13px] text-ink-2">
            <SearchX className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            Không tìm thấy từ khoá hoặc bằng chứng liên quan trong CV.
          </p>
        )}
      </td>
      <td className="px-3 py-4 pr-6">
        <Advice row={row} />
      </td>
    </tr>
  )
}

function Advice({ row }: { row: SkillAssessment }) {
  if (row.status === "matched") {
    return (
      <p className="flex items-start gap-2 text-[13px] text-ink-2">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
        {row.advice ?? "Đạt chuẩn yêu cầu của JD."}
      </p>
    )
  }
  const tone = {
    weak: { box: "bg-violet-soft/60", title: "text-violet", heading: "Gợi ý nâng cấp", icon: Sparkles },
    missing: { box: "bg-bad-soft/60", title: "text-bad", heading: "Thiếu hụt năng lực", icon: AlertTriangle },
    unclear: { box: "bg-surface", title: "text-ink-2", heading: "Cần bạn xem xét thủ công", icon: CircleHelp },
  }[row.status]
  const Icon = tone.icon
  return (
    <div className={cn("grid gap-1 rounded-lg p-3", tone.box)}>
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", tone.title)}>
        <Icon className="size-3.5" aria-hidden />
        {tone.heading}
      </p>
      {row.advice && <p className="text-[13px] leading-5 text-ink">{row.advice}</p>}
      {row.status === "missing" && (
        <p className="text-xs text-ink-2">Hệ thống không tự sửa mục này bằng câu chữ.</p>
      )}
    </div>
  )
}
