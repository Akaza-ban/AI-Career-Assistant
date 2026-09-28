import type { ReactNode } from "react"
import { Check, Mail, MapPin, Phone, Sprout } from "lucide-react"

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
  /** "paper": trang CV sạch để xuất; "workspace": dạng thẻ trong trình tối ưu. */
  variant?: "paper" | "workspace"
  className?: string
}

/** Hiển thị nội dung CV (dùng chung cho Trình tối ưu CV và Xuất CV). */
export function CvDocumentView({ doc, renderLine, sectionAside, variant = "workspace", className }: CvDocumentViewProps) {
  const paper = variant === "paper"
  return (
    <article className={cn("grid gap-6", className)} aria-label={`CV của ${doc.full_name}`}>
      <header className={cn("grid gap-1", paper ? "text-center" : "rounded-xl bg-blue-soft/50 p-4")}>
        <h2 className={cn("font-heading font-extrabold tracking-tight text-ink", paper ? "text-2xl" : "text-xl")}>
          {paper ? doc.full_name.toUpperCase() : doc.full_name}
        </h2>
        <p className="font-medium text-blue">{doc.headline}</p>
        <p className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2", paper && "justify-center")}>
          <span className="inline-flex items-center gap-1">
            <Mail className="size-3.5" aria-hidden />
            {doc.email}
          </span>
          {doc.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" aria-hidden />
              {doc.phone}
            </span>
          )}
          {doc.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {doc.location}
            </span>
          )}
        </p>
      </header>

      {doc.sections.map((section, index) => (
        <section key={section.id} className="grid gap-3">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
            <h3 className="font-heading text-sm font-bold tracking-[0.06em] text-ink uppercase">
              {paper ? section.title : `${index + 1}. ${section.title}`}
            </h3>
            {sectionAside?.(section.id)}
          </div>
          {section.entries.map((entry) => (
            <div key={entry.id} className="grid gap-1.5">
              {(entry.title || entry.meta) && (
                <div>
                  {entry.title && <p className="font-heading font-bold text-ink">{entry.title}</p>}
                  {entry.meta && <p className="text-xs text-ink-2">{entry.meta}</p>}
                </div>
              )}
              <ul className={cn("grid gap-1.5", entry.title && "pl-3")}>
                {entry.lines.map((line) => (
                  <li key={line.id} className="text-sm leading-6 text-ink">
                    {renderLine?.(line) ?? line.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <section className="grid gap-3">
        <h3 className="border-b border-line pb-1.5 font-heading text-sm font-bold tracking-[0.06em] text-ink uppercase">
          {paper ? "Kỹ năng chuyên môn" : `${doc.sections.length + 1}. Kỹ năng & công cụ`}
        </h3>
        <div className="flex flex-wrap gap-2">
          {doc.skills.confirmed.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line"
            >
              <Check className="size-3.5 text-good" aria-hidden />
              {skill}
            </span>
          ))}
        </div>
        {doc.skills.developing.length > 0 && (
          <div className="grid gap-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-violet">
              <Sprout className="size-3.5" aria-hidden />
              Kỹ năng đang phát triển
            </p>
            <div className="flex flex-wrap gap-2">
              {doc.skills.developing.map((d) => (
                <span key={d.name} className="rounded-lg bg-violet-soft px-2.5 py-1 text-xs text-ink">
                  <span className="font-medium">{d.name}</span> ({d.note})
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </article>
  )
}
