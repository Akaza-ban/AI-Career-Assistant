import type { ReactNode } from "react"

import type { CvDocLine, CvDocument } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CvDocumentViewProps {
  doc: CvDocument
  /**
   * Tuỳ biến cả dòng (Trình tối ưu dùng để tô dòng có gợi ý). Trả về undefined để dùng cách hiển thị mặc định.
   * Dòng tự chừa lề âm 10px hai bên để nền tô của dòng tràn ra ngoài chữ.
   */
  renderLine?: (line: CvDocLine) => ReactNode | undefined
  className?: string
}

/**
 * Nội dung CV đã trích, dựng như một trang giấy đơn giản (dùng chung cho Trình tối ưu CV và bản in ở Xuất CV).
 * Không giữ thiết kế của file gốc; dòng đầu tiên thường là họ tên.
 */
export function CvDocumentView({ doc, renderLine, className }: CvDocumentViewProps) {
  const [first, ...rest] = doc.header
  const row = (line: CvDocLine) => renderLine?.(line) ?? <div className="-mx-2.5 px-2.5 py-[5px]">{line.text}</div>

  return (
    <article className={cn("text-sm leading-[22px] break-words text-ink", className)} aria-label="Nội dung CV">
      {first && (
        <header>
          <h2 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">{first.text}</h2>
          {rest.map((line) => (
            <p key={line.id} className="mt-0.5 text-[13px] leading-5 text-ink-3">
              {line.text}
            </p>
          ))}
        </header>
      )}

      {doc.sections.map((section) => (
        <section key={section.id} className="mt-5">
          <h3 className="mb-2 border-b border-line pb-1.5 text-xs font-semibold tracking-[0.06em] text-ink uppercase">
            {section.title}
          </h3>
          <ul className="grid gap-0.5">
            {section.lines.map((line) => (
              <li key={line.id}>{row(line)}</li>
            ))}
          </ul>
        </section>
      ))}

      {doc.developing_skills.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 border-b border-line pb-1.5 text-xs font-semibold tracking-[0.06em] text-ink uppercase">
            Kỹ năng đang phát triển
          </h3>
          <ul className="grid gap-0.5">
            {doc.developing_skills.map((d) => (
              <li key={d.name} className="py-[5px]">
                <span className="font-medium">{d.name}</span>: {d.note}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
