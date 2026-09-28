"use client"

import { useState } from "react"
import { CircleCheck, CircleX, Info, Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { CapabilityAnswerRequest, CapabilityCheck } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CapabilityCheckCardProps {
  check: CapabilityCheck
  onAnswer: (body: CapabilityAnswerRequest) => Promise<void>
}

// Figma: thẻ "Kiểm tra tính xác thực kinh nghiệm". PRD US-SV-05: AI không tự thêm kỹ năng còn thiếu vào CV.
export function CapabilityCheckCard({ check, onAnswer }: CapabilityCheckCardProps) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null)
  const [context, setContext] = useState("")
  const [learningNote, setLearningNote] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await onAnswer(
        choice === "yes"
          ? { has_experience: true, context }
          : { has_experience: false, learning_note: learningNote.trim() || undefined },
      )
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
        <h3 className="font-heading text-sm font-bold text-ink">Phát hiện khoảng trống kỹ năng: {check.skill}</h3>
      </header>

      <div className="grid gap-1.5 rounded-xl bg-blue-soft/50 p-3 text-[13px] leading-5">
        <p className="text-ink">
          <span className="font-semibold text-blue">Yêu cầu từ JD: </span>
          {check.jd_requirement}
        </p>
        {check.status === "pending" && (
          <p className="font-medium text-ink">Bạn đã từng có kinh nghiệm thực tế hoặc làm bài tập lớn với kỹ năng này chưa?</p>
        )}
      </div>

      {check.status === "pending" ? (
        <>
          <div role="radiogroup" aria-label={`Kinh nghiệm với ${check.skill}`} className="grid gap-2">
            <OptionButton selected={choice === "yes"} onClick={() => setChoice("yes")} icon={CircleCheck} tone="good">
              Phương án A: Tôi đã từng học / làm dự án với kỹ năng này
            </OptionButton>
            {choice === "yes" && (
              <div className="grid gap-1.5 pl-2">
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Mô tả ngắn: bạn dùng trong môn học / dự án nào, làm những gì, kết quả ra sao…"
                  aria-label="Ngữ cảnh kinh nghiệm"
                  className="min-h-20 text-sm"
                />
                <p className="text-xs text-ink-2">
                  Sau khi ghi nhận, hãy bổ sung kinh nghiệm này vào CV gốc rồi phân tích lại để AI đối chiếu dẫn chứng.
                </p>
              </div>
            )}
            <OptionButton selected={choice === "no"} onClick={() => setChoice("no")} icon={CircleX} tone="bad">
              Phương án B: Tôi chưa có kinh nghiệm với kỹ năng này
            </OptionButton>
            {choice === "no" && (
              <div className="grid gap-2 rounded-xl bg-good-soft/60 p-3 text-[13px] leading-5">
                <p className="font-semibold text-good">Cảm ơn sự trung thực của bạn!</p>
                <p className="text-ink">
                  AI sẽ <strong>không</strong> thêm kỹ năng này vào CV như đã thành thạo, tránh rủi ro khi bị kiểm tra ở vòng
                  phỏng vấn kỹ thuật. Khoảng trống này vẫn hiển thị để bạn và cố vấn lên kế hoạch học thêm.
                </p>
                <label className="grid gap-1 text-xs text-ink-2">
                  Nếu bạn đang học, có thể ghi vào mục &quot;Kỹ năng đang phát triển&quot; (tuỳ chọn):
                  <Input
                    value={learningNote}
                    onChange={(e) => setLearningNote(e.target.value)}
                    placeholder="Ví dụ: Đang học chứng chỉ Microsoft PL-300"
                    className="h-9 bg-card text-sm"
                  />
                </label>
              </div>
            )}
          </div>
          {choice && (
            <Button
              size="sm"
              className="justify-self-start"
              disabled={busy || (choice === "yes" && !context.trim())}
              onClick={submit}
            >
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              Xác nhận
            </Button>
          )}
        </>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[13px] leading-5 text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
          {check.status === "has_experience"
            ? `Đã ghi nhận kinh nghiệm của bạn: “${check.context}”. Hãy bổ sung vào CV gốc rồi phân tích lại.`
            : "Đã xác nhận chưa có kinh nghiệm. Kỹ năng này không được thêm vào CV như đã thành thạo."}
        </p>
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
