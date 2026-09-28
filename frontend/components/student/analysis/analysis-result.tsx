"use client"

import Link from "next/link"
import { useCallback } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  CircleCheck,
  FileText,
  Info,
  Lightbulb,
  ListChecks,
  ScanLine,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { MatchingScoreTable } from "@/components/MatchingScoreTable"
import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { GapAnalysis } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** Nhãn cho độ khớp tổng thể. Ngưỡng tạm thời, cần chốt cùng nhóm AI. */
function matchVerdict(score: number) {
  if (score >= 75) return { label: "Khả quan qua vòng lọc", className: "text-good", icon: CircleCheck }
  if (score >= 60) return { label: "Cần cải thiện thêm", className: "text-warn", icon: AlertCircle }
  return { label: "Chưa đạt yêu cầu", className: "text-bad", icon: AlertCircle }
}

// Figma: frame "Phân tích CV và JD" (18:385). Task B4, PRD US-SV-02 / US-SV-05.
export function AnalysisResult({ id }: { id: string }) {
  const fetchAnalysis = useCallback(() => api.getGapAnalysis(id), [id])
  const { data: analysis, error, reload } = useApi(fetchAnalysis)

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được kết quả phân tích</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!analysis) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải kết quả phân tích">
        <Skeleton className="h-40 rounded-[20px]" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-[480px] rounded-[20px]" />
      </div>
    )
  }

  const optimizeHref = `/student/analysis/${encodeURIComponent(analysis.id)}/optimize`

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <Link href="/student/cv" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Quay lại CV của tôi
        </Link>
      </div>

      <ResultHeader analysis={analysis} optimizeHref={optimizeHref} />
      <MetricCards analysis={analysis} />
      <div id="skill-table" className="scroll-mt-24">
        <MatchingScoreTable analysis={analysis} />
      </div>
      <AdviceCard analysis={analysis} />

      <Panel className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-card to-violet-soft/50">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet text-white">
            <Wand2 className="size-6" aria-hidden />
          </span>
          <div className="grid gap-1">
            <h2 className="font-heading text-lg font-bold">Sẵn sàng tối ưu CV cho vị trí này?</h2>
            <p className="text-sm text-ink-2">
              Chuyển sang giao diện chỉnh sửa song song. AI chỉ gợi ý cách viết lại dựa trên trải nghiệm thật của bạn,
              bạn duyệt từng thay đổi và không có dữ liệu nào bị bịa đặt.
            </p>
          </div>
        </div>
        <Button variant="violet" size="brand" nativeButton={false} render={<Link href={optimizeHref} />}>
          <Sparkles aria-hidden />
          Bắt đầu tối ưu CV
        </Button>
      </Panel>

      {/* US-SV-06: khảo sát CSAT sau mỗi lượt phân tích */}
      <FeedbackWidget
        variant="stars"
        responseId={analysis.response_id}
        activity="gap_analysis"
        title="Bạn đánh giá kết quả phân tích này hữu ích đến mức nào?"
      />

      <p className="flex items-start justify-center gap-1.5 rounded-xl bg-surface px-4 py-3 text-center text-xs text-ink-2">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Kết quả đối soát là cơ sở tham khảo. Hệ thống không xác minh được tính xác thực của kinh nghiệm tự khai và không
        đảm bảo trúng tuyển.
      </p>
    </div>
  )
}

function ResultHeader({ analysis, optimizeHref }: { analysis: GapAnalysis; optimizeHref: string }) {
  const company = analysis.jd.company ? ` – ${analysis.jd.company}` : ""
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4">
      <div className="grid min-w-0 flex-1 gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <Badge variant="violet">Báo cáo đối soát CV</Badge>
          <span aria-hidden>•</span>
          <span>Mã hồ sơ: #{analysis.id}</span>
        </div>
        <h1 className="font-heading text-[28px] leading-9 font-bold">Kết quả đối soát CV vs Mô tả công việc (JD)</h1>
        {/* US-SV-02 AC1: kết quả gắn với đúng cặp (phiên bản CV, JD) */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-ink">
            <Briefcase className="size-3.5 text-blue" aria-hidden />
            Vị trí: <strong className="font-semibold">{analysis.jd.title + company}</strong>
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-ink">
            <FileText className="size-3.5 text-blue" aria-hidden />
            Bản CV: <strong className="font-semibold">{analysis.cv_file_name}</strong>
            <span className="text-ink-3">({formatRelativeTime(analysis.created_at).toLowerCase()})</span>
          </span>
        </div>
      </div>
      <Button size="brand" nativeButton={false} render={<Link href={optimizeHref} />}>
        <Sparkles aria-hidden />
        Bắt đầu tối ưu CV ngay
        <ArrowRight aria-hidden />
      </Button>
    </Panel>
  )
}

