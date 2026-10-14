"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { ArrowUpRight, ChevronDown, TriangleAlert } from "lucide-react"

import { MatchBadge } from "@/components/common/match-badge"
import { ScoreRing } from "@/components/common/score-ring"
import { Zone } from "@/components/common/zone"
import { Badge } from "@/components/ui/badge"
import { formatPercent } from "@/lib/analysis"
import type { CompareJdsResponse, JdComparisonItem } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Cột đầu (tên kỹ năng) rồi n cột vị trí; dùng chung cho vùng điểm và bảng kỹ năng để các cột thẳng hàng. */
const colsStyle = (n: number) =>
  ({
    "--cols": `minmax(180px, 1.2fr) repeat(${n}, minmax(0, 1fr))`,
  }) as CSSProperties

// ---------- Mức phù hợp ----------

/** Tiến độ 0→1 (ease-out) cho vòng điểm, các cột hiện lần lượt cách nhau `delay` ms (WIREFRAMES A6). */
function useAppear(delay: number, duration = 1000) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = performance.now() + (reduce ? 0 : delay)
    let raf = 0
    const step = (now: number) => {
      const p = reduce ? 1 : Math.max(0, Math.min(1, (now - start) / duration))
      setT(p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [delay, duration])
  return 1 - Math.pow(1 - t, 3)
}

function ScoreColumn({ item, index }: { item: JdComparisonItem; index: number }) {
  const e = useAppear(index * 220)
  const best = item.rank === 1
  const score = Math.round(item.match_score)
  return (
    <li className="flex min-w-0 items-center gap-4">
      <span className="relative">
        <ScoreRing
          score={e >= 1 ? score : Math.floor(score * e)}
          size={72}
          strokeWidth={7}
          tone="blue"
          labelClassName="text-[17px] font-semibold text-ink tabular-nums"
          className={cn("[&_circle:first-child]:stroke-surface", !best && "[&_circle:last-child]:opacity-45")}
        />
        <span className="sr-only">Điểm phù hợp {formatPercent(item.match_score)}%</span>
      </span>
      <div className="min-w-0">
        <div className="text-[13px] text-ink-3">
          #{item.rank}
          {best && " · phù hợp nhất"}
        </div>
        <div className="leading-[1.3] font-semibold text-ink">{item.title}</div>
        {item.company && <div className="truncate text-sm text-ink-3">{item.company}</div>}
        <MatchBadge label={item.match_label} className="mt-1" />
      </div>
    </li>
  )
}

/** Dưới mức này coi là JD trích được quá ít yêu cầu, điểm dễ cao giả (ví dụ chỉ nhận ra Python và REST API). */
const THIN_REQUIREMENTS = 4

const isThin = (item: JdComparisonItem) =>
  item.requirements_source === "dictionary" ||
  (item.requirement_count !== undefined && item.requirement_count < THIN_REQUIREMENTS)

export function CompareScores({ data }: { data: CompareJdsResponse }) {
  const n = data.comparisons.length
  const thin = data.comparisons.filter(isThin)
  return (
    <Zone id="fit-title" title="Mức phù hợp">
      <ol className="grid grid-cols-[minmax(0,1fr)] items-end gap-6 md:grid-cols-(--cols)" style={colsStyle(n)}>
        <li aria-hidden className="hidden md:block" />
        {data.comparisons.map((item, i) => (
          <ScoreColumn key={item.jd_id} item={item} index={i} />
        ))}
      </ol>
      {thin.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {thin.map((item) => (
            <li
              key={item.jd_id}
              className="flex items-start gap-2.5 rounded-[14px] bg-warn-soft px-[18px] py-3.5 text-sm leading-[22px] text-ink-2 ring-1 ring-warn-line ring-inset"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <span>
                Hệ thống chỉ nhận ra <b className="font-semibold text-ink">{item.requirement_count ?? 0} yêu cầu</b> từ JD{" "}
                <b className="font-semibold text-ink">{item.title}</b>, nên điểm của vị trí này có thể chưa chính xác. Hãy
                dán JD có đủ phần Yêu cầu ứng viên, hoặc so sánh lại sau ít phút.
              </span>
            </li>
          ))}
        </ul>
      )}
    </Zone>
  )
}

