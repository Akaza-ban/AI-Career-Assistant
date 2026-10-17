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

const DEVELOPING_TITLE = { vi: "Kỹ năng đang phát triển", en: "Developing Skills" }
// Cùng kiểu chữ với file DOCX tải về (src/services/cv_files.py build_docx); tiêu đề cũng dùng (app đặt font riêng cho h2, h3)
const SERIF = { fontFamily: '"Times New Roman", Times, serif' }

/** Một dòng trình bày: dòng chính kèm các nửa sau của câu bị xuống dòng khi trích PDF/OCR (cont). */
interface Item {
  line: CvDocLine
  parts: CvDocLine[]
}

function mergeWrapped(lines: CvDocLine[]): Item[] {
  const items: Item[] = []
  for (const line of lines) {
    const last = items[items.length - 1]
    if (line.cont && last) last.parts.push(line)
    else items.push({ line, parts: [line] })
  }
  return items
}

/** Tên của dòng entry: bỏ phần thời gian (ở cuối hoặc đầu dòng) cùng dấu ngăn, khớp _without_date ở backend. */
function withoutDate(text: string, date: string) {
  const at = text.lastIndexOf(date)
  if (at < 0) return text
  const trim = (s: string) => s.replace(/^[\s|,–—:-]+|[\s|,–—:-]+$/g, "")
  let title = trim(text.slice(0, at) + text.slice(at + date.length))
  if (title.endsWith("(")) title = title.slice(0, -1)
  if (title.startsWith(")")) title = title.slice(1)
  title = trim(title.replace("()", ""))
  return title || text
}

function Labelled({ text }: { text: string }) {
  const at = text.indexOf(":")
  if (at < 0) return <>{text}</>
  return (
    <>
      <b className="font-bold">{text.slice(0, at + 1)}</b>
      {text.slice(at + 1)}
    </>
  )
}

/**
 * Nội dung CV đã trích, trình bày theo mẫu gọn kiểu Harvard (dùng chung cho Trình tối ưu CV và bản in ở Xuất CV;
 * khớp file DOCX): họ tên và liên hệ căn giữa, tiêu đề mục in hoa có kẻ dưới, tên mục con in đậm với thời gian
 * căn phải, câu mô tả là gạch đầu dòng. Chữ giữ nguyên; loại từng dòng do backend gắn (src/services/cv_layout.py).
 */
export function CvDocumentView({ doc, renderLine, className }: CvDocumentViewProps) {
  const header = mergeWrapped(doc.header)
  const name = header.find((i) => i.line.kind === "name") ?? header[0]
  const contacts = header.filter((i) => i !== name && (i.line.kind ?? "contact") === "contact")
  const intro = header.filter((i) => i !== name && i.line.kind === "text")

  /** Nội dung một dòng: tuỳ biến của Trình tối ưu nếu có, không thì chữ (ghép các nửa câu bằng dấu cách). */
  function body(item: Item, plain: (text: string) => ReactNode = (t) => t) {
    const custom = item.parts.map((p) => renderLine?.(p))
    if (custom.every((c) => c === undefined || c === null)) {
      return plain(item.parts.map((p) => p.text).join(" "))
    }
    return item.parts.map((p, i) => (
      <div key={p.id}>{custom[i] ?? <div className="-mx-2.5 px-2.5 py-px">{p.text}</div>}</div>
    ))
  }

  function renderLines(lines: CvDocLine[]) {
    const out: ReactNode[] = []
    let bullets: Item[] = []
    const flush = () => {
      if (bullets.length === 0) return
      out.push(
        <ul key={`ul-${bullets[0].line.id}`} className="list-disc pl-[22px] marker:text-current">
          {bullets.map((item) => (
            <li key={item.line.id} className="pl-1 text-justify">
              {body(item)}
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
    for (const item of mergeWrapped(lines)) {
      const { line } = item
      const kind = line.kind ?? "bullet"
      if (kind === "bullet") {
        bullets.push(item)
        continue
      }
      flush()
      const custom = renderLine?.(line)
      if (kind === "entry" && line.date && custom == null) {
        const title = withoutDate(line.text, line.date)
        out.push(
          <div key={line.id} className="mt-1.5 flex items-baseline justify-between gap-x-4 first:mt-0">
            <b className="min-w-0 font-bold">{title === line.text ? line.text : title}</b>
            {title !== line.text && <span className="shrink-0 whitespace-nowrap">{line.date}</span>}
          </div>,
        )
      } else if (kind === "entry") {
        out.push(
          <div key={line.id} className="mt-1.5 font-bold first:mt-0">
            {body(item)}
          </div>,
        )
      } else {
        out.push(
          <div
            key={line.id}
            className={cn(
              kind === "role" && "italic",
              kind === "tech" && "font-bold italic",
              kind === "text" && "text-justify",
            )}
          >
            {body(item, kind === "label" ? (t) => <Labelled text={t} /> : undefined)}
          </div>,
        )
      }
    }
    flush()
    return out
  }

  const heading = (title: string) => (
    <h3
      className="mb-1 border-b border-current pb-px text-[14.5px] leading-5 font-bold tracking-[0.02em] uppercase"
      style={SERIF}
    >
      {title}
    </h3>
  )

  return (
    <article
      className={cn("text-[13.5px] leading-[1.4] break-words text-ink", className)}
      style={SERIF}
      aria-label="Nội dung CV"
    >
      {name && (
        <header className="text-center">
          <h2 className="text-[22px] leading-7 font-bold tracking-[0.02em] uppercase" style={SERIF}>
            {name.line.text}
          </h2>
          {contacts.length > 0 && (
            <p className="mt-0.5 text-[12.5px] leading-[18px]">
              {contacts.map((c) => c.parts.map((p) => p.text).join(" ")).join(" | ")}
            </p>
          )}
          {intro.map((item) => (
            <p key={item.line.id} className="mt-2.5 text-justify">
              {item.parts.map((p) => p.text).join(" ")}
            </p>
          ))}
        </header>
      )}

      {doc.sections.map((section) => (
        <section key={section.id} className="mt-3.5">
          {heading(section.title)}
          {renderLines(section.lines)}
        </section>
      ))}

      {doc.developing_skills.length > 0 && (
        <section className="mt-3.5">
          {heading(DEVELOPING_TITLE[doc.lang ?? "vi"])}
          {doc.developing_skills.map((d) => (
            <div key={d.name}>
              <b className="font-bold">{d.name}:</b> {d.note}
            </div>
          ))}
        </section>
      )}
    </article>
  )
}
