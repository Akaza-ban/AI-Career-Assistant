"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  CircleCheck,
  Clock,
  Compass,
  Copy,
  ExternalLink,
  Info,
  Lightbulb,
  MessagesSquare,
  Quote,
  ShieldCheck,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Panel, SectionHeader } from "@/components/common/panel"
import { IMPORTANCE_META } from "@/components/student/analysis/jd-picker-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MATCH_LABEL_META } from "@/lib/analysis"
import { copyText } from "@/lib/clipboard"
import { OPTIMIZER_AVAILABLE } from "@/lib/config"
import type { GapAnalysis, MatchStatus, RequirementAssessment } from "@/lib/types"
import { cn } from "@/lib/utils"

const formatNumber = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

export const STATUS_META: Record<MatchStatus, { label: string; badge: "good" | "warn" | "bad"; icon: typeof CircleCheck }> = {
  matched: { label: "Khớp", badge: "good", icon: CircleCheck },
  partial: { label: "Một phần", badge: "warn", icon: AlertTriangle },
  missing: { label: "Thiếu", badge: "bad", icon: X },
}

// ---------- Khối A — Tổng quan điểm ----------

export function ScoreCard({ analysis }: { analysis: GapAnalysis }) {
  const [showMore, setShowMore] = useState(false)
  const score = analysis.match_score ?? 0
  const label = MATCH_LABEL_META[analysis.match_label ?? "low"]

  return (
    <section data-agent-target="match-score-badge" className="grid gap-3">
      <SectionHeader
        title={
          <span className="flex items-center gap-1.5">
            CV–JD Matching Score
            <Tooltip>
              <TooltipTrigger
                render={
                  <button type="button" aria-label="Cách tính điểm" className="grid place-items-center rounded-full text-ink-3 hover:text-blue" />
                }
              >
                <Info className="size-3.5" aria-hidden />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs leading-5">
                Điểm = Σ(trọng số × mức khớp) / Σ trọng số × 100. Trọng số: Bắt buộc 3, Ưu tiên 2, Bổ trợ 1. Mức khớp: 1 khi có
                bằng chứng cụ thể, 0,5 khi chỉ được liệt kê, 0 khi không có trong CV.
              </TooltipContent>
            </Tooltip>
          </span>
        }
        aside={
          <span className="text-right text-xs text-ink-2">
            <strong className="text-good">{analysis.counts.matched}</strong> khớp ·{" "}
            <strong className="text-warn">{analysis.counts.partial}</strong> một phần ·{" "}
            <strong className="text-bad">{analysis.counts.missing}</strong> thiếu trên {analysis.requirements.length} yêu cầu
            của JD
          </span>
        }
      />
      <Panel className="grid gap-5">
        <div className="flex items-end gap-3">
          <span className="font-heading text-5xl leading-none font-extrabold text-ink">{formatNumber(score)}%</span>
          <Badge variant={label.badge} className="mb-1 h-auto px-2.5 py-0.5">
            Mức {label.text.toLowerCase()}
          </Badge>
        </div>

        <div className="h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Độ khớp ${formatNumber(score)}%`}>
          <div className={cn("h-full rounded-full transition-[width]", label.bar)} style={{ width: `${Math.min(100, score)}%` }} />
        </div>

        {/* PRD mục 8: chỉ diễn giải theo rubric của hệ thống, không nói về khả năng qua ATS hay trúng tuyển */}
        <p className="text-sm text-ink">
          CV hiện đáp ứng <strong>{formatNumber(score)}%</strong> tổng trọng số các yêu cầu được hệ thống trích xuất từ JD.
        </p>
        {analysis.summary && <p className="rounded-xl bg-surface p-3 text-sm leading-6 text-ink-2">{analysis.summary}</p>}
        {!analysis.llm_used && (
          <p className="flex items-start gap-1.5 text-xs text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            AI tạm thời không khả dụng nên điểm được chấm bằng quy tắc dự phòng (cùng rubric).
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-blue hover:underline"
        >
          {showMore ? "Thu gọn" : "Xem thêm cách tính điểm"}
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} aria-hidden />
        </button>

        {showMore && (
          <div className="grid gap-3 rounded-xl border border-line p-4">
            <table className="w-full text-sm">
              <caption className="sr-only">Phân rã điểm theo mức độ yêu cầu</caption>
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="pb-2 font-medium">Mức độ</th>
                  <th className="pb-2 font-medium">Khớp</th>
                  <th className="pb-2 font-medium">Một phần</th>
                  <th className="pb-2 font-medium">Thiếu</th>
                  <th className="pb-2 text-right font-medium">Điểm đạt</th>
                </tr>
              </thead>
              <tbody>
                {analysis.breakdown.map((b) => (
                  <tr key={b.importance} className="border-t border-line">
                    <td className="py-2 font-medium text-ink">
                      {b.label} <span className="text-xs font-normal text-ink-3">(×{b.weight})</span>
                    </td>
                    <td className="py-2 text-good">{b.matched}</td>
                    <td className="py-2 text-warn">{b.partial}</td>
                    <td className="py-2 text-bad">{b.missing}</td>
                    <td className="py-2 text-right text-ink">
                      {formatNumber(b.earned)} / {formatNumber(b.possible)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-ink-2">
              Tổng: {formatNumber(analysis.breakdown.reduce((s, b) => s + b.earned, 0))} /{" "}
              {formatNumber(analysis.breakdown.reduce((s, b) => s + b.possible, 0))} điểm trọng số → {formatNumber(score)}%.
            </p>
          </div>
        )}
      </Panel>
    </section>
  )
}

// ---------- Khối B — Bằng chứng trong CV ----------

type EvidenceFilter = "all" | "missing" | "required"

export function EvidenceList({ requirements }: { requirements: RequirementAssessment[] }) {
  const [filter, setFilter] = useState<EvidenceFilter>("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rows = useMemo(
    () =>
      requirements.filter((r) =>
        filter === "missing" ? r.status === "missing" : filter === "required" ? r.importance === "required" : true,
      ),
    [requirements, filter],
  )
  const tabs: { value: EvidenceFilter; label: string; count: number }[] = [
    { value: "all", label: "Tất cả", count: requirements.length },
    { value: "missing", label: "Chỉ thiếu", count: requirements.filter((r) => r.status === "missing").length },
    { value: "required", label: "Chỉ bắt buộc", count: requirements.filter((r) => r.importance === "required").length },
  ]

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <SectionHeader
          title="Bằng chứng trong CV"
          aside={
            <div role="tablist" aria-label="Lọc yêu cầu" className="flex gap-1 rounded-xl bg-blue-soft/60 p-1">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.value}
                  onClick={() => setFilter(t.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    filter === t.value ? "bg-card text-blue shadow-card" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          }
        />
        <p className="text-xs text-ink-2">Mỗi yêu cầu của JD kèm câu trích nguyên văn từ CV. Bấm vào dòng để xem chi tiết.</p>
      </div>
      <Panel className="grid overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="m-5 flex items-center gap-2 rounded-xl bg-good-soft/60 p-4 text-sm text-good">
            <CircleCheck className="size-4" aria-hidden />
            Không có yêu cầu nào thiếu trong CV.
          </p>
        ) : (
          <ul className="grid">
            {rows.map((r) => (
              <EvidenceRow key={r.id} row={r} expanded={expanded.has(r.id)} onToggle={() => toggle(r.id)} />
            ))}
          </ul>
        )}
      </Panel>
    </section>
  )
}

function EvidenceRow({ row, expanded, onToggle }: { row: RequirementAssessment; expanded: boolean; onToggle: () => void }) {
  const status = STATUS_META[row.status]
  const StatusIcon = status.icon
  const importance = IMPORTANCE_META[row.importance]
  const detailId = `evidence-${row.id}`

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-6 py-3.5 text-left hover:bg-surface/60 md:grid-cols-[minmax(0,220px)_110px_minmax(0,1fr)_auto]"
      >
        <span className="grid min-w-0 gap-1">
          <span className="truncate font-semibold text-ink">{row.skill}</span>
          <span className={cn("justify-self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium", importance.chip)}>
            {importance.label}
          </span>
        </span>
        <span className="order-3 md:order-none">
          <Badge variant={status.badge} className="h-auto px-2.5 py-0.5">
            <StatusIcon aria-hidden />
            {status.label}
          </Badge>
        </span>
        <span className={cn("order-4 col-span-2 truncate text-sm md:order-none md:col-span-1", row.evidence ? "text-ink-2" : "text-ink-3 italic")}>
          {row.evidence ? `"${row.evidence.text}"` : "Không tìm thấy trong CV"}
        </span>
        <ChevronDown
          className={cn("order-2 size-4 text-ink-3 transition-transform md:order-none", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded && (
        <div id={detailId} className="grid gap-2 px-6 pb-4">
          {row.evidence ? (
            <blockquote className="flex gap-2 rounded-xl bg-surface p-3 text-sm leading-6 text-ink">
              <Quote className="mt-1 size-3.5 shrink-0 text-blue" aria-hidden />
              <span>
                {row.evidence.text}
                <span className="mt-1 block text-xs text-ink-2">Mục trong CV: {row.evidence.section_label}</span>
              </span>
            </blockquote>
          ) : (
            <p className="rounded-xl bg-bad-soft/50 p-3 text-sm text-ink">
              Không tìm thấy trong CV. Hệ thống không tự điền bằng chứng cho yêu cầu này.
            </p>
          )}
          {row.note && <p className="text-xs text-ink-2">Ghi chú: {row.note}</p>}
          <p className="text-xs text-ink-3">
            Mức khớp {formatNumber(row.match)} × trọng số {row.weight} = {formatNumber(row.match * row.weight)} điểm
          </p>

          {/* Lộ trình học tập roadmap.sh */}
          {row.is_it_supported && row.roadmap_url ? (
            <div className="pt-1">
              <a
                href={row.roadmap_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue/30 bg-blue-soft/50 px-3 py-1.5 text-xs font-semibold text-blue transition-colors hover:bg-blue-soft"
              >
                <Compass className="size-3.5" aria-hidden />
                Xem lộ trình học {row.skill} trên roadmap.sh
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 rounded-lg border border-line/60 bg-surface/70 px-3 py-2 text-xs text-ink-3">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
              <span>
                {row.roadmap_message ||
                  "Lộ trình roadmap.sh hiện chỉ hỗ trợ các chuyên ngành Công nghệ thông tin (IT). Với kỹ năng này, vui lòng tham khảo tài liệu chuyên ngành tương ứng."}
              </span>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

// ---------- Khối C — Gợi ý ----------

export function SuggestionList({ analysis }: { analysis: GapAnalysis }) {
  const missing = analysis.requirements.filter((r) => r.status === "missing")

  async function copy(text: string) {
    if (await copyText(text)) toast.success("Đã sao chép đề xuất")
    else toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.")
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <SectionHeader title="Gợi ý cải thiện" />
        <p className="text-xs text-ink-2">
          Chỉ diễn đạt lại nội dung bạn đã viết, không thêm số liệu hay thành tích. Hãy kiểm tra trước khi dùng.
        </p>
      </div>
      <Panel className="grid overflow-hidden p-0">
        {analysis.suggestions.length === 0 ? (
          <p className="p-5 text-sm text-ink-2">
            {analysis.llm_used
              ? "Chưa có câu nào cần diễn đạt lại cho vị trí này."
              : "AI tạm thời không khả dụng nên chưa có gợi ý viết lại. Điểm và bằng chứng phía trên vẫn được chấm theo rubric."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {analysis.suggestions.map((s) => (
              <li key={s.id} className="flex gap-3 px-6 py-5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet" aria-hidden />
                <div className="grid min-w-0 flex-1 gap-2">
                  <p className="text-[15px] leading-6 font-medium text-ink">{s.suggested_text}</p>
                  <p className="text-xs leading-5 text-ink-2">
                    <span className="font-medium text-ink">Câu gốc{s.section_label ? ` (${s.section_label})` : ""}:</span>{" "}
                    {s.original_text}
                  </p>
                  {s.reason && (
                    <p className="text-xs leading-5 text-ink-2">
                      <span className="font-medium text-ink">Lý do:</span> {s.reason}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="good" className="h-auto px-2 py-0.5">
                        <ShieldCheck aria-hidden />
                        Có căn cứ trong CV
                      </Badge>
                      <Badge variant="neutral" className="h-auto px-2 py-0.5">
                        {s.skill}
                      </Badge>
                    </span>
                    <span className="flex items-center gap-1">
                      <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => void copy(s.suggested_text)}>
                        <Copy aria-hidden />
                        Sao chép
                      </Button>
                      <FeedbackWidget variant="thumbs" responseId={s.id} />
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Chống bịa: kỹ năng thiếu không được sinh câu CV mới, chỉ gợi ý tự kiểm tra hoặc học thêm */}
        {missing.length > 0 && (
          <section className="m-5 mt-0 grid gap-3 rounded-xl bg-warn-soft/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb className="size-4 text-warn" aria-hidden />
              Kỹ năng còn thiếu & Lộ trình học tập
            </h3>

            {/* Thông báo định hướng: Lộ trình roadmap.sh chỉ hỗ trợ các lĩnh vực IT */}
            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-card/90 p-3 text-xs leading-5 text-ink-2 shadow-xs">
              <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
              <div>
                <strong className="font-semibold text-ink">Lưu ý về Lộ trình học tập:</strong>{" "}
                Tính năng liên kết lộ trình từ <strong>roadmap.sh</strong> hiện chỉ hỗ trợ các chuyên ngành thuộc{" "}
                <strong>Công nghệ thông tin (IT / Kỹ thuật phần mềm / Data / Cloud / AI)</strong>. Với các kỹ năng ngoài IT (tài chính, kinh tế, marketing, kỹ năng mềm...), hệ thống chưa có roadmap riêng, bạn vui lòng tham khảo tài liệu chuyên môn hoặc trao đổi trực tiếp với Cố vấn học tập.
              </div>
            </div>

            <ul className="flex flex-wrap gap-2 pt-1">
              {missing.map((r) => {
                const hasRoadmap = r.is_it_supported !== false && Boolean(r.roadmap_url)
                return hasRoadmap ? (
                  <li key={r.id}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={r.roadmap_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue/30 bg-card px-2.5 py-1 text-xs font-semibold text-blue shadow-xs transition-colors hover:bg-blue-soft"
                          >
                            <Compass className="size-3.5 text-blue" aria-hidden />
                            {r.skill}
                            <ExternalLink className="size-3 text-ink-3" aria-hidden />
                          </a>
                        }
                      />
                      <TooltipContent className="text-xs">
                        Mở bản đồ lộ trình học {r.skill} trên roadmap.sh
                      </TooltipContent>
                    </Tooltip>
                  </li>
                ) : (
                  <li key={r.id}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex cursor-help items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line">
                            {r.skill}
                            <Info className="size-3 text-ink-3" aria-hidden />
                          </span>
                        }
                      />
                      <TooltipContent className="max-w-xs text-xs">
                        {r.roadmap_message ||
                          "Kỹ năng ngoài lĩnh vực IT — roadmap.sh chưa hỗ trợ lộ trình này."}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs leading-5 text-ink-2">
              Nếu bạn thực sự đã có kinh nghiệm với các kỹ năng này, hãy bổ sung vào CV kèm mô tả cụ thể; nếu chưa, bạn có thể bấm vào kỹ năng IT ở trên để xem lộ trình học chuẩn từ cộng đồng.
            </p>
          </section>
        )}
      </Panel>
    </section>
  )
}

// ---------- Khối D — Hành động tiếp theo ----------

export function NextActions({ analysis }: { analysis: GapAnalysis }) {
  const optimizeHref = `/student/analysis/${encodeURIComponent(analysis.id)}/optimize`
  return (
    <section className="grid gap-3">
      <SectionHeader title="Bước tiếp theo" />
      <Panel className="grid gap-4 bg-gradient-to-r from-card to-violet-soft/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-2">Luyện trả lời phỏng vấn theo STAR cho đúng vị trí vừa phân tích.</p>
          <div className="flex flex-wrap items-center gap-2">
            {OPTIMIZER_AVAILABLE ? (
              <Button variant="soft" className="h-11 px-4" nativeButton={false} render={<Link href={optimizeHref} />}>
                <Wand2 aria-hidden />
                Tối ưu CV
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger render={<span tabIndex={0} className="grid rounded-lg" />}>
                  <Button variant="soft" className="h-11 px-4" disabled>
                    <Wand2 aria-hidden />
                    Tối ưu CV
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Trình tối ưu CV sắp có</TooltipContent>
              </Tooltip>
            )}
            <Button
              variant="violet"
              size="brand"
              nativeButton={false}
              render={<Link href={`/student/interview/new?jd=${encodeURIComponent(analysis.jd.id)}`} />}
            >
              <MessagesSquare aria-hidden />
              Luyện phỏng vấn cho vị trí này
            </Button>
          </div>
        </div>
        {analysis.pending_review_count > 0 && (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Clock className="size-4 text-warn" aria-hidden />
            {analysis.pending_review_count} gợi ý đang chờ cố vấn xem lại do chưa đủ căn cứ trong CV.
          </p>
        )}
      </Panel>
    </section>
  )
}

/** Cảnh báo bắt buộc, giữ nguyên văn PRD mục 8. */
export function ResultDisclaimer() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-xs leading-5 text-ink-2">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      Các đánh giá, điểm số và gợi ý được tạo bởi AI chỉ mang tính tham khảo và hỗ trợ bạn cải thiện CV/kỹ năng phỏng
      vấn. Hệ thống không đảm bảo bạn sẽ vượt qua ATS, được mời phỏng vấn hoặc trúng tuyển vào bất kỳ vị trí nào. Quyết
      định tuyển dụng phụ thuộc vào nhà tuyển dụng và nhiều yếu tố nằm ngoài phạm vi đánh giá của hệ thống. Bạn chịu trách
      nhiệm cuối cùng đối với nội dung CV được nộp.
    </p>
  )
}