// ---------- Kỹ năng ----------

type SkillState = "matched" | "partial" | "missing" | "none"

const STATE_TEXT: Record<SkillState, string> = {
  matched: "Đã đáp ứng",
  partial: "Chỉ liệt kê",
  missing: "Còn thiếu",
  none: "Không yêu cầu",
}

const STATE_SCORE: Record<SkillState, number> = {
  matched: 3,
  partial: 2,
  missing: 1,
  none: 0,
}

function stateOf(item: JdComparisonItem, skill: string): SkillState {
  if (item.matched_skills.includes(skill)) return "matched"
  if (item.partial_skills.includes(skill)) return "partial"
  if (item.missing_skills.includes(skill)) return "missing"
  return "none"
}

/** Chấm đặc = đã đáp ứng, nửa = chỉ liệt kê, rỗng = còn thiếu, gạch = vị trí đó không yêu cầu. */
function Dot({ state, withLabel = false }: { state: SkillState; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" title={withLabel ? undefined : STATE_TEXT[state]}>
      {state === "none" ? (
        <span aria-hidden className="inline-block h-[1.5px] w-3 rounded bg-line-strong" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "inline-block size-3 shrink-0 rounded-full",
            state === "matched" && "bg-good",
            state === "partial" &&
              "border-[1.5px] border-blue bg-[linear-gradient(90deg,var(--blue)_50%,transparent_50%)]",
            state === "missing" && "border-[1.5px] border-line-strong",
          )}
        />
      )}
      <span className={withLabel ? "text-sm text-ink-2" : "sr-only"}>{STATE_TEXT[state]}</span>
    </span>
  )
}

function Legend({ showNone }: { showNone: boolean }) {
  const states: SkillState[] = showNone ? ["matched", "partial", "missing", "none"] : ["matched", "partial", "missing"]
  return (
    <ul className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-ink-3" aria-label="Chú giải">
      {states.map((s) => (
        <li key={s} className={cn("inline-flex items-center gap-1.5", s === "none" && "max-md:hidden")}>
          <Dot state={s} />
          <span aria-hidden>{STATE_TEXT[s]}</span>
        </li>
      ))}
    </ul>
  )
}

