"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AdvisorInterviewRow, AdvisorReviewInfo } from "@/lib/types"

const MIN_COMMENT = 10
const MAX_COMMENT = 2000

interface ReviewDialogProps {
  studentId: string
  studentName: string
  /** Buổi đang nhận xét; null = đóng. */
  item: AdvisorInterviewRow | null
  onClose: () => void
  onReviewed: (sessionId: string, review: AdvisorReviewInfo) => void
}

/** Cố vấn viết hoặc sửa nhận xét cho một báo cáo SV đã chia sẻ. Điểm AI giữ nguyên. */
export function ReviewDialog({ studentId, studentName, item, onClose, onReviewed }: ReviewDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {item && (
          <ReviewForm
            key={item.id}
            studentId={studentId}
            studentName={studentName}
            item={item}
            onClose={onClose}
            onReviewed={onReviewed}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReviewForm({ studentId, studentName, item, onClose, onReviewed }: Omit<ReviewDialogProps, "item"> & { item: AdvisorInterviewRow }) {
  const editing = item.review !== null
  const [comment, setComment] = useState(item.review?.comment ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const length = comment.trim().length
  const error =
    length < MIN_COMMENT
      ? `Nhận xét cần ít nhất ${MIN_COMMENT} ký tự.`
      : length > MAX_COMMENT
        ? `Nhận xét tối đa ${MAX_COMMENT} ký tự.`
        : null
  const unchanged = editing && comment.trim() === item.review!.comment

  async function submit() {
    setSubmitted(true)
    if (error) return
    if (unchanged) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const review = await api.reviewInterview(studentId, item.id, { comment })
      onReviewed(item.id, review)
      toast.success(editing ? `Đã cập nhật nhận xét cho ${studentName}.` : `Đã gửi nhận xét cho ${studentName}.`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được nhận xét.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Sửa nhận xét" : "Nhận xét buổi phỏng vấn"}</DialogTitle>
        <DialogDescription>
          {item.jd.title} · {formatDate(item.completed_at)} · Điểm AI {formatScore(item.overall_score)}/5 (giữ nguyên). Nhận xét
          hiện trong báo cáo của {studentName} và mục Phản hồi từ cố vấn.
          {editing && " Sau khi sửa, sinh viên sẽ thấy nhận xét như bản mới chưa đọc."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <label htmlFor="review-comment" className="text-sm font-medium text-ink">
          Nhận xét của bạn
        </label>
        <Textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Điểm mạnh, điểm cần cải thiện và gợi ý cụ thể cho buổi luyện tiếp theo…"
          aria-invalid={submitted && error ? true : undefined}
          aria-describedby="review-comment-hint"
          maxLength={MAX_COMMENT + 200}
          className="min-h-36 bg-surface"
        />
        <p id="review-comment-hint" className="flex justify-between gap-3 text-xs">
          {submitted && error ? <span className="text-bad">{error}</span> : <span className="text-ink-2">Tối thiểu {MIN_COMMENT} ký tự.</span>}
          <span className={length > MAX_COMMENT ? "text-bad" : "text-ink-3"}>
            {length}/{MAX_COMMENT}
          </span>
        </p>
      </div>
      <DialogFooter>
        <Button variant="soft" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Lưu nhận xét" : "Gửi nhận xét"}
        </Button>
      </DialogFooter>
    </>
  )
}
