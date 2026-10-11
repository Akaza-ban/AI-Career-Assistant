"use client"

import { useState } from "react"
import { Loader2, Star } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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

/** S7b — khảo sát CSAT: 1–5 sao và nhận xét tuỳ chọn (US-SV-06). */
export function CsatDialog({ responseId, activity, open, onOpenChange, onSubmitted }: CsatDialogProps) {
  const [value, setValue] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState("")
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
      <DialogContent showCloseButton={false} className="gap-0 rounded-panel p-0 shadow-dialog ring-line sm:max-w-[460px]">
        <div className="grid gap-6 px-6 pt-6 pb-6">
          <div className="grid gap-1.5">
            <DialogTitle className="font-heading text-xl leading-7 font-semibold tracking-[-0.01em] text-ink">
              Bạn thấy buổi này thế nào?
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-6 text-ink-2">
              Đánh giá giúp phản hồi sát thực tế tuyển dụng hơn.
            </DialogDescription>
          </div>

          <div className="grid justify-items-center gap-1.5 rounded-card bg-panel py-4">
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
                  className="grid size-11 place-items-center rounded-lg transition-transform hover:scale-110"
                >
                  <Star className={cn("size-8", n <= shown ? "fill-warn text-warn" : "text-line-strong")} aria-hidden />
                </button>
              ))}
            </div>
            <span className="h-5 text-sm font-medium text-ink-2">{shown ? STAR_LABELS[shown - 1] : "Chọn từ 1 đến 5 sao"}</span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="csat-comment" className="text-sm font-medium text-ink">
              Nhận xét <span className="font-normal text-ink-3">(tuỳ chọn)</span>
            </Label>
            <Textarea
              id="csat-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              placeholder="Điều bạn thấy hữu ích hoặc cần cải thiện…"
              className="min-h-24 rounded-[10px] border-line-strong bg-card text-[15px]"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2.5 px-6 pb-6 sm:flex-row sm:justify-end">
          <Button variant="soft" size="brand" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button size="brand" onClick={submit} disabled={!value || busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Gửi đánh giá
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
