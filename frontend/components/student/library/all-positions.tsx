"use client"

import { useId, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Check, Heart, Search, SlidersHorizontal, Star } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { MatchBadge } from "@/components/common/match-badge"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone } from "@/components/common/zone"
import { HeartButton, RecommendedStar } from "@/components/student/library/library-bits"
import {
  levelText,
  metaLine,
  requiredLine,
  type RecommendationLookup,
  type SavedState,
} from "@/components/student/library/library-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { JobDescription } from "@/lib/types"
import { cn } from "@/lib/utils"

type Scope = "all" | "saved"
const ALL_INDUSTRIES = "all"

/** Bỏ dấu để tìm "phan tich" vẫn ra "Phân tích". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()

interface AllPositionsProps {
  library: JobDescription[] | undefined
  error: Error | undefined
  onRetry: () => void
  recs: RecommendationLookup
  saved: SavedState
  detailHref: (jdId: string) => string
  onOpen: (jdId: string) => void
}

export function AllPositions({ library, error, onRetry, recs, saved, detailHref, onOpen }: AllPositionsProps) {
  const titleId = useId()
  const [query, setQuery] = useState("")
  const [industry, setIndustry] = useState(ALL_INDUSTRIES)
  const [scope, setScope] = useState<Scope>("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const industries = useMemo(
    () =>
      [...new Set((library ?? []).map((jd) => jd.industry).filter((v): v is string => !!v))].sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [library],
  )
  const industryItems = [
    { value: ALL_INDUSTRIES, label: "Tất cả ngành" },
    ...industries.map((name) => ({ value: name, label: name })),
  ]

  const rows = useMemo(() => {
    const q = fold(query.trim())
    return (library ?? [])
      .filter((jd) => {
        if (scope === "saved" && !saved.savedIds.has(jd.id)) return false
        if (industry !== ALL_INDUSTRIES && jd.industry !== industry) return false
        if (!q) return true
        return fold([jd.title, jd.company ?? "", ...jd.skills.map((s) => s.name)].join(" ")).includes(q)
      })
      .sort(
        (a, b) =>
          (recs.get(a.id)?.rank ?? Infinity) - (recs.get(b.id)?.rank ?? Infinity) || a.title.localeCompare(b.title, "vi"),
      )
  }, [library, query, industry, scope, saved.savedIds, recs])

  const clearFilters = () => {
    setQuery("")
    setIndustry(ALL_INDUSTRIES)
    setScope("all")
  }
  // Chỉ đếm vị trí có trong kho; JD tự dán cũng có thể nằm trong danh sách đã lưu.
  const savedCount = useMemo(() => (library ?? []).filter((jd) => saved.savedIds.has(jd.id)).length, [library, saved.savedIds])
  const noSaved = scope === "saved" && savedCount === 0

  return (
    <Zone
      id={titleId}
      title="Tất cả vị trí"
      aside={library && <span className="text-[13px] text-ink-3 tabular-nums">{rows.length} vị trí</span>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-1 basis-[240px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input data-assistant-id="jd-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Tìm vị trí, công ty, kỹ năng"
            placeholder="Tìm vị trí, công ty, kỹ năng…"
            className="h-[42px] rounded-[12px] border-transparent bg-surface pr-3 pl-9 text-sm md:h-[38px] md:rounded-[10px] md:border-line-strong md:bg-card"
          />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="text-[13px] text-ink-3" aria-hidden>
            Ngành
          </span>
          <Select items={industryItems} value={industry} onValueChange={(v) => setIndustry(String(v ?? ALL_INDUSTRIES))}>
            <SelectTrigger
              aria-label="Lọc theo ngành"
              className="h-[38px] min-w-44 rounded-[10px] border-line-strong bg-card px-3 text-sm text-ink shadow-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {industryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label={industry === ALL_INDUSTRIES ? "Lọc theo ngành" : `Lọc theo ngành: ${industry}`}
          className="relative grid size-[42px] shrink-0 place-items-center rounded-[12px] bg-surface text-ink md:hidden"
        >
          <SlidersHorizontal className="size-[17px]" strokeWidth={1.75} aria-hidden />
          {industry !== ALL_INDUSTRIES && (
            <span className="absolute top-2 right-2 size-[7px] rounded-full bg-blue" aria-hidden />
          )}
        </button>

        <SegmentedControl
          aria-label="Phạm vi"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "saved", label: "Đã lưu", count: savedCount },
          ]}
          className="basis-full md:w-[210px] md:basis-auto"
        />
      </div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-4">
          <AlertCircle className="size-5 shrink-0 text-bad" aria-hidden />
          <p className="min-w-0 flex-1 basis-48 text-sm text-ink-2">Không tải được thư viện JD. {error.message}</p>
          <Button variant="soft" className="h-9 rounded-full px-4" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      ) : !library ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        noSaved && !query && industry === ALL_INDUSTRIES ? (
          <EmptyState
            icon={Heart}
            title="Chưa lưu vị trí nào"
            description="Bấm biểu tượng trái tim ở vị trí bất kỳ để lưu và dùng lại khi phân tích."
          />
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-7 text-sm text-ink-2">
            Không có vị trí nào khớp bộ lọc.
            <Button variant="soft" className="h-[34px] rounded-full px-3.5 text-[13px] font-semibold" onClick={clearFilters}>
              Xoá bộ lọc
            </Button>
          </div>
        )
      ) : (
        <>
          <table className="hidden w-full table-fixed border-collapse md:table">
            <caption className="sr-only">Danh sách vị trí trong thư viện</caption>
            <colgroup>
              <col />
              <col className="w-[30%]" />
              <col className="w-24" />
              <col className="w-[120px]" />
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold tracking-[.03em] text-ink-3 uppercase">
                <th scope="col" className="py-2 pr-3 pl-0 font-semibold">Vị trí</th>
                <th scope="col" className="px-3 py-2 font-semibold">Công ty</th>
                <th scope="col" className="px-3 py-2 font-semibold">Cấp bậc</th>
                <th scope="col" className="px-3 py-2 font-semibold">Mức phù hợp</th>
                <th scope="col" className="py-2 pr-0 pl-2">
                  <span className="sr-only">Lưu</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((jd) => {
                const rec = recs.get(jd.id)
                return (
                  <tr key={jd.id} className="relative border-b border-line transition-colors hover:bg-panel">
                    <td className="min-w-0 py-3.5 pr-3 pl-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {rec && <RecommendedStar />}
                        {/* Link phủ cả dòng; nút lưu nằm trên lớp phủ (z-[1]). */}
                        <Link
                          href={detailHref(jd.id)}
                          className="truncate text-[15px] font-medium text-ink after:absolute after:inset-0 hover:text-accent-strong"
                        >
                          {jd.title}
                        </Link>
                      </div>
                      <p className="truncate text-[13px] text-ink-3">{requiredLine(jd)}</p>
                    </td>
                    <td className="truncate px-3 py-3.5 text-sm text-ink-2">{jd.company ?? "—"}</td>
                    <td className="px-3 py-3.5 text-sm text-ink-2">{levelText(jd.level) ?? "—"}</td>
                    <td className="px-3 py-3.5">
                      {rec?.item.match_label ? (
                        <MatchBadge label={rec.item.match_label} />
                      ) : (
                        <span className="text-sm text-ink-3">
                          —<span className="sr-only">Chưa có trong gợi ý</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-0 pl-2 text-right">
                      <HeartButton
                        saved={saved.savedIds.has(jd.id)}
                        title={jd.title}
                        onToggle={() => saved.toggle(jd.id)}
                        className="-mr-2 ml-auto"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <ul className="md:hidden" aria-label="Danh sách vị trí">
            {rows.map((jd) => {
              const rec = recs.get(jd.id)
              return (
                <li key={jd.id} className="flex items-center gap-1 border-b border-line">
                  <button
                    type="button"
                    onClick={() => onOpen(jd.id)}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 py-3.5 pr-1 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {rec && <RecommendedStar className="size-3" />}
                      <span className="truncate text-[15px] font-medium text-ink">{jd.title}</span>
                    </span>
                    <span className="truncate text-[13px] text-ink-3">{metaLine(jd.company, levelText(jd.level))}</span>
                  </button>
                  {rec?.item.match_label && <MatchBadge label={rec.item.match_label} className="shrink-0" />}
                  <HeartButton
                    saved={saved.savedIds.has(jd.id)}
                    title={jd.title}
                    onToggle={() => saved.toggle(jd.id)}
                    className="-mr-2.5 size-11"
                  />
                </li>
              )
            })}
          </ul>

          {/* Dòng chân: chú thích dấu sao bên trái, cách sắp xếp bên phải. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5 text-[13px] text-ink-3">
            {recs.size > 0 ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-3 fill-blue text-blue" strokeWidth={1.5} aria-hidden />
                  Nằm trong gợi ý cho CV đang chọn
                </span>
                <span>Xếp theo thứ tự gợi ý</span>
              </>
            ) : (
              <>
                <span />
                <span>Xếp theo tên vị trí</span>
              </>
            )}
          </div>
        </>
      )}
      </div>

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-[22px] px-3 pt-3 pb-6">
          <span className="mx-auto h-1 w-9 rounded-full bg-line-strong" aria-hidden />
          <SheetTitle className="px-3 font-heading text-lg font-bold">Lọc theo ngành</SheetTitle>
          <div role="radiogroup" aria-label="Ngành" className="grid gap-0.5">
            {industryItems.map((item) => {
              const on = item.value === industry
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setIndustry(item.value)
                    setFilterOpen(false)
                  }}
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 rounded-[10px] px-3 text-left text-[15px]",
                    on ? "bg-surface font-semibold text-ink" : "font-medium text-ink-2 hover:bg-surface",
                  )}
                >
                  {item.label}
                  {on && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </Zone>
  )
}

function TableSkeleton() {
  return (
    <div className="grid" aria-busy="true" aria-label="Đang tải danh sách vị trí">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-1 py-4 md:px-3">
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="h-4 w-1/2 max-w-64" />
            <Skeleton className="h-3.5 w-1/3 max-w-48" />
          </div>
          <Skeleton className="hidden h-4 w-40 md:block" />
          <Skeleton className="h-[22px] w-16 rounded-badge" />
        </div>
      ))}
    </div>
  )
}
