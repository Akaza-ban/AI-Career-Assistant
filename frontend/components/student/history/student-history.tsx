"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { AlertCircle, Lock, MessagesSquare, TrendingUp } from "lucide-react"

import { Panel } from "@/components/common/panel"
import {
  AnalysisTable,
  CvProgressSection,
  InterviewProgressSection,
  InterviewTable,
} from "@/components/student/history/history-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatWhen } from "@/lib/format"
import type { ProgressRange } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const RANGES: { value: ProgressRange; label: string }[] = [
  { value: "30d", label: "30 ngày qua" },
  { value: "90d", label: "90 ngày" },
  { value: "all", label: "Toàn bộ quá trình" },
]
const ALL_POSITIONS = "all"

// Figma: frame "Lịch sử & Tiến bộ" (18:3779). Điểm STAR thang 0–5, so sánh trong từng vị trí (PRD mục 5.1).
export function StudentHistory() {
  const [range, setRange] = useState<ProgressRange>("all")
  const [jdId, setJdId] = useState<string | null>(null)
  const fetchProgress = useCallback(() => api.getProgress(range, jdId), [range, jdId])
  const { data: progress, error, reload } = useApi(fetchProgress)
  // Giữ dữ liệu bộ lọc cũ trên màn hình trong lúc tải bộ lọc mới, tránh nháy skeleton.
  const stale = progress !== undefined && (progress.range !== range || progress.jd_id !== jdId)

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

  const positionItems = [
    { value: ALL_POSITIONS, label: "Tất cả vị trí" },
    ...(progress?.positions ?? []).map((p) => ({ value: p.jd.id, label: p.jd.title })),
  ]
  const noActivity = progress !== undefined && progress.positions.length === 0

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-2xl gap-2">
          <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
            <Badge variant="violet" className="h-auto px-2.5 py-0.5">
              <TrendingUp aria-hidden />
              Báo cáo tiến bộ
            </Badge>
            {progress?.last_activity_at && <span>Hoạt động gần nhất: {formatWhen(progress.last_activity_at)}</span>}
          </p>
          <h1 className="font-heading text-[28px] leading-9 font-bold">Lịch sử & Tiến bộ</h1>
          <p className="text-sm text-ink-2">
            Theo dõi điểm phỏng vấn STAR và độ khớp CV với từng vị trí qua các lần luyện tập.
          </p>
        </div>
        {!noActivity && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              items={positionItems}
              value={jdId ?? ALL_POSITIONS}
              onValueChange={(v) => setJdId(v === ALL_POSITIONS ? null : String(v))}
            >
              <SelectTrigger className="h-10 min-w-52 bg-card" aria-label="Lọc theo vị trí">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {positionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
        )}
      </header>

      {!progress ? (
        <HistorySkeleton />
      ) : noActivity ? (
        <EmptyHistory />
      ) : (
        <div className={cn("grid gap-6 transition-opacity", stale && "pointer-events-none opacity-60")} aria-busy={stale}>
          <InterviewProgressSection groups={progress.interview_progress} />
          <CvProgressSection groups={progress.cv_progress} />
          {/* key: về trang 1 khi đổi bộ lọc */}
          <InterviewTable key={`iv-${progress.range}-${progress.jd_id}`} rows={progress.interviews} />
          <AnalysisTable key={`ga-${progress.range}-${progress.jd_id}`} rows={progress.analyses} />
        </div>
      )}

      <p className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-line bg-card px-5 py-3 text-xs text-ink-2">
        <span className="flex items-center gap-2">
          <Lock className="size-4 shrink-0 text-violet" aria-hidden />
          Cố vấn chỉ xem được báo cáo và CV mà bạn chọn chia sẻ.
        </span>
        <Link href="/student/share" className="font-medium text-blue hover:underline">
          Chia sẻ với cố vấn
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
        Phân tích CV với một JD hoặc hoàn thành buổi phỏng vấn thử đầu tiên. Mỗi lần tiếp theo sẽ được so sánh với lần trước
        của cùng vị trí.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="soft" size="brand" nativeButton={false} render={<Link href="/student/analysis/new" />}>
          Phân tích CV với JD
        </Button>
        <Button variant="violet" size="brand" nativeButton={false} render={<Link href="/student/interview/new" />}>
          Bắt đầu luyện phỏng vấn
        </Button>
      </div>
    </Panel>
  )
}

function HistorySkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Đang tải lịch sử">
      <Skeleton className="h-[380px] rounded-[20px]" />
      <Skeleton className="h-[240px] rounded-[20px]" />
      <Skeleton className="h-[360px] rounded-[20px]" />
    </div>
  )
}
