"use client"

import { useState } from "react"
import { CircleCheck, CircleX, Info, Loader2, Pencil, ShieldCheck, Sprout } from "lucide-react"

import { IMPORTANCE_META } from "@/components/student/analysis/jd-picker-sections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CapabilityAnswerRequest, CapabilityCheck } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Khớp giới hạn ở backend (src/services/cv_optimizer.py). */
const MAX_CONTEXT_CHARS = 500
const MAX_LEARNING_NOTE_CHARS = 120

interface CapabilityCheckCardProps {
  check: CapabilityCheck
  /** false khi đã "Hoàn tất": chỉ xem. */
  editable: boolean
  onAnswer: (body: CapabilityAnswerRequest) => Promise<void>
}

// Figma: thẻ "Kiểm tra tính xác thực kinh nghiệm". PRD US-SV-05: AI không tự thêm kỹ năng còn thiếu vào CV.
export function CapabilityCheckCard({ check, editable, onAnswer }: CapabilityCheckCardProps) {
  const answered = check.status !== "pending"
  const [changing, setChanging] = useState(false)
  const [choice, setChoice] = useState<"yes" | "no" | null>(
    check.status === "has_experience" ? "yes" : check.status === "no_experience" ? "no" : null,
  )
  const [context, setContext] = useState(check.context ?? "")
  const [learningNote, setLearningNote] = useState(check.learning_note ?? "")
  const [busy, setBusy] = useState(false)
  const importance = IMPORTANCE_META[check.importance]
  const showForm = editable && (!answered || changing)

  async function submit() {
    setBusy(true)
    try {
      await onAnswer(
        choice === "yes"
          ? { has_experience: true, context: context.trim() }
          : { has_experience: false, learning_note: learningNote.trim() || undefined },
      )
      setChanging(false)
    } catch {
      // Nơi gọi đã báo lỗi; giữ nguyên nội dung để SV sửa lại.
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="grid gap-3 rounded-[20px] border border-t-4 border-line border-t-navy bg-card p-4 shadow-card">
      <header className="grid gap-1">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-blue uppercase">
          <ShieldCheck className="size-3.5" aria-hidden />
          Kiểm tra tính xác thực kinh nghiệm
        </span>
        <h3 className="flex flex-wrap items-center gap-2 font-heading text-sm font-bold text-ink">
          Kỹ năng CV chưa thể hiện: {check.skill}
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", importance.chip)}>{importance.label}</span>
        </h3>
      </header>

      <div className="grid gap-1.5 rounded-xl bg-blue-soft/50 p-3 text-[13px] leading-5">
        <p className="text-ink">{check.jd_requirement}</p>
        {showForm && (
          <p className="font-medium text-ink">Bạn đã từng có kinh nghiệm thực tế hoặc làm bài tập lớn với kỹ năng này chưa?</p>
        )}
      </div>

      {showForm ? (
        <>
          <div role="radiogroup" aria-label={`Kinh nghiệm với ${check.skill}`} className="grid gap-2">
            <OptionButton selected={choice === "yes"} onClick={() => setChoice("yes")} icon={CircleCheck} tone="good">
              Tôi đã từng học / làm dự án với kỹ năng này
            </OptionButton>
            {choice === "yes" && (
              <div className="grid gap-1.5 pl-2">
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  maxLength={MAX_CONTEXT_CHARS}
                  placeholder="Mô tả ngắn: bạn dùng trong môn học / dự án nào, làm những gì, kết quả ra sao…"
                  aria-label="Mô tả kinh nghiệm"
                  className="min-h-20 text-sm"
                />
                <p className="text-xs text-ink-2">
                  AI không tự thêm kỹ năng này vào CV. Sau khi ghi nhận, hãy tự bổ sung kinh nghiệm này vào CV gốc rồi
                  phân tích lại để hệ thống đối chiếu bằng chứng.
                </p>
              </div>
            )}
            <OptionButton selected={choice === "no"} onClick={() => setChoice("no")} icon={CircleX} tone="bad">
              Tôi chưa có kinh nghiệm với kỹ năng này
            </OptionButton>
            {choice === "no" && (
              <div className="grid gap-2 rounded-xl bg-good-soft/60 p-3 text-[13px] leading-5">
                <p className="font-semibold text-good">Cảm ơn sự trung thực của bạn!</p>
                <p className="text-ink">
                  Kỹ năng này <strong>không</strong> được thêm vào CV như đã thành thạo, tránh rủi ro khi bị hỏi sâu ở vòng
                  phỏng vấn. Khoảng trống này vẫn được giữ để bạn và cố vấn lên kế hoạch học thêm.
                </p>
                <label className="grid gap-1 text-xs text-ink-2">
                  Nếu bạn đang học, có thể ghi vào mục &quot;Kỹ năng đang phát triển&quot; của CV (tuỳ chọn):
                  <Input
                    value={learningNote}
                    onChange={(e) => setLearningNote(e.target.value)}
                    maxLength={MAX_LEARNING_NOTE_CHARS}
                    placeholder="Ví dụ: Đang học chứng chỉ Microsoft PL-300"
                    className="h-9 bg-card text-sm"
                  />
                </label>
              </div>
            )}
          </div>
          {choice && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy || (choice === "yes" && !context.trim())} onClick={submit}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                Xác nhận
              </Button>
              {changing && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setChanging(false)}>
                  Huỷ
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-2">
          <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[13px] leading-5 text-ink">
            {check.status === "has_experience" ? (
              <>
                <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
                <span>
                  Đã ghi nhận kinh nghiệm của bạn: &ldquo;{check.context}&rdquo;. Hãy tự bổ sung vào CV gốc rồi phân tích lại.
                </span>
              </>
            ) : check.learning_note ? (
              <>
                <Sprout className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
                <span>
                  Ghi vào mục Kỹ năng đang phát triển: &ldquo;{check.learning_note}&rdquo;. Không ghi là thành thạo.
                </span>
              </>
            ) : (
              <>
                <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
                <span>Đã xác nhận chưa có kinh nghiệm. Kỹ năng này không được thêm vào CV.</span>
              </>
            )}
          </p>
          {editable && (
            <Button size="sm" variant="ghost" className="justify-self-start text-ink-2" onClick={() => setChanging(true)}>
              <Pencil aria-hidden />
              Đổi câu trả lời
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

function OptionButton({
  selected,
  onClick,
  icon: Icon,
  tone,
  children,
}: {
  selected: boolean
  onClick: () => void
  icon: typeof CircleCheck
  tone: "good" | "bad"
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border p-3 text-left text-[13px] font-medium transition-colors",
        selected ? "border-blue bg-blue-soft/40 text-ink" : "border-line bg-surface/60 text-ink hover:border-blue/40",
      )}
    >
      <Icon className={cn("size-4 shrink-0", tone === "good" ? "text-good" : "text-bad")} aria-hidden />
      {children}
    </button>
  )
}
