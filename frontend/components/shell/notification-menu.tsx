"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import {
  Bell,
  CheckCheck,
  FileSearch,
  MailCheck,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  UserRoundX,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatRelativeTime, isToday } from "@/lib/format"
import type { AppNotification, NotificationKind, Role } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const kindStyle: Record<NotificationKind, { icon: LucideIcon; className: string }> = {
  advisor_comment: { icon: MessageSquareText, className: "bg-blue-soft text-blue" },
  interview_report: { icon: Sparkles, className: "bg-violet-soft text-violet" },
  gap_analysis: { icon: FileSearch, className: "bg-violet-soft text-violet" },
  integrity_alert: { icon: ShieldAlert, className: "bg-bad-soft text-bad" },
  student_activity: { icon: MessageSquareText, className: "bg-warn-soft text-warn" },
  student_inactive: { icon: UserRoundX, className: "bg-warn-soft text-warn" },
}

type Filter = "all" | "unread"

// Theo frame "Kiểu thông báo và dropdown": 400px, tab Tất cả/Chưa đọc, nhóm theo ngày,
// trạng thái rỗng và skeleton khi đang tải.
export function NotificationMenu({ role }: { role: Role }) {
  const fetchNotifications = useCallback(() => api.listNotifications(role), [role])
  const { data, loading, reload } = useApi(fetchNotifications)
  const [filter, setFilter] = useState<Filter>("all")

  const unread = data?.filter((n) => !n.read).length ?? 0
  const visible = (data ?? []).filter((n) => filter === "all" || !n.read)
  const today = visible.filter((n) => isToday(n.created_at))
  const earlier = visible.filter((n) => !isToday(n.created_at))

  async function markAllRead() {
    await api.markAllNotificationsRead(role)
    reload()
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="relative rounded-lg text-ink-2 hover:text-ink"
            aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] leading-none font-semibold text-white">
            {unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[400px] max-w-[calc(100vw-2rem)] gap-0 rounded-[20px] p-0">
        <div className="grid gap-3 border-b border-line px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-bold">Thông báo</h2>
            {unread > 0 && <Badge variant="blue">{unread} mới</Badge>}
          </div>
          <div role="tablist" aria-label="Lọc thông báo" className="flex gap-1">
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === value ? "bg-blue text-on-blue" : "text-ink-2 hover:bg-surface",
                )}
              >
                {value === "all" ? "Tất cả" : `Chưa đọc (${unread})`}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <NotificationSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <NotificationGroup label="Hôm nay" items={today} />
              <NotificationGroup label="Trước đó" items={earlier} />
            </>
          )}
        </div>

        {unread > 0 && (
          <div className="border-t border-line px-2 py-1.5">
            <Button variant="ghost" size="sm" className="text-blue hover:text-blue" onClick={markAllRead}>
              <CheckCheck aria-hidden />
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function NotificationGroup({ label, items }: { label: string; items: AppNotification[] }) {
  if (items.length === 0) return null
  return (
    <section>
      <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</h3>
      <ul>
        {items.map((n) => (
          <NotificationRow key={n.id} notification={n} />
        ))}
      </ul>
    </section>
  )
}

function NotificationRow({ notification: n }: { notification: AppNotification }) {
  const { icon: Icon, className } = kindStyle[n.kind]
  return (
    <li className={cn("flex gap-3 px-4 py-3", n.kind === "integrity_alert" && "bg-bad-soft/40")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", className)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", n.read ? "font-medium text-ink-2" : "font-semibold text-ink")}>
            {n.action_href && !n.action_label ? (
              <Link href={n.action_href} className="hover:underline">
                {n.title}
              </Link>
            ) : (
              n.title
            )}
          </p>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue" aria-label="Chưa đọc" />}
        </div>
        <p className="line-clamp-2 text-xs text-ink-2">{n.body}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-3">{formatRelativeTime(n.created_at)}</span>
          {n.action_label && n.action_href && (
            <Button size="xs" nativeButton={false} render={<Link href={n.action_href} />}>
              {n.action_label}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-blue-soft text-blue">
        <MailCheck className="size-6" aria-hidden />
      </span>
      <p className="font-heading text-sm font-bold">Bạn đã xem hết thông báo</p>
      <p className="text-xs text-ink-2">Không có thông báo mới nào cần xử lý.</p>
    </div>
  )
}

function NotificationSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-label="Đang tải thông báo">
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
