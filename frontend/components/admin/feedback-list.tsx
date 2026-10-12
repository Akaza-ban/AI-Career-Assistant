"use client"

import { useCallback, useState } from "react"
import { AlertCircle, MessageSquareText, SearchX } from "lucide-react"

import { ACTIVITY_LABEL, CommentItem, PERIODS, formatCount } from "@/components/admin/admin-bits"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { REASON_LABELS } from "@/lib/feedback"
import type { AdminCommentsQuery, AdminPeriod } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20
const TRIGGER = "h-10 w-full rounded-[10px] border-line-strong bg-card px-3.5 text-sm text-ink-2 shadow-xs sm:w-auto sm:min-w-[170px]"

const STAR_ITEMS = [
  { value: "all", label: "Số sao: Tất cả" },
  ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} sao` })),
]
const ACTIVITY_ITEMS = [
  { value: "all", label: "Tính năng: Tất cả" },
  ...Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({ value, label })),
]
const REASON_ITEMS = [
  { value: "all", label: "Lý do: Tất cả" },
  ...Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label })),
]
const PERIOD_ITEMS = [{ value: "all", label: "Mọi thời gian" }, ...PERIODS]

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label={label} className={TRIGGER}>
        <SelectValue className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Mọi nhận xét sinh viên viết kèm đánh giá sao (mở từ "Xem tất cả" ở Tổng quan). Không kèm tên sinh viên.
export function FeedbackList() {
  const [stars, setStars] = useState("all")
  const [activity, setActivity] = useState("all")
  const [reason, setReason] = useState("all")
  const [period, setPeriod] = useState("all")
  const [page, setPage] = useState(0)

  const fetchPage = useCallback(() => {
    const query: AdminCommentsQuery = { offset: page * PAGE_SIZE, limit: PAGE_SIZE }
    if (stars !== "all") query.stars = Number(stars) as AdminCommentsQuery["stars"]
    if (activity !== "all") query.activity = activity as AdminCommentsQuery["activity"]
    if (reason !== "all") query.reason = reason
    if (period !== "all") query.days = Number(period) as AdminPeriod
    return api.listAdminComments(query)
  }, [stars, activity, reason, period, page])
  const { data, error, reload } = useApi(fetchPage)
  const filtered = stars !== "all" || activity !== "all" || reason !== "all" || period !== "all"
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  // Đổi bộ lọc thì về trang đầu
  const change = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(0)
  }

  return (
    <div className="grid gap-8 md:gap-10">
      <PageHeader
        title="Nhận xét"
        description={
          data
            ? filtered
              ? `${formatCount(data.total)} nhận xét khớp bộ lọc.`
              : `${formatCount(data.total)} nhận xét sinh viên viết kèm đánh giá sao.`
            : "Đang tải nhận xét…"
        }
      />

      {error && !data ? (
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={AlertCircle}
            title="Không tải được nhận xét"
            description={error.message}
            action={
              <Button size="brand" onClick={reload}>
                Thử lại
              </Button>
            }
          />
        </Panel>
      ) : (
        <section aria-label="Danh sách nhận xét" className="min-w-0">
          <div className="grid grid-cols-2 gap-2.5 border-b border-line pb-4 sm:flex sm:flex-wrap sm:items-center">
            <FilterSelect label="Lọc theo số sao" items={STAR_ITEMS} value={stars} onChange={change(setStars)} />
            <FilterSelect label="Lọc theo tính năng" items={ACTIVITY_ITEMS} value={activity} onChange={change(setActivity)} />
            <FilterSelect label="Lọc theo lý do" items={REASON_ITEMS} value={reason} onChange={change(setReason)} />
            <FilterSelect label="Lọc theo thời gian" items={PERIOD_ITEMS} value={period} onChange={change(setPeriod)} />
          </div>

          {!data ? (
            <div className="grid gap-2 pt-3" aria-busy="true" aria-label="Đang tải nhận xét">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-xl" />
              ))}
            </div>
          ) : data.total === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="Không có nhận xét nào khớp"
                description="Thử chọn số sao, tính năng, lý do hoặc khoảng thời gian khác."
                action={
                  <Button
                    variant="soft"
                    className="h-9 rounded-full px-4"
                    onClick={() => {
                      setStars("all")
                      setActivity("all")
                      setReason("all")
                      setPeriod("all")
                      setPage(0)
                    }}
                  >
                    Xoá bộ lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={MessageSquareText}
                title="Chưa có nhận xét"
                description="Nhận xét và lý do sinh viên chọn khi đánh giá sao sẽ hiện ở đây."
              />
            )
          ) : (
            <ul className={cn("transition-opacity", error && "opacity-60")}>
              {data.items.map((c) => (
                <CommentItem key={c.id} comment={c} />
              ))}
            </ul>
          )}

          {data && data.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-ink-3 tabular-nums">
                {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + data.items.length} / {formatCount(data.total)} nhận xét
              </span>
              {pageCount > 1 && (
                <span className="flex gap-2">
                  <PageButton disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Trước
                  </PageButton>
                  <PageButton disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
                    Sau
                  </PageButton>
                </span>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-full bg-card px-3 text-[13px] font-semibold text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] transition-[background-color,transform] hover:bg-panel active:scale-[.97] disabled:pointer-events-none disabled:opacity-50"
    >
      {children}
    </button>
  )
}
