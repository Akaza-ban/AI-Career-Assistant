"use client"

import type { ReactNode } from "react"
import { Clock, Copy, Lightbulb, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Zone } from "@/components/common/zone"
import { ResultWidget, joinSkills } from "@/components/student/analysis/analysis-result-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/clipboard"
import { OPTIMIZER_AVAILABLE } from "@/lib/config"
import type { GapAnalysis } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Vùng "Gợi ý cải thiện" (DESIGN.md 3.6): khối danh sách đánh số bên trái, khối "Nhận xét của AI" bên phải trên màn
 * rộng. Cả hai không viền, có dòng chân ở đáy.
 */
export function ResultSuggestions({ analysis }: { analysis: GapAnalysis }) {
  const partial = analysis.requirements.filter((r) => r.status === "partial").map((r) => r.skill)
  const missing = analysis.requirements.filter((r) => r.status === "missing").map((r) => r.skill)

  async function copy(text: string) {
    if (await copyText(text)) toast.success("Đã sao chép đề xuất")
    else toast.error("Không sao chép được. Hãy chọn và sao chép thủ công.")
  }

  const items: { key: string; body: ReactNode }[] = analysis.suggestions.map((s) => ({
    key: s.id,
    body: (
      <>
        <p className="text-[15px] leading-6 font-medium text-ink">{s.suggested_text}</p>
        <p className="mt-1 text-[13px] leading-5 text-ink-3">
          Thay cho{s.section_label ? ` (${s.section_label})` : ""}: {s.original_text}
        </p>
        {s.reason && <p className="mt-1 text-[13px] leading-5 text-ink-3">Lý do: {s.reason}</p>}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant="good" className="h-[22px] px-2">
              <ShieldCheck aria-hidden />
              Có căn cứ trong CV
            </Badge>
            <Badge variant="neutral" className="h-[22px] px-2">
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
      </>
    ),
  }))

  if (partial.length > 0) {
    items.push({
      key: "partial",
      body: (
        <>
          <p className="text-[15px] leading-6 font-medium text-ink">Mô tả cách bạn dùng {joinSkills(partial)}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-3">Hiện chỉ nằm trong danh sách kỹ năng.</p>
        </>
      ),
    })
  }
  // Chống bịa: kỹ năng thiếu không được sinh câu CV mới, chỉ gợi ý tự kiểm tra hoặc học thêm.
  if (missing.length > 0) {
    items.push({
      key: "missing",
      body: (
        <>
          <p className="text-[15px] leading-6 font-medium text-ink">Cân nhắc {joinSkills(missing)}</p>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-3">
            Nếu đã dùng, hãy bổ sung vào CV kèm mô tả cụ thể. Nếu chưa, đây là kỹ năng nên học thêm.
          </p>
        </>
      ),
    })
  }

  const optimizeHref = `/student/analysis/${encodeURIComponent(analysis.id)}/optimize`

  return (
    <Zone id="suggest-title" title="Gợi ý cải thiện">
      <div
        className={cn(
          "grid gap-x-12 gap-y-12",
          analysis.summary && "xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]",
        )}
      >
        <ResultWidget
          id="suggest-list"
          title="Việc nên làm với CV"
          footer={{
            link: OPTIMIZER_AVAILABLE ? { label: "Sửa trong trình tối ưu", href: optimizeHref } : undefined,
            note: items.length > 0 ? `${items.length} gợi ý` : undefined,
          }}
        >
          {analysis.suggestions.length === 0 && (
            <p className="border-b border-line py-3.5 text-sm text-ink-2">
              {analysis.llm_used
                ? "Chưa có câu nào cần diễn đạt lại cho vị trí này."
                : "AI tạm thời không khả dụng nên chưa có gợi ý viết lại."}
            </p>
          )}
          {items.length > 0 && (
            <ol>
              {items.map((item, i) => (
                <li key={item.key} className="flex gap-3.5 border-b border-line py-4">
                  <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">{item.body}</div>
                </li>
              ))}
            </ol>
          )}
          <div className="grid gap-1.5 border-b border-line py-3 text-[13px] leading-5 text-ink-3">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Gợi ý chỉ diễn đạt lại nội dung bạn đã viết, không thêm số liệu hay thành tích.
            </p>
            {analysis.pending_review_count > 0 && (
              <p className="flex items-start gap-2 text-ink-2">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                {analysis.pending_review_count} gợi ý đang chờ cố vấn xem lại do chưa đủ căn cứ trong CV.
              </p>
            )}
          </div>
        </ResultWidget>

        {analysis.summary && (
          <ResultWidget
            id="ai-note-title"
            title="Nhận xét của AI"
            icon={<Lightbulb className="size-4 text-blue" aria-hidden />}
          >
            <p className="border-b border-line py-3.5 text-[15px] leading-6 text-ink-2">{analysis.summary}</p>
            <p className="mt-3.5 text-sm text-ink-3">Do AI tạo từ CV và JD; hãy tự kiểm chứng.</p>
          </ResultWidget>
        )}
      </div>
    </Zone>
  )
}
