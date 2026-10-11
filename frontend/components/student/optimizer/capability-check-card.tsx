"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { IMPORTANCE_META } from "@/components/student/analysis/jd-picker-sections"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CapabilityAnswerRequest, CapabilityCheck } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Khớp giới hạn ở backend (src/services/cv_optimizer.py). */
const MAX_CONTEXT_CHARS = 500
const MAX_LEARNING_NOTE_CHARS = 120

type Choice = "yes" | "learning" | "no"

const OPTIONS: { value: Choice; label: string }[] = [
  { value: "yes", label: "Có, đã dùng" },
  { value: "learning", label: "Đang học" },
  { value: "no", label: "Chưa có" },
]

/** "Đang học" và "Chưa có" đều là chưa có kinh nghiệm; khác nhau ở ghi chú đang học (vào mục Kỹ năng đang phát triển). */
function savedChoice(check: CapabilityCheck): Choice | null {
  if (check.status === "has_experience") return "yes"
  if (check.status === "no_experience") return check.learning_note ? "learning" : "no"
  return null
}

interface CapabilityCheckCardProps {
  check: CapabilityCheck
  /** false khi đã "Hoàn tất": chỉ xem. */
  editable: boolean
  onAnswer: (body: CapabilityAnswerRequest) => Promise<void>
}

// Bản vẽ ToiUu: "Kỹ năng JD cần mà CV chưa thể hiện". PRD US-SV-05: AI không tự thêm kỹ năng còn thiếu vào CV.
export function CapabilityCheckCard({ check, editable, onAnswer }: CapabilityCheckCardProps) {
  const saved = savedChoice(check)
  const [choice, setChoice] = useState<Choice | null>(saved)
  const [context, setContext] = useState(check.context ?? "")
  const [learningNote, setLearningNote] = useState(check.learning_note ?? "")
  const [busy, setBusy] = useState(false)

  const text = choice === "yes" ? context.trim() : learningNote.trim()
  const savedText = choice === "yes" ? (check.context ?? "") : (check.learning_note ?? "")
  const dirty = choice !== saved || text !== savedText

  async function submit(next: Choice) {
    setBusy(true)
    try {
      await onAnswer(
        next === "yes"
          ? { has_experience: true, context: context.trim() }
          : { has_experience: false, learning_note: next === "learning" ? learningNote.trim() : undefined },
      )
    } catch {
      // Nơi gọi đã báo lỗi; giữ nguyên nội dung để SV sửa lại, riêng "Chưa có" (lưu ngay) thì trả về lựa chọn cũ.
      if (next === "no") setChoice(saved)
    } finally {
      setBusy(false)
    }
  }

  function pick(next: Choice) {
    setChoice(next)
    // "Chưa có" không cần nhập gì thêm nên lưu ngay.
    if (next === "no" && saved !== "no") void submit("no")
  }

  return (
    <article className="rounded-card border border-line bg-card px-[18px] py-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2">
        <h3 className="font-semibold text-ink">{check.skill}</h3>
        <span className="text-xs text-ink-3">· {IMPORTANCE_META[check.importance].label}</span>
      </div>
      <p className="mb-2.5 text-sm text-ink-2">Bạn đã từng dùng {check.skill} trong dự án hoặc bài tập lớn chưa?</p>

      <div role="radiogroup" aria-label={`Kinh nghiệm với ${check.skill}`} className="flex flex-wrap gap-1.5">
        {OPTIONS.map((o) => {
          const on = choice === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!editable || busy}
              onClick={() => pick(o.value)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-[transform,background-color,color] active:scale-[0.97] disabled:cursor-default",
                on ? "border-ink bg-ink text-white" : "border-line-strong bg-card text-ink hover:bg-panel",
                !editable && !on && "opacity-60",
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {choice === "yes" && (
        <div className="mt-2.5 animate-in duration-300 fade-in slide-in-from-bottom-1">
          {editable ? (
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={MAX_CONTEXT_CHARS}
              placeholder="Bạn dùng trong môn học hoặc dự án nào, làm những gì, kết quả ra sao…"
              aria-label={`Mô tả kinh nghiệm với ${check.skill}`}
              className="min-h-[72px] rounded-[10px] px-3 py-2.5 text-sm"
            />
          ) : (
            <p className="rounded-[10px] bg-panel px-3 py-2.5 text-sm text-ink-2">{check.context}</p>
          )}
          <p className="mt-1.5 text-xs text-ink-3">
            AI không tự thêm kỹ năng này vào CV. Hãy tự bổ sung kinh nghiệm vào CV gốc rồi phân tích lại.
          </p>
        </div>
      )}

      {choice === "learning" && (
        <div className="mt-2.5 animate-in duration-300 fade-in slide-in-from-bottom-1">
          {editable ? (
            <Input
              value={learningNote}
              onChange={(e) => setLearningNote(e.target.value)}
              maxLength={MAX_LEARNING_NOTE_CHARS}
              placeholder="Ví dụ: Đang học chứng chỉ Microsoft PL-300"
              aria-label={`Bạn đang học ${check.skill} ở đâu`}
              className="h-10 rounded-[10px] px-3 text-sm"
            />
          ) : (
            <p className="rounded-[10px] bg-panel px-3 py-2.5 text-sm text-ink-2">{check.learning_note}</p>
          )}
          <p className="mt-1.5 text-xs text-ink-3">Sẽ thêm vào mục &ldquo;Kỹ năng đang phát triển&rdquo;, không ghi là thành thạo.</p>
        </div>
      )}

      {choice === "no" && (
        <p className="mt-2.5 animate-in text-[13px] text-good duration-300 fade-in">
          Cảm ơn sự trung thực của bạn. Kỹ năng này không được thêm vào CV.
        </p>
      )}

      {editable && (choice === "yes" || choice === "learning") && dirty && (
        <button
          type="button"
          disabled={busy || !text}
          onClick={() => submit(choice)}
          className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition-[transform,background-color] hover:bg-ink/85 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Lưu câu trả lời
        </button>
      )}
      {busy && choice === "no" && <Loader2 className="mt-2 size-4 animate-spin text-ink-3" aria-label="Đang lưu" />}
    </article>
  )
}
