"use client"

import { AlertCircle, Users } from "lucide-react"

import {
  AdvisorGreeting,
  AdvisorTasks,
  GroupAnalysis,
  GroupMetrics,
  ProgressSplit,
  RecentReviews,
  TopImprovers,
} from "@/components/advisor/overview/overview-sections"
import { EmptyState } from "@/components/common/empty-state"
import { Panel, SoftPanel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// Tổng quan cả nhóm SV phụ trách (bản vẽ CoVanTongQuan, WIREFRAMES.md A19). PRD US-ADV-01, US-ADV-02, KPI mục 9.
// Chỉ dùng số liệu tổng hợp; nội dung từng tài liệu vẫn cần SV chia sẻ.
// Danh sách SV phụ trách bổ sung cho "Chờ nhận xét", "Độ khớp CV TB" và "Mức tiến bộ".
export function AdvisorOverview() {
  const overview = useApi(api.getAdvisorOverview)
  const students = useApi(api.listAssignedStudents)
  const error = overview.error ?? students.error

  if (error) {
    return (
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được bảng tổng quan"
          description={error.message}
          action={
            <Button
              size="brand"
              onClick={() => {
                if (overview.error) overview.reload()
                if (students.error) students.reload()
              }}
            >
              Thử lại
            </Button>
          }
        />
      </Panel>
    )
  }
  const data = overview.data
  if (!data || !students.data) return <OverviewSkeleton />

  return (
    <div className="grid gap-14 md:gap-16">
      <div className="grid gap-9 md:gap-11">
        <AdvisorGreeting data={data} />
        {data.student_count === 0 ? (
          <SoftPanel>
            <EmptyState
              icon={Users}
              title="Chưa có sinh viên phụ trách"
              description="Khi bạn được phân công sinh viên, tiến bộ của cả nhóm sẽ hiển thị ở đây."
            />
          </SoftPanel>
        ) : (
          <AdvisorTasks data={data} students={students.data} />
        )}
      </div>
      {data.student_count > 0 && (
        <>
          <GroupMetrics data={data} students={students.data} />
          <GroupAnalysis data={data} />
          <div className="grid gap-x-10 gap-y-14 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            <ProgressSplit students={students.data} />
            <TopImprovers students={data.top_improvers} />
            <RecentReviews items={data.recent_reviews} />
          </div>
        </>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-14 md:gap-16" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="grid gap-9 md:gap-11">
        <div className="grid gap-3.5 pt-8 md:pt-12">
          <Skeleton className="h-9 w-80 max-w-full md:h-12 md:w-[460px]" />
          <Skeleton className="h-6 w-[480px] max-w-full" />
        </div>
        <SoftPanel className="grid gap-4">
          <Skeleton className="h-7 w-40" />
          <div className="grid gap-3.5 md:grid-cols-2">
            <Skeleton className="h-[220px] rounded-card" />
            <Skeleton className="h-[220px] rounded-card" />
          </div>
        </SoftPanel>
      </div>
      <div className="grid gap-7">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[140px] rounded-card" />
          ))}
        </div>
      </div>
      <div className="grid gap-7">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-[260px] rounded-card" />
          <Skeleton className="h-[260px] rounded-card" />
        </div>
      </div>
    </div>
  )
}
