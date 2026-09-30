"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import {
  GreetingBanner,
  InProgressPanel,
  NextStepCard,
  RecentAnalyses,
  RecentInterviews,
  SharingStatus,
  SkillsCard,
  StarAverageCard,
  StatCards,
} from "@/components/student/overview/overview-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"

/** Chu kỳ hỏi lại khi còn lượt phân tích đang chạy. */
const POLL_MS = 4000

// Figma: frame "Tổng quan Sinh viên" (18:2). Điểm STAR thang 0–5 (PRD mục 5.1).
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
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được dữ liệu tổng quan</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!overview || !profile) return <OverviewSkeleton />

  // SV mới (chưa có CV, chưa phân tích, chưa phỏng vấn): chỉ hiện việc cần làm đầu tiên.
  const isNew = overview.cv_count === 0 && overview.recent_analyses.length === 0 && overview.interview_count === 0

  return (
    <div className="grid gap-6">
      <GreetingBanner fullName={profile.full_name} overview={overview} />
      <InProgressPanel inProgress={overview.in_progress} />
      {isNew ? (
        <NextStepCard step={overview.next_step} />
      ) : (
        <>
          <StatCards overview={overview} />
          <div className="grid items-stretch gap-6 xl:grid-cols-12">
            <div className="grid min-w-0 xl:col-span-7">
              <NextStepCard step={overview.next_step} />
            </div>
            <div className="grid min-w-0 xl:col-span-5">
              <SkillsCard skills={overview.skills_to_learn} />
            </div>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            <RecentAnalyses items={overview.recent_analyses} />
            <RecentInterviews items={overview.recent_interviews} />
            <div className="md:col-span-2 xl:col-span-1">
              <StarAverageCard star={overview.star} />
            </div>
          </div>
        </>
      )}
      <SharingStatus />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải tổng quan">
      <Skeleton className="h-[116px] rounded-[20px]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-[260px] rounded-[20px] xl:col-span-7" />
        <Skeleton className="h-[260px] rounded-[20px] xl:col-span-5" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[340px] rounded-[20px]" />
        ))}
      </div>
    </div>
  )
}
