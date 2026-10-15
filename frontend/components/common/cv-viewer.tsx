"use client"

import { useEffect, type ReactNode } from "react"
import { AlertCircle, FileText, Loader2 } from "lucide-react"

import { CvDocumentView } from "@/components/student/cv-document-view"
import { Button } from "@/components/ui/button"
import type { CvDocument, CvPreviewInfo } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/**
 * Cách xem một phiên bản CV trong app (không dùng trình xem PDF của trình duyệt):
 * pages = ảnh từng trang PDF gốc do backend vẽ; document = DOCX / bản đã tối ưu theo mẫu CV (giống trang Xuất CV);
 * text = chế độ mock (chỉ có văn bản); unavailable = bản demo không có file.
 */
export type CvView =
  | { kind: "pages"; urls: string[] }
  | { kind: "document"; doc: CvDocument }
  | { kind: "text"; text: string }
  | { kind: "unavailable" }

export interface CvSource {
  /** null ở chế độ mock. */
  preview: () => Promise<CvPreviewInfo | null>
  page: (page: number) => Promise<Blob | null>
  text: () => Promise<string | null>
}

export async function loadCvView(source: CvSource): Promise<CvView> {
  const info = await source.preview()
  if (info?.kind === "pages" && info.page_count) {
    const blobs = await Promise.all(Array.from({ length: info.page_count }, (_, i) => source.page(i + 1)))
    if (blobs.every((b): b is Blob => b !== null)) return { kind: "pages", urls: blobs.map((b) => URL.createObjectURL(b)) }
  }
  if (info?.kind === "document" && info.document) return { kind: "document", doc: info.document }
  const text = await source.text()
  return text !== null ? { kind: "text", text } : { kind: "unavailable" }
}

// Tờ giấy trắng chữ đen như bản in, kể cả khi app đang ở giao diện tối
const SHEET =
  "mx-auto w-full max-w-[720px] rounded-[4px] bg-white text-[#16161a] shadow-[0_1px_2px_rgba(0,0,0,.06),0_12px_32px_-12px_rgba(0,0,0,.22)]"

interface CvViewerProps {
  /** Ổn định giữa các lần render (useCallback), vì useApi tải lại khi hàm đổi. */
  load: () => Promise<CvView>
  /** Tên file, dùng cho alt của ảnh trang. */
  fileName: string
  /** Dòng nhỏ phía trên: "PDF gốc · 2 trang" / "Theo mẫu CV". */
  showInfo?: boolean
  className?: string
}

/** Nội dung một phiên bản CV dạng các tờ giấy (Chi tiết CV, popup Xem nhanh, Cố vấn xem CV SV). */
export function CvViewer({ load, fileName, showInfo = false, className }: CvViewerProps) {
  const { data, error, reload } = useApi(load)

  useEffect(() => {
    return () => {
      if (data?.kind === "pages") data.urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [data])

  if (error) {
    return (
      <div className={cn("grid min-h-[360px] place-content-center justify-items-center gap-3 text-center", className)}>
        <AlertCircle className="size-6 text-bad" strokeWidth={1.75} aria-hidden />
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" className="h-9 rounded-full px-4" onClick={reload}>
          Thử lại
        </Button>
      </div>
    )
  }
  if (!data) {
    return (
      <div
        className={cn("grid min-h-[360px] place-content-center justify-items-center gap-2 text-sm text-ink-3", className)}
        aria-busy="true"
      >
        <Loader2 className="size-5 animate-spin" strokeWidth={1.75} aria-hidden />
        Đang mở CV…
      </div>
    )
  }
  if (data.kind === "unavailable") {
    return (
      <div className={cn("grid min-h-[360px] place-content-center justify-items-center gap-2 text-center text-sm text-ink-3", className)}>
        <FileText className="size-6" strokeWidth={1.75} aria-hidden />
        Bản demo chưa có file thật để xem trước.
      </div>
    )
  }

  const info =
    data.kind === "pages" ? `PDF gốc · ${data.urls.length} trang` : "Trình bày theo mẫu CV, giống file tải về"
  return (
    <div className={className}>
      {showInfo && (
        <p className="mx-auto mb-3.5 flex max-w-[720px] items-center gap-2 text-[13px] text-ink-3">
          <FileText className="size-[15px] shrink-0" strokeWidth={1.75} aria-hidden />
          {info}
        </p>
      )}
      {data.kind === "pages" ? (
        <div className="grid gap-5">
          {data.urls.map((url, i) => (
            <figure key={url} className="mx-auto w-full max-w-[720px]">
              {/* Ảnh trang do backend vẽ từ file gốc (blob URL), không qua tối ưu ảnh của Next */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${fileName}, trang ${i + 1}`} className={cn(SHEET, "block h-auto")} />
              {data.urls.length > 1 && (
                <figcaption className="mt-2 text-center text-xs text-ink-3">
                  Trang {i + 1} / {data.urls.length}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div className={cn(SHEET, "px-5 py-7 sm:px-12 sm:py-11")}>
          {data.kind === "document" ? (
            <CvDocumentView doc={data.doc} className="text-[#16161a]" />
          ) : (
            <PaperText text={data.text} />
          )}
        </div>
      )}
    </div>
  )
}

// ---------- Chế độ mock: chỉ có văn bản, tách thô thành phần đầu + các mục ----------

interface ParsedCv {
  header: string[]
  sections: { title: string; lines: { bullet: boolean; text: string }[] }[]
}

/** Dòng tiêu đề mục: viết hoa toàn bộ, ngắn (ví dụ "KINH NGHIỆM", "HỌC VẤN"). */
const isHeading = (line: string) =>
  line.length <= 60 && /\p{L}/u.test(line) && line === line.toLocaleUpperCase("vi") && !line.startsWith("-")

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

function renderLines(lines: ParsedCv["sections"][number]["lines"]): ReactNode[] {
  const out: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length === 0) return
    out.push(
      <ul key={`ul-${out.length}`} className="mt-1 list-disc pl-[22px]">
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
      <p key={`p-${out.length}`} className="mt-1.5 font-bold">
        {line.text}
      </p>,
    )
  }
  flush()
  return out
}

function PaperText({ text }: { text: string }) {
  const doc = parseCvText(text)
  const serif = { fontFamily: '"Times New Roman", Times, serif' }
  if (!doc) return <p className="text-sm whitespace-pre-line">{text}</p>
  const [name, ...meta] = doc.header
  return (
    <div className="text-[13.5px] leading-[1.4] break-words" style={serif}>
      <p className="text-center text-[22px] leading-7 font-bold uppercase">{name}</p>
      <p className="mt-0.5 text-center text-[12.5px]">{meta.join(" | ")}</p>
      {doc.sections.map((section, i) => (
        <section key={`${section.title}-${i}`} className="mt-3.5">
          <p className="mb-1 border-b border-current pb-px text-[14.5px] font-bold uppercase">{section.title}</p>
          {renderLines(section.lines)}
        </section>
      ))}
    </div>
  )
}
