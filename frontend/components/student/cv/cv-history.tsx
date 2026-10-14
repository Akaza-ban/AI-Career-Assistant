"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { formatPercent } from "@/lib/analysis"
import type { CvVersion } from "@/lib/types"
import { cn } from "@/lib/utils"

/** "09/10" trong năm nay, ngược lại "09/10/2025". */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  const dm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
  return d.getFullYear() === new Date().getFullYear() ? dm : `${dm}/${d.getFullYear()}`
}

function originText(cv: CvVersion, isFirst: boolean): string | null {
  if (cv.origin === "optimized") return cv.source_jd_title ? `Tối ưu cho ${cv.source_jd_title}` : "Tối ưu bằng Trình tối ưu"
  if (cv.origin === "restored") return cv.restored_from_label ? `Khôi phục từ ${cv.restored_from_label}` : "Khôi phục bản cũ"
  return isFirst ? null : "Tải lên bản mới"
}

const linkClass = "font-semibold text-blue hover:text-accent-strong"

interface VersionTimelineProps {
  /** Mới nhất trước. */
  versions: CvVersion[]
  selectedId: string
  onSelect: (cv: CvVersion) => void
  onRestore: (cv: CvVersion) => void
}

/** Lịch sử phiên bản dạng dòng thời gian: chấm đặc = bản hiện tại, chấm màu nhấn = bản đang xem. */
export function VersionTimeline({ versions, selectedId, onSelect, onRestore }: VersionTimelineProps) {
  return (
    <section aria-labelledby="cv-history-title">
      <h3 id="cv-history-title" className="mb-3.5 text-base font-semibold text-ink">
        Lịch sử phiên bản
      </h3>
      <ol className="relative pl-[26px]" aria-label="Các phiên bản, mới nhất trước">
        <span aria-hidden className="absolute top-2 bottom-2 left-1.5 w-[1.5px] bg-line-strong" />
        {versions.map((cv, i) => {
          const current = i === 0
          const first = i === versions.length - 1
          const selected = cv.id === selectedId
          const origin = originText(cv, first)
          return (
            <li key={cv.id} className={cn("relative", !first && "pb-5")}>
              <span
                aria-hidden
                className={cn(
                  "absolute top-1 -left-[26px] size-[13px] rounded-full shadow-[0_0_0_3px_var(--bg)]",
                  current ? "bg-ink" : selected ? "bg-blue" : "border-[1.5px] border-line-strong bg-card",
                )}
              />
              <div className="flex items-center gap-2">
                <b className="font-semibold text-ink">{cv.label}</b>
                {current && (
                  <Badge variant="good" className="h-[22px] px-2">
                    Hiện tại
                  </Badge>
                )}
                {selected && !current && (
                  <Badge variant="blue" className="h-[22px] px-2">
                    Đang xem
                  </Badge>
                )}
                {first && !current && <span className="text-[13px] text-ink-3">Bản gốc</span>}
                <span className="ml-auto text-[13px] text-ink-3 tabular-nums">{shortDate(cv.uploaded_at)}</span>
              </div>
              {origin && <p className="text-sm text-ink-2">{origin}</p>}
              {(!selected || !current || cv.source_analysis_id) && (
                <div className="mt-0.5 flex flex-wrap gap-x-3.5 gap-y-0.5 text-sm">
                  {!selected && (
                    <button type="button" className={linkClass} onClick={() => onSelect(cv)}>
                      Xem<span className="sr-only"> phiên bản {cv.label}</span>
                    </button>
                  )}
                  {!current && (
                    <button type="button" className={linkClass} onClick={() => onRestore(cv)}>
                      Khôi phục<span className="sr-only"> phiên bản {cv.label}</span>
                    </button>
                  )}
                  {cv.source_analysis_id && (
                    <Link
                      href={`/student/analysis/${encodeURIComponent(cv.source_analysis_id)}/export`}
                      className={linkClass}
                    >
                      Xem thay đổi
                    </Link>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-[13px] text-ink-3">Khôi phục tạo phiên bản mới là bản sao của bản cũ; không bản nào bị xoá.</p>
    </section>
  )
}

/** Độ khớp của từng phiên bản đã phân tích, cũ trước mới sau; bản hiện tại tô màu nhấn. */
export function MatchTrend({ versions, analyzeHref }: { versions: CvVersion[]; analyzeHref: string }) {
  const headId = versions[0]?.id
  const scored = versions.filter((v) => v.match_score !== null).reverse()
  const target = versions.find((v) => v.target_title)?.target_title
  return (
    <section aria-labelledby="cv-trend-title">
      <h3 id="cv-trend-title" className="mb-1.5 text-base font-semibold text-ink">
        Độ khớp qua các phiên bản
      </h3>
      {scored.length === 0 ? (
        <p className="py-2.5 text-sm text-ink-3">
          Chưa có phiên bản nào được phân tích.{" "}
          <Link href={analyzeHref} className={linkClass}>
            Phân tích ngay
          </Link>
        </p>
      ) : (
        <>
          <ul>
            {scored.map((v) => (
              <li
                key={v.id}
                className="grid grid-cols-[48px_minmax(0,1fr)_56px] items-center gap-3 border-b border-line py-[11px] text-sm"
              >
                <span className="text-ink-3">{v.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", v.id === headId ? "bg-blue" : "bg-line-strong")}
                    style={{ width: `${Math.max(0, Math.min(100, v.match_score!))}%` }}
                  />
                </span>
                <b className="text-right font-semibold text-ink tabular-nums">{formatPercent(v.match_score!)}%</b>
              </li>
            ))}
          </ul>
          {target && <p className="mt-2.5 text-[13px] text-ink-3">So với {target}</p>}
        </>
      )}
    </section>
  )
}
