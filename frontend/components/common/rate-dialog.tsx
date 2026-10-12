"use client"

import { useCallback, useState } from "react"
import { Check, Loader2, MessageSquareHeart, Star, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { LOW_SCORE, MAX_COMMENT_CHARS, REASONS, REASON_LABELS, STAR_LABELS } from "@/lib/feedback"
import type { CsatActivity } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

interface RateTarget {
  /** Mã lượt được đánh giá (mỗi lượt chỉ đánh giá một lần). */
  responseId: string
  activity: CsatActivity
  /** Tiêu đề hộp đánh giá, ví dụ "Đánh giá lượt phân tích". */
  title: string
  /** Dòng phụ dưới tiêu đề, ví dụ "Business Analyst Intern · CV v2.1". */
  subtitle?: string
  /** Hỏi thêm "Bạn có dùng lại không?" (buổi phỏng vấn). */
  askReuse?: boolean
}

/**
 * Dòng đánh giá gọn trong trang (bản vẽ DanhGiaPhanTich / DanhGiaToiUu): câu hỏi một bên, nút "Đánh giá" bên kia;
 * bấm mới mở hộp chấm sao. Đã đánh giá thì khoá nút. stacked: xếp dọc cho cột hẹp.
 */
export function RateRow({
  question,
  buttonLabel,
  doneLabel = "lượt này",
  stacked = false,
  className,
  ...target
}: RateTarget & {
  question: string
  buttonLabel: string
  /** "Bạn đã đánh giá {doneLabel} 4 sao." */
  doneLabel?: string
  stacked?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState<number | null>(null)
  const fetchSaved = useCallback(() => api.getFeedback(target.responseId, "csat"), [target.responseId])
  const { data: saved } = useApi(fetchSaved)
  const rated = submitted ?? saved?.value ?? null

  return (
    <div
      className={cn(
        "flex gap-4",
        stacked ? "flex-col items-start gap-3" : "flex-wrap items-center justify-between",
        className,
      )}
    >
      <p className="text-ink-2">{rated ? `Bạn đã đánh giá ${doneLabel} ${rated} sao. Cảm ơn bạn!` : question}</p>
      <Button variant="soft" size="brand" onClick={() => setOpen(true)} disabled={rated !== null || !saved}>
        <MessageSquareHeart strokeWidth={1.75} aria-hidden />
        {rated ? "Đã đánh giá" : buttonLabel}
      </Button>
      <RateDialog {...target} open={open} onOpenChange={setOpen} onSubmitted={setSubmitted} />
    </div>
  )
}

/**
 * Hộp chấm sao (US-SV-06). 1–3 sao: hỏi "Điều gì chưa ổn?" kèm lý do chọn nhanh; 4–5 sao: "Điều gì hữu ích nhất?".
 * Nhận xét luôn không bắt buộc; quản trị viên chỉ thấy nội dung, không thấy tên sinh viên.
 */
export function RateDialog({
  open,
  onOpenChange,
  onSubmitted,
  ...target
}: RateTarget & { open: boolean; onOpenChange: (open: boolean) => void; onSubmitted: (value: number) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4 rounded-panel p-6 shadow-dialog ring-line sm:max-w-[520px] sm:p-[26px]">
        {open && (
          <RateForm
            {...target}
            onDone={(value) => {
              onSubmitted(value)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RateForm({ responseId, activity, title, subtitle, askReuse, onDone }: RateTarget & { onDone: (value: number) => void }) {
  const [value, setValue] = useState(0)
  const [hover, setHover] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState("")
  const [reuse, setReuse] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const shown = hover || value
  const low = value > 0 && value <= LOW_SCORE

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

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
        tags: low && tags.length ? tags : undefined,
        would_reuse: askReuse && reuse !== null ? reuse : undefined,
      })
      toast.success(res.already_submitted ? "Bạn đã đánh giá lượt này trước đó." : "Cảm ơn bạn đã đánh giá!")
      onDone(res.value)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được đánh giá.")
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">{title}</DialogTitle>
          {subtitle && <DialogDescription className="mt-1 text-[15px] leading-6 text-ink-2">{subtitle}</DialogDescription>}
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="-mt-1 -mr-1 size-9 rounded-full text-ink-3 hover:text-ink" />}
          aria-label="Đóng"
        >
          <X className="size-[18px]" strokeWidth={1.75} />
        </DialogClose>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div role="radiogroup" aria-label="Chọn số sao" className="-ml-1.5 flex" onMouseLeave={() => setHover(0)}>
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
              <Star className={cn("size-8", n <= shown ? "fill-gold text-gold" : "text-line-strong")} aria-hidden />
            </button>
          ))}
        </div>
        <span className="text-sm text-ink-2">{shown ? STAR_LABELS[shown - 1] : "Chọn từ 1 đến 5 sao"}</span>
      </div>

      {value > 0 && (
        <>
          <p className="text-[15px] font-semibold text-ink">
            {low ? "Điều gì chưa ổn?" : "Điều gì hữu ích nhất với bạn?"}{" "}
            <span className="font-normal text-ink-3">{low ? "Chọn một hoặc nhiều lý do" : "Không bắt buộc"}</span>
          </p>
          {low && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Lý do">
              {REASONS[activity].map((tag) => {
                const on = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "inline-flex h-[34px] items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
                      on ? "bg-ink text-white" : "bg-card text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
                    {REASON_LABELS[tag]}
                  </button>
                )
              })}
            </div>
          )}
          <div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={MAX_COMMENT_CHARS}
              aria-label="Nhận xét của bạn"
              placeholder={
                low ? "Kể thêm để chúng tôi sửa đúng chỗ (không bắt buộc)" : "Ví dụ: phần gợi ý câu viết lại giúp mình sửa CV nhanh"
              }
              className="min-h-[92px] rounded-xl border-line-strong bg-card px-3.5 py-3 text-[15px]"
            />
            <div className="mt-1.5 flex justify-between gap-3 text-[13px] text-ink-3">
              <span>Quản trị viên chỉ xem nội dung, không thấy tên bạn.</span>
              <span className="tabular-nums">
                {comment.length}/{MAX_COMMENT_CHARS}
              </span>
            </div>
          </div>
          {askReuse && (
            <div className="flex flex-wrap items-center gap-2.5 text-sm">
              <span className="text-ink-2">Bạn có dùng lại không?</span>
              {[
                { v: true, label: "Có" },
                { v: false, label: "Không" },
              ].map(({ v, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={reuse === v}
                  onClick={() => setReuse(reuse === v ? null : v)}
                  className={cn(
                    "inline-flex h-[34px] items-center gap-1.5 rounded-full px-3.5 font-medium transition-colors",
                    reuse === v ? "bg-ink text-white" : "bg-card text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-panel",
                  )}
                >
                  {reuse === v && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
        <DialogClose render={<Button type="button" variant="soft" size="brand" disabled={busy} />}>Để sau</DialogClose>
        <Button size="brand" onClick={submit} disabled={!value || busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Gửi đánh giá
        </Button>
      </div>
    </>
  )
}
