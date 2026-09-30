import type { ReactNode } from "react"
import { Sprout } from "lucide-react"

import type { CvDocLine, CvDocument } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CvDocumentViewProps {
  doc: CvDocument
  /**
   * Tuỳ biến cách hiển thị một dòng (Trình tối ưu dùng để đánh dấu gợi ý).
   * Trả về undefined để dùng cách hiển thị mặc định.
   */
  renderLine?: (line: CvDocLine) => ReactNode | undefined
  /** Ghi chú cạnh tiêu đề mục, ví dụ "Có 2 đề xuất tối ưu". */
  sectionAside?: (sectionId: string) => ReactNode
  /** "paper": trang CV sạch để xuất / in; "workspace": dạng thẻ trong trình tối ưu. */
  variant?: "paper" | "workspace"
  className?: string
}

/**
 * Hiển thị nội dung CV đã trích theo mục (dùng chung cho Trình tối ưu CV và Xuất CV).
 * Bố cục đơn giản, không giữ thiết kế của file gốc; dòng đầu tiên thường là họ tên.
 */
export function CvDocumentView({ doc, renderLine, sectionAside, variant = "workspace", className }: CvDocumentViewProps) {
  const paper = variant === "paper"
  const [first, ...rest] = doc.header
  return (
    <article className={cn("grid gap-6", className)} aria-label="Nội dung CV">
      {first && (
        <header className={cn("grid gap-1", paper ? "text-center" : "rounded-xl bg-blue-soft/50 p-4")}>
          <h2 className={cn("font-heading font-extrabold tracking-tight break-words text-ink", paper ? "text-2xl" : "text-xl")}>
            {renderLine?.(first) ?? first.text}
          </h2>
          {rest.map((line) => (
            <p key={line.id} className="text-sm break-words text-ink-2">
              {renderLine?.(line) ?? line.text}
            </p>
          ))}
        </header>
      )}

      {doc.sections.map((section, index) => (
        <section key={section.id} className="grid gap-3">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
            <h3 className="font-heading text-sm font-bold tracking-[0.06em] text-ink uppercase">
              {paper ? section.title : `${index + 1}. ${section.title}`}
            </h3>
            {sectionAside?.(section.id)}
          </div>
          {section.lines.length > 0 && (
            <ul className={cn("grid gap-1.5", paper && "list-disc pl-5 marker:text-ink-3")}>
              {section.lines.map((line) => (
                <li key={line.id} className="text-sm leading-6 break-words text-ink">
                  {renderLine?.(line) ?? line.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {doc.developing_skills.length > 0 && (
        <section className="grid gap-3">
          <h3 className="flex items-center gap-1.5 border-b border-line pb-1.5 font-heading text-sm font-bold tracking-[0.06em] text-violet uppercase">
            <Sprout className="size-4" aria-hidden />
            Kỹ năng đang phát triển
          </h3>
          <ul className={cn("grid gap-1.5", paper && "list-disc pl-5 marker:text-ink-3")}>
            {doc.developing_skills.map((d) => (
              <li key={d.name} className="text-sm leading-6 text-ink">
                <span className="font-medium">{d.name}</span>: {d.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
