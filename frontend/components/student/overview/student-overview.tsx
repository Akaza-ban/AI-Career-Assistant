"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { Panel, SoftPanel } from "@/components/common/panel"
import { Zone, ZoneLink } from "@/components/common/zone"
import { useProfile } from "@/components/shell/profile-context"
import { FitPositions } from "@/components/student/overview/fit-positions"
import {
  Greeting,
  NextTasks,
  ProgressMetrics,
  RecentAnalyses,
  RecentInterviews,
  SkillsToLearn,
  isNewStudent,
} from "@/components/student/overview/overview-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"

/** Chu kỳ hỏi lại khi còn lượt phân tích đang chạy. */
const POLL_MS = 4000

// Bản mẫu v2, artboard "Tổng quan" (WIREFRAMES.md A1). Điểm STAR thang 0–5 (PRD mục 5.1).
export function StudentOverview() {
  const profile = useProfile()
  const { data: overview, error, reload } = useApi(api.getOverview)

  // Lượt phân tích chạy nền: cập nhật bước đang chạy và kết quả khi xong.
  const processing = (overview?.in_progress.analyses.length ?? 0) > 0
  useEffect(() => {
    if (!processing) return
    const timer = setTimeout(reload, POLL_MS)
    return () => clearTimeout(timer)
  }, [overview, processing, reload])

  if (error) {
    return (
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được dữ liệu tổng quan"
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

  if (!overview || !profile) return <OverviewSkeleton />

  // SV mới (chưa có CV, chưa phân tích, chưa phỏng vấn): chỉ hiện việc cần làm đầu tiên.
  const isNew = isNewStudent(overview)

  // Phương án A (kiểu Stripe): các vùng có tiêu đề lớn + đường kẻ, bên trong là các khối không viền có dòng chân.
  return (
    <div className="grid gap-14 md:gap-16">
      <div className="grid gap-9 md:gap-11">
        <Greeting fullName={profile.full_name} overview={overview} />
        <NextTasks overview={overview} />
      </div>
      {!isNew && (
        <>
          <ProgressMetrics overview={overview} />
          <Zone id="suggestions-title" title="Gợi ý cho bạn">
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
              <FitPositions />
              <SkillsToLearn skills={overview.skills_to_learn} />
            </div>
          </Zone>
          <Zone
            id="activity-title"
            title="Hoạt động gần đây"
            aside={<ZoneLink href="/student/history">Xem lịch sử</ZoneLink>}
          >
            <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
              <RecentAnalyses items={overview.recent_analyses} />
              <RecentInterviews items={overview.recent_interviews} />
            </div>
          </Zone>
        </>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-8 md:gap-9" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="flex min-h-[200px] flex-col justify-center gap-3.5 pt-2 md:min-h-[230px]">
        <Skeleton className="h-9 w-72 max-w-full md:h-12 md:w-[420px]" />
        <Skeleton className="h-9 w-80 max-w-full md:h-12 md:w-[560px]" />
        <Skeleton className="h-6 w-[420px] max-w-full" />
        <div className="mt-2 flex gap-2.5">
          <Skeleton className="h-[46px] w-36 rounded-full" />
          <Skeleton className="h-[46px] w-40 rounded-full" />
        </div>
      </div>
      <SoftPanel className="grid gap-4">
        <Skeleton className="h-7 w-48" />
        <div className="flex flex-wrap gap-3.5">
          <Skeleton className="h-[196px] flex-[1_1_280px] rounded-card" />
          <Skeleton className="h-[196px] flex-[1_1_280px] rounded-card" />
          <div className="flex min-w-[240px] flex-[1_1_240px] flex-col gap-2.5 lg:flex-[0_1_300px]">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[50px] rounded-xl" />
            ))}
          </div>
        </div>
      </SoftPanel>
      <div className="grid gap-5">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[150px] rounded-card" />
          ))}
        </div>
      </div>
      <div className="grid gap-x-10 gap-y-9 lg:grid-cols-[1.3fr_1fr]">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[260px] rounded-card" />
        ))}
      </div>
    </div>
  )
}
