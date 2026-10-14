"use client"

import { useCallback, useRef, useState } from "react"
import { CheckCheck, Clock, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { ChoiceChip, dayMonth } from "@/components/advisor/profile/profile-bits"
import { ReportPane } from "@/components/advisor/profile/review-report"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import type { AdvisorInterviewRow, AdvisorReviewInfo } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const MIN_COMMENT = 10
const MAX_COMMENT = 2000

/** Mẫu câu bấm để chèn vào ô nhận xét. */
const TEMPLATES: { label: string; text: string }[] = [
  { label: "Nêu rõ kết quả", text: "Em nên nêu rõ kết quả đạt được, tốt nhất bằng số liệu cụ thể." },
  { label: "Tách vai trò cá nhân", text: "Em hãy tách rõ phần việc của riêng em với phần việc của cả nhóm." },
  { label: "Rút gọn bối cảnh", text: "Phần bối cảnh có thể rút gọn lại để dành thời gian cho hành động và kết quả." },
  { label: "Khen điểm mạnh", text: "Em trình bày mạch lạc, đúng cấu trúc STAR. Giữ cách trả lời này nhé." },
]

interface ReviewDialogProps {
  studentId: string
  studentName: string
  avatarUrl?: string | null
  /** Buổi đang xem / nhận xét; null = đóng. */
  item: AdvisorInterviewRow | null
  onClose: () => void
  onReviewed: (sessionId: string, review: AdvisorReviewInfo) => void
}

/**
 * Bản vẽ NhanXetPV: trái là báo cáo đầy đủ của buổi SV đã chia sẻ, phải là ô nhận xét của cố vấn.
 * Điểm AI giữ nguyên. Điện thoại: toàn màn hình, hai cột xếp dọc.
 */
export function ReviewDialog({ item, onClose, ...rest }: ReviewDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden rounded-panel p-0 text-[15px] leading-6 text-ink shadow-dialog ring-line sm:max-w-[1120px]",
          "max-h-[calc(100dvh-112px)] md:h-[900px]",
          "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
        )}
      >
        {item && <ReviewBody key={item.id} item={item} onClose={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviewBody({
  studentId,
  studentName,
  avatarUrl,
  item,
  onClose,
  onReviewed,
}: Omit<ReviewDialogProps, "item"> & { item: AdvisorInterviewRow }) {
  const fetchReport = useCallback(() => api.getAdvisorInterviewReport(studentId, item.id), [studentId, item.id])
  const { data: report, error, reload } = useApi(fetchReport)
  const review = item.review

  return (
    <>
      <header className="flex shrink-0 items-center gap-3.5 border-b border-line px-5 py-4 sm:px-6 sm:py-5">
        <UserAvatar
          name={studentName}
          src={avatarUrl}
          className="size-10 [&_[data-slot=avatar-fallback]]:bg-blue-soft [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-accent-strong"
        />
        <div className="min-w-0 flex-1">
          <DialogTitle className="text-lg leading-7 font-semibold text-ink">
            {review ? "Nhận xét đã gửi" : "Nhận xét buổi phỏng vấn"}
          </DialogTitle>
          <DialogDescription className="truncate text-sm text-ink-3">
            {studentName} · {item.jd.title} · {dayMonth(item.completed_at)}
            {report && ` · ${report.turns.length} câu`}
          </DialogDescription>
        </div>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-ink-3 hover:text-ink" />}
          aria-label="Đóng"
        >
          <X className="size-[18px]" strokeWidth={1.75} />
        </DialogClose>
      </header>
      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:overflow-hidden">
        <div className="p-5 sm:p-6 md:overflow-y-auto md:border-r md:border-line">
          <ReportPane report={report} error={error} onRetry={reload} overall={item.overall_score} />
        </div>
        <ReviewForm
          studentId={studentId}
          studentName={studentName}
          item={item}
          review={review}
          onClose={onClose}
          onReviewed={onReviewed}
        />
      </div>
    </>
  )
}

function ReviewForm({
  studentId,
  studentName,
  item,
  review,
  onClose,
  onReviewed,
}: {
  studentId: string
  studentName: string
  item: AdvisorInterviewRow
  review: AdvisorReviewInfo | null
  onClose: () => void
  onReviewed: (sessionId: string, review: AdvisorReviewInfo) => void
}) {
  const editing = review !== null
  const [comment, setComment] = useState(review?.comment ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)

  const length = comment.trim().length
  const error =
    length < MIN_COMMENT
      ? `Nhận xét cần ít nhất ${MIN_COMMENT} ký tự.`
      : length > MAX_COMMENT
        ? `Nhận xét tối đa ${MAX_COMMENT} ký tự.`
        : null
  const unchanged = editing && comment.trim() === review.comment

  /** Chèn mẫu câu tại vị trí con trỏ (hoặc cuối đoạn), cách bằng một khoảng trắng. */
  function insert(text: string) {
    const el = input.current
    const start = el ? el.selectionStart : comment.length
    const end = el ? el.selectionEnd : comment.length
    const before = comment.slice(0, start)
    const after = comment.slice(end)
    const glue = before && !/\s$/.test(before) ? " " : ""
    const next = `${before}${glue}${text}${after && !/^\s/.test(after) ? " " : ""}${after}`
    setComment(next)
    const caret = before.length + glue.length + text.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  async function submit() {
    setSubmitted(true)
    if (error) return
    if (unchanged) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const saved = await api.reviewInterview(studentId, item.id, { comment })
      onReviewed(item.id, saved)
      toast.success(editing ? `Đã cập nhật nhận xét cho ${studentName}.` : `Đã gửi nhận xét cho ${studentName}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được nhận xét.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-panel p-5 sm:p-6 md:min-h-0 md:overflow-y-auto">
      <div>
        <p className="font-semibold text-ink">
          <label htmlFor="review-comment">Nhận xét của bạn</label>
        </p>
        <p className="text-[13px] leading-5 text-ink-3">
          Sinh viên sẽ thấy nhận xét này trong báo cáo. Điểm AI giữ nguyên.
          {editing && " Sau khi sửa, sinh viên sẽ thấy như bản mới chưa đọc."}
        </p>
      </div>
      {review && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
          <span>
            {review.updated_at !== review.created_at ? "Sửa" : "Gửi"} {formatRelativeTime(review.updated_at).toLowerCase()}
          </span>
          {review.seen_at ? (
            <span className="flex items-center gap-1 text-good">
              <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden />
              Sinh viên đã xem {formatRelativeTime(review.seen_at).toLowerCase()}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
              Sinh viên chưa xem
            </span>
          )}
        </p>
      )}
      <div role="group" aria-label="Mẫu câu" className="flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <ChoiceChip key={t.label} onClick={() => insert(t.text)} aria-label={`Chèn: ${t.text}`}>
            {t.label}
          </ChoiceChip>
        ))}
      </div>
      <textarea
        id="review-comment"
        ref={input}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Viết nhận xét cho sinh viên…"
        aria-invalid={submitted && error ? true : undefined}
        aria-describedby="review-comment-hint"
        maxLength={MAX_COMMENT + 200}
        className="block min-h-[220px] w-full flex-1 resize-y rounded-[10px] border border-line-strong bg-card px-3.5 py-3 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-3 focus-visible:border-ink-3 focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-bad"
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <p id="review-comment-hint" className="mr-auto text-[13px] tabular-nums">
          {submitted && error ? (
            <span className="text-bad">{error}</span>
          ) : (
            <span className={length > MAX_COMMENT ? "text-bad" : "text-ink-3"}>
              {length} / {MAX_COMMENT}
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          size="brand"
          className="bg-card text-ink ring-1 ring-line-strong ring-inset hover:bg-panel"
          onClick={onClose}
          disabled={saving}
        >
          Huỷ
        </Button>
        <Button size="brand" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Lưu nhận xét" : "Gửi nhận xét"}
        </Button>
      </div>
    </div>
  )
}