export function CompareSkills({ data }: { data: CompareJdsResponse }) {
  const { comparisons } = data
  const n = comparisons.length
  // Gộp kỹ năng của mọi vị trí; kỹ năng đáp ứng ở nhiều vị trí lên trước, thiếu ở mọi nơi xuống cuối.
  const names = [
    ...new Set(comparisons.flatMap((c) => [...c.matched_skills, ...c.partial_skills, ...c.missing_skills])),
  ]
  const rows = names
    .map((skill, order) => {
      const states = comparisons.map((c) => stateOf(c, skill))
      return {
        skill,
        states,
        order,
        weight: states.reduce((sum, s) => sum + STATE_SCORE[s], 0),
      }
    })
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
  const showNone = rows.some((r) => r.states.includes("none"))
  const common = data.common_missing_skills
  const roadmaps = data.common_missing_roadmaps ?? {}
  const hasRoadmap = common.some((s) => roadmaps[s])

  return (
    <Zone id="skills-compare-title" title="Kỹ năng" aside={<Legend showNone={showNone} />}>
      {rows.length === 0 ? (
        <p className="border-b border-line pb-6 text-sm text-ink-2">Chưa có dữ liệu kỹ năng cho các vị trí này.</p>
      ) : (
        <>
          {/* Máy tính: bảng, hàng tiêu đề dính dưới thanh trên cùng khi cuộn. */}
          <div role="table" aria-label="So sánh kỹ năng giữa các vị trí" className="-mt-7 hidden md:block">
            <div
              role="row"
              className="sticky top-16 z-10 grid grid-cols-(--cols) gap-6 border-b border-line bg-card py-3 text-[13px] text-ink-3 lg:top-[72px]"
              style={colsStyle(n)}
            >
              <span role="columnheader">Kỹ năng</span>
              {comparisons.map((c) => (
                <span key={c.jd_id} role="columnheader" className="truncate" title={c.title}>
                  {c.title}
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div
                key={r.skill}
                role="row"
                className="grid grid-cols-(--cols) items-center gap-6 border-b border-line py-[13px]"
                style={colsStyle(n)}
              >
                <span role="rowheader" className="font-medium text-ink">
                  {r.skill}
                </span>
                {r.states.map((s, i) => (
                  <span key={comparisons[i].jd_id} role="cell">
                    <Dot state={s} />
                  </span>
                ))}
              </div>
            ))}
          </div>

          {/* Điện thoại: xếp dọc theo từng kỹ năng, chỉ liệt kê vị trí có yêu cầu kỹ năng đó; không cuộn ngang. */}
          <ul className="-mt-3.5 md:hidden">
            {rows.map((r) => (
              <li key={r.skill} className="border-b border-line py-3.5">
                <p className="font-medium text-ink">{r.skill}</p>
                <ul className="mt-2 grid gap-1.5">
                  {r.states.map((s, i) =>
                    s === "none" ? null : (
                      <li key={comparisons[i].jd_id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm text-ink-3">
                          #{comparisons[i].rank} {comparisons[i].title}
                        </span>
                        <Dot state={s} withLabel />
                      </li>
                    ),
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {common.length > 0 ? (
        <div className="mt-[22px] flex flex-wrap items-center gap-3 rounded-[14px] bg-warn-soft px-[18px] py-4 ring-1 ring-warn-line ring-inset">
          <b className="inline-flex items-center gap-2 font-semibold text-warn">
            <TriangleAlert className="size-4" aria-hidden />
            Thiếu ở cả {n} vị trí
          </b>
          <ul className="flex flex-wrap gap-2">
            {common.map((s) => (
              <li key={s}>
                {roadmaps[s] ? (
                  <a
                    href={roadmaps[s]}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Lộ trình học ${s} trên roadmap.sh`}
                    className="group/rm rounded-md"
                  >
                    <Badge variant="warn" className="h-[22px] gap-1 px-2 group-hover/rm:underline">
                      {s}
                      <ArrowUpRight className="size-3" strokeWidth={2} aria-hidden />
                    </Badge>
                  </a>
                ) : (
                  <Badge variant="warn" className="h-[22px] px-2">
                    {s}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <span className="text-sm text-ink-2 sm:ml-auto">
            {hasRoadmap ? "Nên ưu tiên học trước, bấm kỹ năng để xem lộ trình" : "Nên ưu tiên học trước"}
          </span>
        </div>
      ) : (
        <p className="mt-[22px] rounded-[14px] bg-panel px-[18px] py-4 text-sm text-ink-2">
          Không có kỹ năng nào thiếu ở cả {n} vị trí.
        </p>
      )}
    </Zone>
  )
}

// ---------- Nhận xét: ghép từ bảng kỹ năng cuối (src/services/fit_summary.py) nên luôn khớp với các chấm ----------

export function CompareComments({ data }: { data: CompareJdsResponse }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(data.comparisons.slice(0, 1).map((c) => c.jd_id)))
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <Zone id="ai-notes-title" title="Nhận xét">
      <div className="-mt-7">
        {data.comparisons.map((c) => {
          const expanded = open.has(c.jd_id)
          const panelId = `note-${c.jd_id}`
          return (
            <div key={c.jd_id} className="border-b border-line">
              <button
                type="button"
                onClick={() => toggle(c.jd_id)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="-mx-2.5 flex w-[calc(100%+1.25rem)] items-center gap-3.5 rounded-lg px-2.5 py-4 text-left transition-colors hover:bg-panel"
              >
                <span className="w-[22px] shrink-0 text-sm font-semibold text-ink-3 tabular-nums">#{c.rank}</span>
                <span className="min-w-0 flex-1 font-medium text-ink">{c.title}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-ink-3 transition-transform", expanded && "rotate-180")}
                  aria-hidden
                />
              </button>
              {expanded && (
                <div id={panelId} className="grid max-w-[880px] gap-2 pb-[18px] pl-9">
                  <p className="text-ink-2">{c.llm_summary ?? "Chưa có nhận xét cho vị trí này."}</p>
                  {!c.llm_used && (
                    <p className="text-[13px] text-ink-3">
                      AI tạm không khả dụng, nhận xét được dựng từ kết quả đối chiếu kỹ năng.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Zone>
  )
}
