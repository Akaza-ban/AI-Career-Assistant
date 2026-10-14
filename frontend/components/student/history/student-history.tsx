"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { AlertCircle, TrendingUp } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone } from "@/components/common/zone"
import {
  CvProgressBlock,
  InterviewProgressBlock,
  Timeline,
  type TimelineFilter,
} from "@/components/student/history/history-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useAgentActions } from "@/lib/use-agent-actions"
import { useApi } from "@/lib/use-api"

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "interview", label: "Phỏng vấn" },
  { value: "analysis", label: "Phân tích CV" },
  { value: "compare", label: "So sánh vị trí" },
]

// Tên loại phiên trợ lý AI có thể gửi tới, quy về bộ lọc dòng thời gian.
const FILTER_ALIASES: Record<string, TimelineFilter> = {
  all: "all",
  interview: "interview",
  interviews: "interview",
  mock_interview: "interview",
  "mock interview": "interview",
  analysis: "analysis",
  analyses: "analysis",
  gap_analysis: "analysis",
  compare: "compare",
  comparison: "compare",
  comparisons: "compare",
  jd_compare: "compare",
}

// Bản vẽ TienBo. Điểm phỏng vấn thang 0–5, chỉ so sánh trong cùng vị trí (PRD mục 5.1).
export function StudentHistory() {
  const fetchProgress = useCallback(() => api.getProgress("all", null), [])
  const { data: progress, error, reload } = useApi(fetchProgress)
  // Chỉ để gắn badge "Cố vấn đã nhận xét"; lỗi thì bỏ qua badge.
  const { data: sharing } = useApi(api.getSharing)
  // Lượt so sánh vị trí đã lưu; lỗi thì dòng thời gian chỉ thiếu các lượt này.
  const fetchComparisons = useCallback(() => api.listComparisonHistory(50), [])
  const { data: comparisons } = useApi(fetchComparisons)
  const [filter, setFilter] = useState<TimelineFilter>("all")

  // Trợ lý AI chỉ lọc được theo loại phiên, vì trang không có ô tìm kiếm hay lọc vị trí, thời gian.
  useAgentActions({
    fillFilter: (name, value) => {
      if (name !== "type" && name !== "active_tab") return false
      const next = FILTER_ALIASES[String(value).toLowerCase()]
      if (!next) return false
      setFilter(next)
      return true
    },
    resetView: ({ clear_filters }) => {
      if (clear_filters) setFilter("all")
    },
  })

  const reviewedIds = useMemo(
    () =>
      new Set([
        ...(sharing?.items ?? []).filter((i) => i.kind === "interview_report" && i.has_advisor_comment).map((i) => i.id),
        ...(sharing?.feedback ?? []).map((f) => f.target.id),
      ]),
    [sharing],
  )

  if (error) {
    return (
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được lịch sử luyện tập"
          description={error.message}
          action={
            <Button size="brand" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      </Panel>
    )
  }

  const noActivity = progress !== undefined && progress.positions.length === 0 && !comparisons?.length

  return (
    <div className="grid gap-9 md:gap-11">
      <PageHeader
        title="Lịch sử & tiến bộ"
        actions={
          !noActivity && (
            <div data-agent-target="history-type-filter" className="w-full sm:w-auto">
              <SegmentedControl
                options={FILTERS}
                value={filter}
                onChange={setFilter}
                aria-label="Lọc dòng thời gian"
                className="w-full sm:w-auto"
              />
            </div>
          )
        }
      />

      {!progress ? (
        <HistorySkeleton />
      ) : noActivity ? (
        <EmptyHistory />
      ) : (
        <div className="grid gap-14 md:gap-16">
          <Zone id="progress-title" title="Tiến bộ">
            <div className="grid gap-x-14 gap-y-12 lg:grid-cols-2">
              <InterviewProgressBlock groups={progress.interview_progress} />
              <CvProgressBlock groups={progress.cv_progress} />
            </div>
          </Zone>
          <Zone id="timeline-title" title="Dòng thời gian">
            <div data-agent-target="history-session-list">
              {/* key: về trang đầu khi đổi bộ lọc */}
              <Timeline
                key={filter}
                filter={filter}
                interviews={progress.interviews}
                analyses={progress.analyses}
                comparisons={comparisons ?? []}
                reviewedIds={reviewedIds}
              />
            </div>
          </Zone>
        </div>
      )}
    </div>
  )
}

function EmptyHistory() {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Chưa có dữ liệu tiến bộ"
      description="Phân tích CV với một JD hoặc hoàn thành buổi phỏng vấn thử đầu tiên. Mỗi lần sau được so với lần trước của cùng vị trí."
      className="border-y border-line py-14"
      action={
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button variant="soft" size="brand" nativeButton={false} render={<Link href="/student/analysis/new" />}>
            Phân tích CV với JD
          </Button>
          <Button size="brand" nativeButton={false} render={<Link href="/student/interview/new" />}>
            Luyện phỏng vấn
          </Button>
        </div>
      }
    />
  )
}

function HistorySkeleton() {
  return (
    <div className="grid gap-14" aria-busy="true" aria-label="Đang tải lịch sử">
      <div className="grid gap-7">
        <Skeleton className="h-8 w-40" />
        <div className="grid gap-14 lg:grid-cols-2">
          <Skeleton className="h-[290px] rounded-card" />
          <Skeleton className="h-[290px] rounded-card" />
        </div>
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-8 w-56" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}
