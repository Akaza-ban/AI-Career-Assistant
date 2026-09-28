"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { AlertCircle, Download, Lock, MessagesSquare, TrendingUp } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import {
  CvComparisonCard,
  InterviewLog,
  MilestoneTimeline,
  ProgressMetrics,
  ScoreTrendChart,
  StarCompareCard,
} from "@/components/student/history/history-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { features } from "@/lib/features"
import { formatTime, isToday } from "@/lib/format"
import type { ProgressRange } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: "30d", label: "30 ngày qua" },
  { value: "90d", label: "90 ngày" },
  { value: "all", label: "Toàn bộ quá trình" },
]

// Figma: frame "Lịch sử & Tiến bộ" (18:3779).
export function StudentHistory() {
  const [range, setRange] = useState<ProgressRange>("30d")
  const fetchProgress = useCallback(() => api.getProgress(range), [range])
  const { data: progress, error, reload } = useApi(fetchProgress)
  // Giữ dữ liệu khoảng cũ trên màn hình trong lúc tải khoảng mới, tránh nháy skeleton.
  const stale = progress !== undefined && progress.range !== range

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được lịch sử luyện tập</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  const updated = progress && (isToday(progress.updated_at) ? `Hôm nay, ${formatTime(progress.updated_at)}` : new Date(progress.updated_at).toLocaleString("vi-VN"))

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-2xl gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <Badge variant="violet" className="h-auto px-2.5 py-0.5">
              <TrendingUp aria-hidden />
              Báo cáo tiến bộ
            </Badge>
            {updated && <span>Cập nhật: {updated}</span>}
          </p>
          <h1 className="font-heading text-[28px] leading-9 font-bold">Lịch sử & Tiến bộ</h1>
          <p className="text-sm text-ink-2">
            Theo dõi điểm phỏng vấn STAR và mức độ hoàn thiện CV của bạn qua từng mốc thời gian.
          </p>
        </div>
        <div className="grid justify-items-end gap-2">
          <div role="group" aria-label="Khoảng thời gian" className="flex rounded-xl bg-blue-soft/60 p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={range === r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  range === r.value ? "bg-card text-blue shadow-card" : "text-ink-2 hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {features.progressPdf && (
            <Button variant="outline" className="h-9" onClick={() => toast.info("Đang tạo báo cáo PDF…")}>
              <Download aria-hidden />
              Xuất báo cáo (PDF)
            </Button>
          )}
        </div>
      </header>

      {!progress ? (
        <HistorySkeleton />
      ) : progress.session_count === 0 && !progress.cv_comparison ? (
        <EmptyHistory />
      ) : (
        <div className={cn("grid gap-6 transition-opacity", stale && "pointer-events-none opacity-60")} aria-busy={stale}>
          <ProgressMetrics progress={progress} />
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {progress.session_count > 0 ? (
              <ScoreTrendChart progress={progress} />
            ) : (
              <Panel className="grid place-items-center text-sm text-ink-2">Chưa có buổi phỏng vấn nào trong khoảng này.</Panel>
            )}
            <StarCompareCard progress={progress} />
          </div>
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <CvComparisonCard comparison={progress.cv_comparison} />
            <MilestoneTimeline milestones={progress.milestones} />
          </div>
          <InterviewLog key={progress.range} interviews={progress.interviews} />
        </div>
      )}

      <p className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-line bg-card px-5 py-3 text-xs text-ink-2">
        <span className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-violet" aria-hidden />
          Cố vấn chỉ xem được dữ liệu tiến bộ khi bạn cho phép trong mục Chia sẻ với Cố vấn.
        </span>
        <Link href="/student/settings" className="font-medium text-blue hover:underline">
          Cài đặt quyền riêng tư
        </Link>
      </p>
    </div>
  )
}

function EmptyHistory() {
  return (
    <Panel className="grid justify-items-center gap-3 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-violet-soft text-violet">
        <MessagesSquare className="size-6" aria-hidden />
      </span>
      <p className="font-heading text-lg font-bold">Chưa có dữ liệu tiến bộ</p>
      <p className="max-w-md text-sm text-ink-2">
        Hoàn thành buổi phỏng vấn thử đầu tiên để bắt đầu theo dõi điểm STAR. Mỗi buổi tiếp theo sẽ được so sánh với mốc này.
      </p>
      <Button variant="violet" size="brand" nativeButton={false} render={<Link href="/student/interview/new" />}>
        Bắt đầu luyện phỏng vấn
      </Button>
    </Panel>
  )
}

function HistorySkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải lịch sử">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[132px] rounded-[20px]" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[400px] rounded-[20px]" />
        <Skeleton className="h-[400px] rounded-[20px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[360px] rounded-[20px]" />
        <Skeleton className="h-[360px] rounded-[20px]" />
      </div>
      <Skeleton className="h-[420px] rounded-[20px]" />
    </div>
  )
}
