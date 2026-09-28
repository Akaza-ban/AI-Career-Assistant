"use client"

import { AlertCircle } from "lucide-react"

import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import {
  ActionCards,
  AdvisorTip,
  GreetingBanner,
  RecentActivity,
  SafeSpaceBanner,
  StarProgress,
  StatCards,
} from "@/components/student/overview/overview-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// Figma: frame "Tổng quan Sinh viên" (18:2).
export function StudentOverview() {
  const profile = useProfile()
  const { data: overview, error, reload } = useApi(api.getOverview)

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

  return (
    <div className="grid gap-8">
      <GreetingBanner fullName={profile.full_name} overview={overview} />
      <StatCards overview={overview} />
      <ActionCards overview={overview} />
      {/* Dưới 1280px cột phải quá hẹp cho nhãn STAR, nên xếp chồng; thẻ STAR và lời khuyên nằm cạnh nhau. */}
      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-7">
          <RecentActivity items={overview.recent_activity} />
        </div>
        <div className="grid min-w-0 items-start gap-4 md:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <StarProgress overview={overview} />
          {overview.advisor_tip && <AdvisorTip tip={overview.advisor_tip} />}
        </div>
      </div>
      <SafeSpaceBanner />
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Đang tải tổng quan">
      <Skeleton className="h-[116px] rounded-[20px]" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[122px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-[280px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-[420px] rounded-[20px] xl:col-span-7" />
        <Skeleton className="h-[300px] rounded-[20px] xl:col-span-5" />
      </div>
    </div>
  )
}
