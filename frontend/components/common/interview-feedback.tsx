import { cn } from "@/lib/utils"

/** Bỏ markdown (**, `) mà AI đôi khi để lại trong câu hỏi / nhận xét cũ. */
export function plainText(text: string): string {
  return text.replace(/\*\*|__|`/g, "")
}

// Nhận xét mới có 3 dòng "Điểm tốt: … / Cần cải thiện: … / Gợi ý trả lời: …" (src/agents/interview/nodes/score_answer.py)
const LABEL = /^(Điểm tốt|Cần cải thiện|Gợi ý trả lời):\s*/

/** Nhận xét AI cho một câu trả lời phỏng vấn: mỗi phần một đoạn, nhãn in đậm; nhận xét cũ hiện nguyên văn. */
export function InterviewFeedback({ text, className }: { text: string; className?: string }) {
  const lines = plainText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    <div className={cn("grid gap-2 leading-6 text-ink-2", className)}>
      {lines.map((line, i) => {
        const label = LABEL.exec(line)
        return (
          <p key={i}>
            {label ? (
              <>
                <b className="font-semibold text-ink">{label[1]}:</b> {line.slice(label[0].length)}
              </>
            ) : (
              line
            )}
          </p>
        )
      })}
    </div>
  )
}
