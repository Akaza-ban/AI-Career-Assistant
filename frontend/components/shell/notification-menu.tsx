"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import {
  Bell,
  CheckCheck,
  ChevronRight,
  FileSearch,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react"

import { SegmentedControl } from "@/components/common/segmented-control"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime, isToday } from "@/lib/format"
import type { AppNotification, NotificationKind, Role } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** Icon trung tính cho mọi loại; chỉ cảnh báo liêm chính mới có màu. */
const kindIcon: Record<NotificationKind, LucideIcon> = {
  advisor_comment: MessageSquareText,
  interview_report: Sparkles,
  gap_analysis: FileSearch,
  integrity_alert: ShieldAlert,
  student_activity: MessageSquareText,
  student_inactive: UserRoundX,
  advisor_assigned: UserRoundCheck,
  student_registered: UserPlus,
}

type Filter = "all" | "unread"

/** Bảng nổi dùng chung cho thông báo, tài khoản và tin nhắn (DESIGN.md 5.3). */
export const floatingSurface = "rounded-[18px] bg-card shadow-float ring-1 ring-line"

export function NotificationMenu({ role }: { role: Role }) {
  const fetchNotifications = useCallback(() => api.listNotifications(role), [role])
  const { data, loading, reload } = useApi(fetchNotifications)
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState(false)
  // Đánh dấu đã đọc ngay trên giao diện, không chờ tải lại danh sách.
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())

  const items = (data ?? []).map((n) => (readIds.has(n.id) ? { ...n, read: true } : n))
  const unread = items.filter((n) => !n.read).length
  const visible = items.filter((n) => filter === "all" || !n.read)
  const today = visible.filter((n) => isToday(n.created_at))
  const earlier = visible.filter((n) => !isToday(n.created_at))

  async function markAllRead() {
    setReadIds(new Set(items.map((n) => n.id)))
    await api.markAllNotificationsRead(role)
    reload()
  }

  function openNotification(n: AppNotification) {
    setOpen(false)
    if (n.read) return
    setReadIds((ids) => new Set(ids).add(n.id))
    api.markNotificationRead(role, n.id).catch(() => {
      setReadIds((ids) => {
        const next = new Set(ids)
        next.delete(n.id)
        return next
      })
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative size-10 rounded-full text-ink-2 hover:text-ink"
            aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
          />
        }
      >
        <Bell className="size-[19px]" strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-blue px-1 text-[10px] leading-none font-semibold text-on-blue">
            {unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className={cn("w-[400px] max-w-[calc(100vw-2rem)] gap-0 p-0", floatingSurface)}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h2 className="text-base leading-6 font-semibold text-ink">Thông báo</h2>
            <p className="text-[13px] text-ink-3">{unread > 0 ? `${unread} chưa đọc` : "Đã xem hết"}</p>
          </div>
          <SegmentedControl<Filter>
            aria-label="Lọc thông báo"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Tất cả" },
              { value: "unread", label: "Chưa đọc" },
            ]}
            className="w-[168px] shrink-0"
          />
        </div>

        <div className="max-h-[440px] overflow-y-auto border-t border-line px-2 py-2 [scrollbar-width:thin]">
          {loading ? (
            <NotificationSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <NotificationGroup label="Hôm nay" items={today} onOpen={openNotification} />
              <NotificationGroup label="Trước đó" items={earlier} onOpen={openNotification} />
            </>
          )}
        </div>

        {unread > 0 && (
          <div className="border-t border-line px-3 py-2">
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <CheckCheck className="size-4" aria-hidden />
              Đánh dấu tất cả đã đọc
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function NotificationGroup({
  label,
  items,
  onOpen,
}: {
  label: string
  items: AppNotification[]
  onOpen: (n: AppNotification) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="not-first:mt-1">
      <h3 className="px-3 pt-2 pb-1 text-[13px] font-medium text-ink-3">{label}</h3>
      <ul>
        {items.map((n) => (
          <NotificationRow key={n.id} notification={n} onOpen={() => onOpen(n)} />
        ))}
      </ul>
    </section>
  )
}

/** Cả dòng là một link: bấm vào thì mở trang liên quan và đánh dấu đã đọc. */
function NotificationRow({ notification: n, onOpen }: { notification: AppNotification; onOpen: () => void }) {
  const Icon = kindIcon[n.kind]
  const alert = n.kind === "integrity_alert"
  const body = (
    <>
      <span
        className={cn(
          "relative mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
          alert ? "bg-bad-soft text-bad" : "bg-surface text-ink-2",
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        {!n.read && (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-blue ring-2 ring-card" aria-label="Chưa đọc" />
        )}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("text-sm leading-5", n.read ? "text-ink-2" : "font-medium text-ink")}>{n.title}</span>
        <span className="line-clamp-2 text-[13px] leading-5 text-ink-3">{n.body}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-ink-3">
          {formatRelativeTime(n.created_at)}
          {n.action_label && n.action_href && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center font-semibold text-blue">
                {n.action_label}
                <ChevronRight className="size-3.5" aria-hidden />
              </span>
            </>
          )}
        </span>
      </span>
    </>
  )
  const rowClass = "flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-panel"
  return (
    <li>
      {n.action_href ? (
        <Link href={n.action_href} onClick={onOpen} className={rowClass}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className={cn(rowClass, "w-full text-left")}>
          {body}
        </button>
      )}
    </li>
  )
}

function EmptyState() {
  return (
    <div className="grid justify-items-center gap-1.5 px-6 py-12 text-center">
      <span className="mb-1.5 grid size-11 place-items-center rounded-full bg-surface text-ink-2">
        <Bell className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-ink">Bạn đã xem hết thông báo</p>
      <p className="text-[13px] text-ink-3">Thông báo mới sẽ hiện ở đây.</p>
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="grid gap-4 p-3" aria-label="Đang tải thông báo">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