function MetricLabel({ kicker, title, icon: Icon }: { kicker: string; title: string; icon: typeof Target }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="grid gap-0.5">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{kicker}</span>
        <span className="font-heading font-bold text-ink">{title}</span>
      </div>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-soft text-blue">
        <Icon className="size-[18px]" aria-hidden />
      </span>
    </div>
  )
}

function MetricCards({ analysis }: { analysis: GapAnalysis }) {
  const verdict = matchVerdict(analysis.match_score)
  const VerdictIcon = verdict.icon
  const matched = analysis.matched_skills.length
  const weak = analysis.weak_skills.length
  const missing = analysis.missing_skills.length
  const unclear = analysis.unclear_skills.length
  const total = matched + weak + missing + unclear
  const toImprove = weak + missing + unclear

  const bars = [
    { label: "Đã có trong CV", count: matched, bar: "bg-good", dot: "bg-good" },
    { label: "Mức độ yếu / chưa rõ bằng chứng", count: weak, bar: "bg-warn", dot: "bg-warn" },
    { label: "Còn thiếu hoàn toàn", count: missing, bar: "bg-bad", dot: "bg-bad" },
    ...(unclear > 0 ? [{ label: "Cần xem xét thủ công", count: unclear, bar: "bg-ink-3", dot: "bg-ink-3" }] : []),
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel className="grid content-start gap-4 p-5">
        <MetricLabel kicker="Chỉ số cốt lõi" title="Độ khớp tổng thể" icon={Target} />
        <div className="flex items-center gap-4">
          <ScoreRing score={analysis.match_score} size={88} strokeWidth={8} labelClassName="text-2xl" />
          <div className="grid gap-1">
            <p className={cn("flex items-center gap-1 text-sm font-semibold", verdict.className)}>
              <VerdictIcon className="size-4" aria-hidden />
              {verdict.label}
            </p>
            <p className="text-xs leading-5 text-ink-2">
              Có {matched} kỹ năng đạt yêu cầu và {toImprove} điểm cần bổ sung so với JD.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="grid content-start gap-4 p-5">
        <MetricLabel kicker="Máy quét hồ sơ" title="Tương thích ATS Parser" icon={ScanLine} />
        {analysis.ats_score !== null ? (
          <div className="flex items-center gap-4">
            <ScoreRing score={analysis.ats_score} size={88} strokeWidth={8} tone="blue" labelClassName="text-2xl" />
            <div className="grid gap-1">
              <p className="flex items-center gap-1 text-sm font-semibold text-blue">
                <CircleCheck className="size-4" aria-hidden />
                {analysis.ats_score >= 80 ? "Định dạng thân thiện" : "Định dạng cần chỉnh"}
              </p>
              {analysis.ats_feedback && <p className="text-xs leading-5 text-ink-2">{analysis.ats_feedback}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Chưa có điểm ATS cho phiên bản CV này.</p>
        )}
      </Panel>

      <Panel className="grid content-start gap-3 p-5">
        <MetricLabel kicker="Phân loại yêu cầu" title={`Thống kê ${total} kỹ năng`} icon={BarChart3} />
        <ul className="grid gap-2.5">
          {bars.map((b) => (
            <li key={b.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-ink">
                  <span className={cn("size-2 rounded-full", b.dot)} aria-hidden />
                  {b.label}
                </span>
                <span className="font-heading font-bold text-ink">{b.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className={cn("h-full rounded-full", b.bar)} style={{ width: `${total ? (b.count / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {/* US-SV-05 AC2: nêu rõ khi không có khoảng cách năng lực */}
        {missing === 0 && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-good">
            <CircleCheck className="size-3.5" aria-hidden />
            Không phát hiện khoảng cách năng lực
          </p>
        )}
        <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs">
          <span className="text-ink-2">Cần tối ưu thêm: {toImprove} mục</span>
          <a href="#skill-table" className="font-medium text-blue hover:underline">
            Xem chi tiết ↓
          </a>
        </div>
      </Panel>
    </div>
  )
}

function AdviceCard({ analysis }: { analysis: GapAnalysis }) {
  if (!analysis.summary && analysis.next_steps.length === 0) return null
  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-violet-soft text-violet">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          Lời khuyên từ Cố vấn AI cho hồ sơ của bạn
        </h2>
        <Badge variant="neutral">Chiến lược hồ sơ</Badge>
      </div>
      {analysis.summary && <p className="text-sm leading-6 text-ink">{analysis.summary}</p>}
      {analysis.next_steps.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {analysis.next_steps.map((step) => (
            <li key={step.title} className="flex gap-3 rounded-xl bg-surface p-3">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
              <div className="grid gap-0.5">
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="text-xs text-ink-2">{step.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
