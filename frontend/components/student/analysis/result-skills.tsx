"use client"

import { useState } from "react"

import { SegmentedControl } from "@/components/common/segmented-control"
import { WidgetFooter, Zone } from "@/components/common/zone"
import { STATUS_META, TIERS } from "@/components/student/analysis/analysis-result-sections"
import { Badge } from "@/components/ui/badge"
import type { GapAnalysis, MatchStatus, RequirementAssessment } from "@/lib/types"
import { cn } from "@/lib/utils"

type Filter = "all" | MatchStatus

/**
 * Vùng "Kỹ năng và bằng chứng" (DESIGN.md 3.6): bộ lọc ở góc phải tiêu đề vùng, các dòng kẻ mảnh nhóm theo mức yêu
 * cầu, dòng chân ở đáy. Không có thẻ bao.
 */
export function ResultSkills({ analysis }: { analysis: GapAnalysis }) {
  const { requirements } = analysis
  const [filter, setFilter] = useState<Filter>("all")
  const count = (s: MatchStatus) => requirements.filter((r) => r.status === s).length
  const shown = filter === "all" ? requirements : requirements.filter((r) => r.status === filter)
  const groups = TIERS.map((tier) => ({ ...tier, rows: shown.filter((r) => r.importance === tier.importance) })).filter(
    (g) => g.rows.length > 0,
  )

  return (
    <Zone
      id="skills-title"
      title="Kỹ năng và bằng chứng"
      aside={
        <SegmentedControl
          aria-label="Lọc kỹ năng theo mức đáp ứng"
          size="sm"
          className="w-full sm:w-[420px]"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Tất cả", count: requirements.length },
            { value: "matched", label: "Đáp ứng", count: count("matched") },
            { value: "partial", label: "Liệt kê", count: count("partial") },
            { value: "missing", label: "Thiếu", count: count("missing") },
          ]}
        />
      }
    >
      <div className="grid gap-8">
        {groups.length === 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 border-b border-line py-6 text-sm text-ink-2">
            Không có kỹ năng nào ở mục này.
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="font-semibold text-blue hover:text-accent-strong"
            >
              Xem tất cả
            </button>
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.importance} aria-labelledby={`tier-${g.importance}`}>
              <h3
                id={`tier-${g.importance}`}
                className="border-b border-line pb-2 text-xs font-semibold tracking-[0.04em] text-ink-3 uppercase"
              >
                {g.label} <span className="font-medium tracking-normal normal-case">· trọng số ×{g.weight}</span>
              </h3>
              <ul>
                {g.rows.map((r) => (
                  <SkillRow key={r.id} row={r} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <WidgetFooter
        className="mt-3.5"
        link={
          analysis.jd.source === "library"
            ? {
                label: "Xem JD gốc",
                href: `/student/library/${encodeURIComponent(analysis.jd.id)}?cv=${encodeURIComponent(analysis.cv_version_id)}`,
              }
            : undefined
        }
        note={`${requirements.length} yêu cầu hệ thống trích từ JD`}
      />
    </Zone>
  )
}

function SkillRow({ row }: { row: RequirementAssessment }) {
  const status = STATUS_META[row.status]
  const meta = [row.evidence ? `Mục ${row.evidence.section_label}` : null, row.note].filter(Boolean).join(" · ")

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 border-b border-line py-3.5 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:gap-x-6">
      <span className="min-w-0 text-[15px] leading-6 font-medium text-ink">{row.skill}</span>
      <span className="col-span-2 row-start-2 min-w-0 text-sm leading-[22px] sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {row.evidence ? (
          <q className="text-ink-2">{row.evidence.text}</q>
        ) : (
          <span className="text-ink-3">{row.note ?? "Chưa thấy trong CV."}</span>
        )}
        {row.evidence && meta && <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">{meta}</span>}
      </span>
      <Badge variant={status.badge} className="mt-0.5 h-[22px] px-2 sm:col-start-3 sm:row-start-1">
        <span className={cn("size-1.5 rounded-full border-[1.5px] border-current", status.dot)} aria-hidden />
        {status.label}
      </Badge>
    </li>
  )
}
