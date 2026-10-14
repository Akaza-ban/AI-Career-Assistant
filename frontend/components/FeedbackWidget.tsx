"use client"

import { useCallback, useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { ThumbActivity } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// B3: like / dislike cho từng phần nhỏ của kết quả AI (US-SV-06). Chấm sao cho cả lượt dùng nằm ở
// components/common/rate-dialog.tsx (dòng "Đánh giá" + hộp đánh giá).
//  - variant "thumbs": hai nút nhỏ dưới mỗi gợi ý / nhận xét / thẻ gợi ý vị trí.
//  - variant "question": một câu hỏi và hai nút Có / Chưa (cả bảng so sánh).
// Bấm nút kia để đổi, bấm lại nút đang chọn để huỷ (phòng bấm nhầm). Chấm sao mới là chỉ gửi một lần (AC3).

type Props =
  | {
      variant: "thumbs"
      responseId: string
      activity: ThumbActivity
      /** Câu hỏi nhỏ trước hai nút, ẩn sau khi đã chọn (ví dụ "Hợp với bạn?"). */
      prompt?: string
      className?: string
    }
  | { variant: "question"; responseId: string; activity: ThumbActivity; question: string; className?: string }

export function FeedbackWidget(props: Props) {
  return props.variant === "thumbs" ? <Thumbs {...props} /> : <Question {...props} />
}

/**
 * Lựa chọn hiện tại và hàm chọn: chọn nút mới thì gửi / đổi, chọn lại nút đang bật thì huỷ.
 * Cập nhật ngay trên giao diện; lỗi thì trả lại lựa chọn cũ.
 */
function useThumb(responseId: string, activity: ThumbActivity) {
  const fetchStatus = useCallback(() => api.getFeedback(responseId, "thumb"), [responseId])
  const { data: saved } = useApi(fetchStatus)
  // undefined: chưa đổi gì trong lần mở trang này, dùng giá trị đã lưu
  const [override, setOverride] = useState<number | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const current = override !== undefined ? override : (saved?.value ?? null)

  async function choose(v: 1 | -1) {
    if (busy) return
    const previous = current
    const next = current === v ? null : v
    setOverride(next)
    setBusy(true)
    try {
      if (next === null) await api.deleteThumb(responseId)
      else await api.sendFeedback({ response_id: responseId, kind: "thumb", value: next, activity })
    } catch (err) {
      setOverride(previous)
      toast.error(err instanceof Error ? err.message : "Không gửi được đánh giá.")
    } finally {
      setBusy(false)
    }
  }

  return { current, busy, choose }
}

function Thumbs({
  responseId,
  activity,
  prompt,
  className,
}: {
  responseId: string
  activity: ThumbActivity
  prompt?: string
  className?: string
}) {
  const { current, busy, choose } = useThumb(responseId, activity)
  const options = [
    { v: 1 as const, icon: ThumbsUp, label: "Hữu ích", active: "bg-good-soft text-good hover:bg-good-soft" },
    { v: -1 as const, icon: ThumbsDown, label: "Chưa hữu ích", active: "bg-bad-soft text-bad hover:bg-bad-soft" },
  ]

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label={prompt ?? "Đánh giá phản hồi của AI"}>
      {prompt && current === null && <span className="mr-0.5 text-[13px] text-ink-3">{prompt}</span>}
      {options.map(({ v, icon: Icon, label, active }) => (
        <button
          key={v}
          type="button"
          aria-label={current === v ? `${label} (bấm lại để huỷ)` : label}
          aria-pressed={current === v}
          disabled={busy}
          onClick={() => choose(v)}
          className={cn(
            "grid size-7 place-items-center rounded-md text-ink-3 transition-[color,background-color,opacity]",
            current === v ? active : "hover:bg-surface hover:text-ink",
            current !== null && current !== v && "opacity-40 hover:opacity-100",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
      {current !== null && <span className="text-xs text-ink-3">Cảm ơn bạn!</span>}
    </div>
  )
}

function Question({
  responseId,
  activity,
  question,
  className,
}: {
  responseId: string
  activity: ThumbActivity
  question: string
  className?: string
}) {
  const { current, busy, choose } = useThumb(responseId, activity)
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3.5", className)}>
      <p className="font-semibold text-ink">{question}</p>
      <div className="flex gap-2" role="group" aria-label={question}>
        {[
          { v: 1 as const, icon: ThumbsUp, label: "Có", active: "bg-good-soft text-good shadow-none" },
          { v: -1 as const, icon: ThumbsDown, label: "Chưa", active: "bg-bad-soft text-bad shadow-none" },
        ].map(({ v, icon: Icon, label, active }) => (
          <Button
            key={v}
            variant="outline"
            aria-pressed={current === v}
            disabled={busy}
            onClick={() => choose(v)}
            className={cn(
              "h-9 gap-1.5 rounded-full border-transparent bg-card px-3.5 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel disabled:opacity-100",
              current === v && active,
              current !== null && current !== v && "opacity-40 hover:opacity-100",
            )}
          >
            <Icon className="size-[15px]" strokeWidth={1.75} aria-hidden />
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}
