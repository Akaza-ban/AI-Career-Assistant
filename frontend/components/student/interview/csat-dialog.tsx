"use client"

import { useState } from "react"
import { Loader2, Star } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

const STAR_LABELS = ["Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Rất hài lòng"]

interface CsatDialogProps {
  responseId: string
  activity: "gap_analysis" | "interview"
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Gọi sau khi lưu xong, kèm số sao đang được lưu. */
  onSubmitted: (value: number) => void
}

/** S7b — khảo sát CSAT: 1–5 sao, nhận xét tuỳ chọn, "Bạn có dùng lại không?" (US-SV-06). */
export function CsatDialog({ responseId, activity, open, onOpenChange, onSubmitted }: CsatDialogProps) {
  const [value, setValue] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
  const [wouldReuse, setWouldReuse] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const shown = hover || value

  async function submit() {
    if (!value || busy) return
    setBusy(true)
    try {
      const res = await api.sendFeedback({
        response_id: responseId,
        kind: "csat",
        value: value as 1 | 2 | 3 | 4 | 5,
        activity,
        comment: comment.trim() || undefined,
        would_reuse: wouldReuse ?? undefined,
      })
      toast.success(res.already_submitted ? "Bạn đã đánh giá buổi này trước đó." : "Cảm ơn bạn đã đánh giá!")
      onSubmitted(res.value)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được đánh giá.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bạn hài lòng với trải nghiệm này thế nào?</DialogTitle>
          <DialogDescription>Đánh giá của bạn giúp hệ thống phản hồi sát thực tế tuyển dụng hơn.</DialogDescription>
        </DialogHeader>

        <div className="grid justify-items-center gap-1.5">
          <div role="radiogroup" aria-label="Chọn số sao" className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n} sao – ${STAR_LABELS[n - 1]}`}
                onMouseEnter={() => setHover(n)}
                onClick={() => setValue(n)}
                className="grid size-10 place-items-center rounded-lg hover:bg-warn-soft/60"
              >
                <Star className={cn("size-7", n <= shown ? "fill-warn text-warn" : "text-ink-3")} aria-hidden />
              </button>
            ))}
          </div>
          <span className="h-5 text-sm text-ink-2">{shown ? STAR_LABELS[shown - 1] : "Chọn từ 1 đến 5 sao"}</span>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="csat-comment" className="text-xs font-semibold">
            Nhận xét <span className="font-normal text-ink-3">(tuỳ chọn)</span>
          </Label>
          <Textarea
            id="csat-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Điều bạn thấy hữu ích hoặc cần cải thiện…"
            className="min-h-20 bg-surface text-sm"
          />
        </div>

        <div className="grid gap-1.5">
          <p className="text-xs font-semibold text-ink">
            Bạn có sẽ dùng lại không? <span className="font-normal text-ink-3">(tuỳ chọn)</span>
          </p>
          <div role="radiogroup" aria-label="Bạn có sẽ dùng lại không?" className="flex gap-2">
            {[
              { v: true, label: "Có" },
              { v: false, label: "Không" },
            ].map(({ v, label }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={wouldReuse === v}
                onClick={() => setWouldReuse(wouldReuse === v ? null : v)}
                className={cn(
                  "rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors",
                  wouldReuse === v ? "border-blue bg-blue-soft text-blue" : "border-line text-ink-2 hover:border-blue/40",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="soft" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button onClick={submit} disabled={!value || busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Gửi đánh giá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
