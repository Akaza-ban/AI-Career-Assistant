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
  SkillsCard,
  StarAverageCard,
  StatCards,
  isNewStudent,
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
  const isNew = isNewStudent(overview)

  // Chỉ lời chào đặt thẳng trên nền trang; các mục khác nằm trong ô, tiêu đề mục đặt ngoài ô.
  return (
    <div className="grid gap-10">
      <GreetingBanner fullName={profile.full_name} overview={overview} />
      <InProgressPanel inProgress={overview.in_progress} />
      {isNew ? (
        <NextStepCard step={overview.next_step} />
      ) : (
        <>
          <StatCards overview={overview} />
          <div className="grid gap-x-8 gap-y-10 xl:grid-cols-12">
            <NextStepCard step={overview.next_step} className="xl:col-span-7" />
            <SkillsCard skills={overview.skills_to_learn} className="xl:col-span-5" />
          </div>
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            <RecentAnalyses items={overview.recent_analyses} />
            <RecentInterviews items={overview.recent_interviews} />
            <StarAverageCard star={overview.star} className="md:col-span-2 xl:col-span-1" />
          </div>
        </>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-10" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="flex flex-wrap items-center justify-between gap-4 py-4 sm:py-6">
        <div className="grid gap-2.5">
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-5 w-[420px] max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-44 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-x-8 gap-y-10 xl:grid-cols-12">
        <Skeleton className="h-[260px] rounded-[20px] xl:col-span-7" />
        <Skeleton className="h-[260px] rounded-[20px] xl:col-span-5" />
      </div>
      <div className="grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[300px] rounded-[20px]" />
        ))}
      </div>
    </div>
  )
}
