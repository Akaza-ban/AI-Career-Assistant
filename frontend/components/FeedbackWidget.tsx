"use client"

import { useCallback, useState } from "react"
import { CircleCheck, Loader2, Smile, Star, ThumbsDown, ThumbsUp } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { FeedbackRequest } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// B3: phản hồi cho từng response_id.
//  - variant "thumbs": 👍/👎 nhỏ gọn dưới mỗi phản hồi của AI.
//  - variant "stars": khảo sát CSAT 1–5 sao sau mỗi lượt dùng (PRD US-SV-06).
// Gửi rồi thì khoá lại và hiển thị lại lựa chọn cũ (US-SV-06 AC3). Bỏ qua không chặn thao tác khác (AC2).

type Props =
  | { variant: "thumbs"; responseId: string; className?: string }
  | {
      variant: "stars"
      responseId: string
      activity: "gap_analysis" | "interview"
      title?: string
      description?: string
      className?: string
    }

export function FeedbackWidget(props: Props) {
  return props.variant === "thumbs" ? <Thumbs {...props} /> : <Stars {...props} />
}

function useSavedFeedback(responseId: string, kind: "thumb" | "csat") {
  const fetchStatus = useCallback(() => api.getFeedback(responseId, kind), [responseId, kind])
  return useApi(fetchStatus)
}

async function send(body: FeedbackRequest): Promise<number | null> {
  try {
    const res = await api.sendFeedback(body)
    if (res.already_submitted) toast.info("Bạn đã gửi đánh giá cho mục này trước đó.")
    return res.value
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không gửi được đánh giá.")
    return null
  }
}

function Thumbs({ responseId, className }: { responseId: string; className?: string }) {
  const { data: saved } = useSavedFeedback(responseId, "thumb")
  const [value, setValue] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const current = value ?? saved?.value ?? null

  async function choose(v: 1 | -1) {
    if (current !== null || busy) return
    setBusy(true)
    const stored = await send({ response_id: responseId, kind: "thumb", value: v })
    if (stored !== null) setValue(stored)
    setBusy(false)
  }

  const options = [
    { v: 1 as const, icon: ThumbsUp, label: "Phản hồi hữu ích", active: "bg-good-soft text-good" },
    { v: -1 as const, icon: ThumbsDown, label: "Phản hồi chưa hữu ích", active: "bg-bad-soft text-bad" },
  ]

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Đánh giá phản hồi của AI">
      {options.map(({ v, icon: Icon, label, active }) => (
        <button
          key={v}
          type="button"
          aria-label={label}
          aria-pressed={current === v}
          disabled={current !== null || busy}
          onClick={() => choose(v)}
          className={cn(
            "grid size-7 place-items-center rounded-md text-ink-3 transition-colors",
            current === v ? active : "enabled:hover:bg-surface enabled:hover:text-ink",
            current !== null && current !== v && "opacity-40",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
      {current !== null && <span className="text-xs text-ink-3">Cảm ơn bạn!</span>}
    </div>
  )
}

const STAR_LABELS = ["Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Rất hữu ích"]

function Stars({
  responseId,
  activity,
  title = "Bạn đánh giá lượt sử dụng này hữu ích đến mức nào?",
  description = "Đánh giá của bạn giúp hệ thống phản hồi sát thực tế tuyển dụng hơn.",
  className,
}: {
  responseId: string
  activity: "gap_analysis" | "interview"
  title?: string
  description?: string
  className?: string
}) {
  const { data: saved, loading } = useSavedFeedback(responseId, "csat")
  const [hover, setHover] = useState(0)
  const [picked, setPicked] = useState(0)
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = submitted ?? saved?.value ?? null
  const shown = locked ?? (hover || picked)

  async function submit() {
    if (!picked) return
    setBusy(true)
    const stored = await send({ response_id: responseId, kind: "csat", value: picked as 1 | 2 | 3 | 4 | 5, activity })
    if (stored !== null) {
      setSubmitted(stored)
      toast.success("Cảm ơn bạn đã đánh giá!")
    }
    setBusy(false)
  }

  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-line bg-card p-5 shadow-card",
        className,
      )}
      aria-label="Khảo sát mức độ hài lòng"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
          <Smile className="size-5" aria-hidden />
        </span>
        <div className="grid gap-0.5">
          <h2 className="font-heading text-base font-bold">{title}</h2>
          <p className="text-xs text-ink-2">{locked ? "Bạn đã gửi đánh giá cho lượt này." : description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div
          role="radiogroup"
          aria-label="Chọn số sao"
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={shown === n}
              aria-label={`${n} sao – ${STAR_LABELS[n - 1]}`}
              disabled={locked !== null || loading}
              onMouseEnter={() => setHover(n)}
              onClick={() => setPicked(n)}
              className="grid size-8 place-items-center rounded-md enabled:hover:bg-surface"
            >
              <Star
                className={cn("size-6 transition-colors", n <= shown ? "fill-gold text-gold" : "text-line")}
                aria-hidden
              />
            </button>
          ))}
        </div>
        {locked ? (
          <span className="flex items-center gap-1 text-sm font-medium text-good">
            <CircleCheck className="size-4" aria-hidden />
            Đã gửi
          </span>
        ) : (
          <Button variant="soft" className="h-9" disabled={!picked || busy} onClick={submit}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Gửi đánh giá
          </Button>
        )}
      </div>
      {shown > 0 && !locked && <p className="w-full text-right text-xs text-ink-2">{STAR_LABELS[shown - 1]}</p>}
    </section>
  )
}
