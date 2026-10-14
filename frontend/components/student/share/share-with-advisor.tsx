"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import {
  AdvisorCard,
  AdvisorVisibility,
  RecentActivity,
  ShareZone,
} from "@/components/student/share/share-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { AdvisorFeedback, SharedItem } from "@/lib/types"
import { useApi } from "@/lib/use-api"

// Bản vẽ ChiaSe. Cố vấn luôn thấy số liệu tổng hợp; nội dung chỉ thấy khi SV bật chia sẻ.
export function ShareWithAdvisor() {
  const { data, error, reload } = useApi(api.getSharing)
  // Danh sách sau lần cập nhật gần nhất; null = dùng dữ liệu vừa tải.
  const [updatedItems, setItems] = useState<SharedItem[] | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const items = updatedItems ?? data?.items ?? []
  const feedback: AdvisorFeedback[] = (data?.feedback ?? []).map((f) => (readIds.has(f.id) ? { ...f, read: true } : f))

  async function changeSharing(ids: string[], shared: boolean) {
    if (ids.length === 0) return
    const previous = items
    setItems(items.map((i) => (ids.includes(i.id) ? { ...i, shared } : i)))
    setPending((p) => new Set([...p, ...ids]))
    try {
      setItems(await api.updateSharing({ item_ids: ids, shared }))
      const what = ids.length === 1 ? "Tài liệu" : `${ids.length} tài liệu`
      toast.success(shared ? `${what} đã được chia sẻ với cố vấn.` : `${what} đã chuyển về chế độ riêng tư.`)
    } catch (err) {
      setItems(previous)
      toast.error(err instanceof Error ? err.message : "Không cập nhật được quyền chia sẻ.")
    } finally {
      setPending((p) => new Set([...p].filter((id) => !ids.includes(id))))
    }
  }

  function openFeedback(id: string) {
    setReadIds((ids) => new Set(ids).add(id))
    void api.markAdvisorFeedbackRead(id).catch(() => undefined)
  }

  if (error) {
    return (
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được thông tin chia sẻ"
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

  return (
    <div className="grid gap-9 md:gap-11">
      <PageHeader
        title="Chia sẻ với cố vấn"
        description="Mặc định không chia sẻ gì. Bạn chọn từng mục cố vấn được xem."
      />

      {!data ? (
        <ShareSkeleton />
      ) : (
        <div className="grid gap-14 md:gap-16">
          <AdvisorCard advisor={data.advisor} />
          <div className="flex flex-wrap items-start gap-14">
            <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-14">
              <ShareZone kind="cv" items={items} pendingIds={pending} onChange={changeSharing} />
              <ShareZone kind="interview_report" items={items} pendingIds={pending} onChange={changeSharing} />
            </div>
            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-11 lg:max-w-[380px]">
              <AdvisorVisibility />
              <RecentActivity advisor={data.advisor} feedback={feedback} items={items} onOpen={openFeedback} />
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}

function ShareSkeleton() {
  return (
    <div className="grid gap-14" aria-busy="true" aria-label="Đang tải thông tin chia sẻ">
      <Skeleton className="h-[88px] max-w-[980px] rounded-card" />
      <div className="flex flex-wrap gap-14">
        <div className="grid min-w-0 flex-[999_1_520px] gap-3">
          <Skeleton className="h-8 w-24" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-[10px]" />
          ))}
        </div>
        <div className="grid min-w-0 flex-[1_1_300px] content-start gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-28 rounded-[10px]" />
        </div>
      </div>
    </div>
  )
}
