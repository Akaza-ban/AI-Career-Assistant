"use client"

import Link from "next/link"

import { MatchBadge } from "@/components/common/match-badge"
import { WidgetFooter } from "@/components/common/zone"
import {
  cvOptionLabel,
  defaultCv,
  levelText,
  metaLine,
  useRecommendations,
} from "@/components/student/library/library-data"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"

const SHOWN = 3

/**
 * "Vị trí hợp với bạn": 3 gợi ý đầu theo CV đang dùng (chỉ nhãn, không điểm — DESIGN.md 8.1).
 * Dùng chung bộ nhớ đệm gợi ý với Thư viện JD. Ẩn hẳn khi chưa có CV hoặc gợi ý lỗi, vì khối này chỉ là lối tắt.
 */
export function FitPositions() {
  const cvs = useApi(api.listCvVersions)
  const cv = cvs.data ? defaultCv(cvs.data, null) : null
  const recs = useRecommendations(cv?.id ?? null, false)

  if ((cvs.data && !cv) || recs.error || cvs.error) return null
  const items = recs.data?.recommendations.slice(0, SHOWN) ?? []
  if (recs.data && items.length === 0) return null

  return (
    <section aria-labelledby="fit-positions" className="flex min-w-0 flex-col">
      <h3 id="fit-positions" className="mb-1.5 text-base font-semibold text-ink">
        Vị trí hợp với bạn
      </h3>
      <ul className="flex-1" aria-busy={recs.loading || !recs.data}>
        {recs.loading || !recs.data
          ? Array.from({ length: SHOWN }, (_, i) => (
              <li key={i} className="grid gap-1.5 border-b border-line py-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3.5 w-32" />
              </li>
            ))
          : items.map((item) => (
              <li key={item.jd_id}>
                <Link
                  href={`/student/library/${encodeURIComponent(item.jd_id)}${cv ? `?cv=${encodeURIComponent(cv.id)}` : ""}`}
                  className="-mx-2.5 flex items-center gap-3 rounded-[10px] border-b border-line px-2.5 py-3 transition-colors hover:bg-panel"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{item.title}</span>
                    <span className="block truncate text-[13px] text-ink-3">{metaLine(item.company, levelText(item.level))}</span>
                  </span>
                  {item.match_label && <MatchBadge label={item.match_label} />}
                </Link>
              </li>
            ))}
      </ul>
      <WidgetFooter
        link={{ label: "Mở Thư viện JD", href: "/student/library" }}
        note={cv && `theo ${cvOptionLabel(cv)}`}
        className="mt-3.5"
      />
    </section>
  )
}
