"use client"

import { useCallback, useEffect, type ReactNode } from "react"
import { AlertCircle, FileText, Loader2 } from "lucide-react"

import { loadPreview } from "@/components/student/cv/cv-preview-dialog"
import { Button } from "@/components/ui/button"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

interface ParsedCv {
  header: string[]
  sections: { title: string; lines: { bullet: boolean; text: string }[] }[]
}

/** Dòng tiêu đề mục: viết hoa toàn bộ, ngắn (ví dụ "KINH NGHIỆM", "HỌC VẤN"). */
const isHeading = (line: string) =>
  line.length <= 60 && /\p{L}/u.test(line) && line === line.toLocaleUpperCase("vi") && !line.startsWith("-")

/** Tách văn bản đã trích thành phần đầu + các mục; null khi không nhận ra cấu trúc (hiển thị nguyên văn). */
function parseCvText(text: string): ParsedCv | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const parsed: ParsedCv = { header: [], sections: [] }
  for (const line of lines) {
    if (isHeading(line) && parsed.header.length > 0) {
      parsed.sections.push({ title: line, lines: [] })
      continue
    }
    const section = parsed.sections.at(-1)
    if (!section) {
      parsed.header.push(line)
      continue
    }
    const bullet = /^[-•*]\s+/.test(line)
    section.lines.push({ bullet, text: bullet ? line.replace(/^[-•*]\s+/, "") : line })
  }
  return parsed.sections.length > 0 ? parsed : null
}

/** Gom các dòng gạch đầu dòng liền nhau thành một danh sách. */
function renderLines(lines: ParsedCv["sections"][number]["lines"]): ReactNode[] {
  const out: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    out.push(
      <ul key={`ul-${out.length}`} className="mt-1.5 list-disc pl-[18px]">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const line of lines) {
    if (line.bullet) {
      bullets.push(line.text)
      continue
    }
    flush()
    out.push(
      <p key={`p-${out.length}`} className="mt-2.5 font-semibold">
        {line.text}
      </p>,
    )
  }
  flush()
  return out
}

function PaperText({ text }: { text: string }) {
  const doc = parseCvText(text)
  if (!doc) return <p className="whitespace-pre-line">{text}</p>
  const [name, ...meta] = doc.header
  return (
    <>
      <p className="text-2xl leading-8 font-semibold tracking-[-0.01em] uppercase">{name}</p>
      {meta.map((line) => (
        <p key={line} className="mt-0.5 text-ink-3">
          {line}
        </p>
      ))}
      {doc.sections.map((section, i) => (
        <section key={`${section.title}-${i}`}>
          <p
            className={cn(
              "border-b border-line pb-1.5 text-xs font-semibold tracking-[.06em] text-ink",
              i === 0 ? "mt-[26px]" : "mt-[22px]",
            )}
          >
            {section.title}
          </p>
          {renderLines(section.lines)}
        </section>
      ))}
    </>
  )
}

/** Nội dung một phiên bản CV dạng tờ giấy trắng (PDF hiển thị bằng trình xem của trình duyệt). */
export function CvPaper({ cv, className }: { cv: CvVersion; className?: string }) {
  const fetchPreview = useCallback(() => loadPreview(cv), [cv])
  const { data, error, reload } = useApi(fetchPreview)

  useEffect(() => {
    return () => {
      if (data?.kind === "pdf") URL.revokeObjectURL(data.url)
    }
  }, [data])

  const pdf = data?.kind === "pdf"
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[720px] rounded-md bg-card text-sm leading-[22px] break-words text-ink shadow-float",
        pdf ? "h-[80vh] min-h-[480px] overflow-hidden" : "px-5 py-7 sm:px-14 sm:py-12",
        className,
      )}
    >
      {error ? (
        <div className="grid min-h-[360px] place-content-center justify-items-center gap-3 text-center">
          <AlertCircle className="size-6 text-bad" strokeWidth={1.75} aria-hidden />
          <p className="text-ink-2">{error.message}</p>
          <Button variant="soft" className="h-9 rounded-full px-4" onClick={reload}>
            Thử lại
          </Button>
        </div>
      ) : !data ? (
        <div className="grid min-h-[360px] place-content-center justify-items-center gap-2 text-ink-3" aria-busy="true">
          <Loader2 className="size-5 animate-spin" strokeWidth={1.75} aria-hidden />
          Đang mở CV…
        </div>
      ) : data.kind === "pdf" ? (
        <iframe src={`${data.url}#view=FitH`} title={`Nội dung ${cv.file_name}`} className="size-full" />
      ) : data.kind === "text" ? (
        <PaperText text={data.text} />
      ) : (
        <div className="grid min-h-[360px] place-content-center justify-items-center gap-2 text-center text-ink-3">
          <FileText className="size-6" strokeWidth={1.75} aria-hidden />
          Bản demo chưa có file thật để xem trước.
        </div>
      )}
    </div>
  )
}
