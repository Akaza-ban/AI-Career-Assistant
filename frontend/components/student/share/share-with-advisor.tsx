"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import {
  AdvisorCard,
  AdvisorFeedbackPanel,
  SharedItemsPanel,
  SharingNote,
} from "@/components/student/share/share-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { AdvisorFeedback, SharedItem } from "@/lib/types"
import { useApi } from "@/lib/use-api"

// Figma: frame "Chia sẻ với Cố vấn" (18:4399). Cố vấn luôn thấy số liệu tổng hợp; nội dung chỉ thấy khi SV bật chia sẻ.
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
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được thông tin chia sẻ</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 py-2">
        <div className="grid max-w-3xl gap-2">
          <h1 className="font-heading text-[32px] leading-10 font-bold">Chia sẻ với Cố vấn</h1>
          <p className="text-sm text-ink-2">
            {/* Chủ động cấp quyền xem CV và báo cáo phỏng vấn để cố vấn đồng hành và nhận xét giúp bạn cải thiện. */}
          </p>
        </div>
        <SharingNote />
      </header>

      {!data ? (
        <ShareSkeleton />
      ) : (
        <>
          <AdvisorCard advisor={data.advisor} />
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <SharedItemsPanel items={items} pendingIds={pending} onChange={changeSharing} />
            <AdvisorFeedbackPanel feedback={feedback} onOpen={openFeedback} />
          </div>
        </>
      )}
    </div>
  )
}

function ShareSkeleton() {
  return (
    <div className="grid gap-8" aria-busy="true" aria-label="Đang tải thông tin chia sẻ">
      <Skeleton className="h-32 rounded-[20px]" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[560px] rounded-[20px]" />
        <Skeleton className="h-[360px] rounded-[20px]" />
      </div>
    </div>
  )
}
