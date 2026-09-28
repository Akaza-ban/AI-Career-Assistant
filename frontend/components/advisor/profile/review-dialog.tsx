"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { AdvisorInterviewItem } from "@/lib/types"

const MIN_COMMENT = 10

interface ReviewDialogProps {
  studentId: string
  studentName: string
  item: AdvisorInterviewItem | null
  onClose: () => void
  onReviewed: (item: AdvisorInterviewItem) => void
}

/** Cố vấn nhận xét một buổi phỏng vấn; có thể chốt điểm khác điểm AI (human-in-the-loop). */
export function ReviewDialog({ studentId, studentName, item, onClose, onReviewed }: ReviewDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {item && <ReviewForm key={item.id} studentId={studentId} studentName={studentName} item={item} onClose={onClose} onReviewed={onReviewed} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviewForm({ studentId, studentName, item, onClose, onReviewed }: Omit<ReviewDialogProps, "item"> & { item: AdvisorInterviewItem }) {
  const [comment, setComment] = useState("")
  const [adjust, setAdjust] = useState(false)
  const [score, setScore] = useState(String(item.total_score))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const scoreNumber = Number(score)
  const commentError = comment.trim().length < MIN_COMMENT ? `Nhận xét cần ít nhất ${MIN_COMMENT} ký tự.` : null
  const scoreError =
    adjust && (!/^\d{1,3}$/.test(score) || scoreNumber < 0 || scoreNumber > 100) ? "Điểm phải là số nguyên từ 0 đến 100." : null

  async function submit() {
    setSubmitted(true)
    if (commentError || scoreError) return
    setSaving(true)
    try {
      const updated = await api.reviewInterview(studentId, item.id, {
        comment,
        ...(adjust && scoreNumber !== item.total_score ? { score: scoreNumber } : {}),
      })
      onReviewed(updated)
      toast.success(`Đã gửi nhận xét cho ${studentName}.`)
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
        <DialogTitle>Nhận xét {item.round_title}</DialogTitle>
        <DialogDescription>
          Điểm AI chấm: {item.total_score}/100. Nhận xét sẽ được gửi tới {studentName} và hiện trong mục Phản hồi từ cố vấn.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor="review-comment" className="text-sm font-medium text-ink">
            Nhận xét của bạn
          </label>
          <Textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Điểm mạnh, điểm cần cải thiện và gợi ý cụ thể cho buổi luyện tiếp theo…"
            aria-invalid={submitted && commentError ? true : undefined}
            className="min-h-32 bg-surface"
          />
          {submitted && commentError && <p className="text-xs text-bad">{commentError}</p>}
        </div>
        <div className="grid gap-2 rounded-xl bg-surface p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <Checkbox checked={adjust} onCheckedChange={(v) => setAdjust(v === true)} />
            Chốt điểm khác điểm AI
          </label>
          {adjust && (
            <div className="grid gap-1 pl-6">
              <div className="flex items-center gap-2">
                <Input
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  inputMode="numeric"
                  aria-label="Điểm cố vấn chốt"
                  aria-invalid={scoreError ? true : undefined}
                  className="h-9 w-20 bg-card"
                />
                <span className="text-sm text-ink-2">/100</span>
              </div>
              {scoreError ? (
                <p className="text-xs text-bad">{scoreError}</p>
              ) : (
                <p className="text-xs text-ink-2">Hãy nêu lý do điều chỉnh trong nhận xét để sinh viên hiểu.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="soft" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Gửi nhận xét
        </Button>
      </DialogFooter>
    </>
  )
}
