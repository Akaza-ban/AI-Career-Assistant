"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { FileText, Mail, MessagesSquare, UserRoundCheck } from "lucide-react"

import { useChat } from "@/components/chat/chat-context"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { Zone } from "@/components/common/zone"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { formatDate } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AdvisorContact, AdvisorFeedback, SharedItem, SharedItemKind } from "@/lib/types"
import { cn } from "@/lib/utils"

/** "09/10" */
const shortDate = (iso: string) => formatDate(iso).slice(0, 5)

/** "Cô Trần Thị Lan" → "Cô Lan": cách gọi ngắn trong dòng hoạt động. */
function shortName(fullName: string): string {
  const parts = fullName.replace(/^(ThS|TS|PGS\.TS|GS\.TS)\.?\s+/i, "").trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : fullName
}

// ---------- Thẻ cố vấn phụ trách ----------

export function AdvisorCard({ advisor }: { advisor: AdvisorContact | null }) {
  const { openChat, unread } = useChat()
  if (!advisor) {
    return (
      <div className="flex max-w-[980px] items-center gap-4 rounded-card bg-panel px-[22px] py-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink-3">
          <UserRoundCheck className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-ink">Bạn chưa được phân công cố vấn</p>
          <p className="text-sm text-ink-3">
            Khi bạn được phân công cố vấn, thông tin cố vấn sẽ hiện ở đây. Tài liệu vẫn riêng tư cho tới khi bạn bật chia sẻ.
          </p>
        </div>
      </div>
    )
  }
  return (
    <Panel className="flex max-w-[980px] flex-wrap items-center gap-4 px-[22px] py-5">
      <UserAvatar
        name={advisor.full_name}
        src={advisor.avatar_url}
        className="size-12 [&_[data-slot=avatar-fallback]]:bg-good-soft [&_[data-slot=avatar-fallback]]:font-sans [&_[data-slot=avatar-fallback]]:text-base [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-good"
      />
      <div className="min-w-[200px] flex-1">
        <p className="font-semibold text-ink">{advisor.full_name}</p>
        <p className="text-sm text-ink-3">{advisor.title}</p>
      </div>
      {unread > 0 && <Badge variant="blue">{unread} tin mới</Badge>}
      <Button variant="dark" className="h-[38px] gap-2 rounded-full px-4 font-semibold" onClick={() => openChat()}>
        <Mail aria-hidden />
        Nhắn tin
      </Button>
    </Panel>
  )
}

// ---------- Danh sách tài liệu có công tắc ----------

const INITIAL_ROWS = 6

/** API đặt tên báo cáo là "Phỏng vấn <vị trí>"; trong vùng "Phỏng vấn thử" chỉ cần tên vị trí. */
const itemTitle = (item: SharedItem) => (item.kind === "interview_report" ? item.title.replace(/^Phỏng vấn\s+/, "") : item.title)

function itemMeta(item: SharedItem): string {
  const parts =
    item.kind === "cv"
      ? [item.subtitle?.replace(/^Phiên bản\s+/, ""), `tải lên ${shortDate(item.created_at)}`]
      : [shortDate(item.created_at), item.score !== null ? `${formatScore(item.score)} / 5` : null, item.subtitle]
  if (item.shared && item.advisor_viewed_at) parts.push(`cố vấn đã xem ${shortDate(item.advisor_viewed_at)}`)
  return parts.filter(Boolean).join(" · ")
}

function ShareRow({ item, pending, onToggle }: { item: SharedItem; pending: boolean; onToggle: (shared: boolean) => void }) {
  const switchId = `share-${item.id}`
  return (
    <li className="flex items-center gap-4 border-b border-line py-4">
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <label htmlFor={switchId} className="min-w-0 cursor-pointer font-medium wrap-anywhere text-ink">
            {itemTitle(item)}
          </label>
          {item.tag === "primary" && (
            <Badge variant="good" className="h-[22px] px-2">
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              Đang dùng
            </Badge>
          )}
          {item.tag === "draft" && <Badge variant="neutral">Bản nháp</Badge>}
          {item.has_advisor_comment && <Badge variant="blue">Đã nhận xét</Badge>}
        </span>
        <span className="block text-sm text-ink-3">{itemMeta(item)}</span>
      </span>
      <Switch
        id={switchId}
        size="lg"
        checked={item.shared}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label={`Chia sẻ ${itemTitle(item)} với cố vấn`}
      />
    </li>
  )
}

const ZONE_META: Record<SharedItemKind, { id: string; title: string; empty: string; icon: typeof FileText }> = {
  cv: { id: "share-cv", title: "CV", empty: "Bạn chưa tải lên CV nào.", icon: FileText },
  interview_report: {
    id: "share-interview",
    title: "Phỏng vấn thử",
    empty: "Hoàn thành buổi phỏng vấn thử để chia sẻ báo cáo với cố vấn.",
    icon: MessagesSquare,
  },
}

interface ShareZoneProps {
  kind: SharedItemKind
  items: SharedItem[]
  pendingIds: Set<string>
  onChange: (ids: string[], shared: boolean) => void
}

export function ShareZone({ kind, items, pendingIds, onChange }: ShareZoneProps) {
  const [expanded, setExpanded] = useState(false)
  const meta = ZONE_META[kind]
  const list = items.filter((i) => i.kind === kind)
  const rows = expanded ? list : list.slice(0, INITIAL_ROWS)
  const sharedCount = list.filter((i) => i.shared).length

  return (
    <Zone
      id={meta.id}
      title={meta.title}
      aside={
        list.length > 0 && (
          <span className="text-sm text-ink-3 tabular-nums">
            Đang chia sẻ {sharedCount} / {list.length}
          </span>
        )
      }
      // Dòng đầu nằm sát đường kẻ tiêu đề như bản vẽ.
      className="[&>div:last-child]:pt-0"
    >
      {list.length === 0 ? (
        <EmptyState icon={meta.icon} title="Chưa có gì để chia sẻ" description={meta.empty} className="border-b border-line" />
      ) : (
        <ul>
          {rows.map((item) => (
            <ShareRow
              key={item.id}
              item={item}
              pending={pendingIds.has(item.id)}
              onToggle={(value) => onChange([item.id], value)}
            />
          ))}
        </ul>
      )}
      {list.length > INITIAL_ROWS && (
        <Button
          variant="ghost"
          className="mt-3 h-9 font-semibold text-blue hover:bg-surface hover:text-accent-strong"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Thu gọn" : `Xem thêm ${list.length - INITIAL_ROWS}`}
        </Button>
      )}
    </Zone>
  )
}

// ---------- Cột phải ----------

function SideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-base font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}

/** Cố vấn luôn thấy số liệu tổng hợp; nội dung chỉ thấy khi SV bật chia sẻ. */
export function AdvisorVisibility() {
  const rows = [
    { title: "Khi bạn bật", text: "CV và buổi phỏng vấn đã chọn: file CV, câu trả lời, nhận xét trong báo cáo." },
    { title: "Luôn thấy", text: "Số liệu tổng hợp: số buổi, điểm từng buổi, mức tiến bộ, độ khớp CV." },
  ]
  return (
    <SideBlock title="Cố vấn xem được gì">
      {rows.map((r) => (
        <div key={r.title} className="border-b border-line py-3 text-sm">
          <p className="font-medium text-ink">{r.title}</p>
          <p className="text-ink-2">{r.text}</p>
        </div>
      ))}
    </SideBlock>
  )
}

interface ActivityEntry {
  key: string
  at: string
  text: string
  href?: string
  unread?: boolean
  onOpen?: () => void
}

const RECENT_LIMIT = 5

/** Nhận xét mới của cố vấn và các lần cố vấn mở tài liệu, mới nhất trước. */
export function RecentActivity({
  advisor,
  feedback,
  items,
  onOpen,
}: {
  advisor: AdvisorContact | null
  feedback: AdvisorFeedback[]
  items: SharedItem[]
  onOpen: (id: string) => void
}) {
  const fallbackName = advisor ? shortName(advisor.full_name) : "Cố vấn"
  const entries: ActivityEntry[] = [
    ...feedback.map((f) => ({
      key: `fb-${f.id}`,
      at: f.created_at,
      // Nhãn API: "Phỏng vấn <vị trí> · <ngày>"; cột trái đã có ngày nên bỏ phần ngày.
      text: `${shortName(f.advisor_name)} nhận xét buổi phỏng vấn ${f.target.label.replace(/^Phỏng vấn\s+/, "").replace(/\s+·\s+[\d/]+$/, "")}`,
      href: `/student/interview/${encodeURIComponent(f.target.id)}/report`,
      unread: !f.read,
      onOpen: () => onOpen(f.id),
    })),
    ...items
      .filter((i) => i.shared && i.advisor_viewed_at)
      .map((i) => ({
        key: `view-${i.id}`,
        at: i.advisor_viewed_at as string,
        text: `${fallbackName} đã xem ${i.kind === "cv" ? i.title : `buổi phỏng vấn ${itemTitle(i)}`}`,
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, RECENT_LIMIT)

  return (
    <SideBlock title="Gần đây">
      {entries.length === 0 ? (
        <p className="border-b border-line py-3 text-sm text-ink-3">
          Chưa có hoạt động nào. Bật chia sẻ một buổi phỏng vấn để cố vấn góp ý.
        </p>
      ) : (
        <ul>
          {entries.map((e) => {
            const body = (
              <>
                <span className="w-11 shrink-0 text-ink-3 tabular-nums">{shortDate(e.at)}</span>
                <span className={cn("min-w-0 flex-1", e.unread && "font-medium")}>{e.text}</span>
                {e.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue" aria-label="Chưa đọc" />}
              </>
            )
            return (
              <li key={e.key} className="border-b border-line text-sm text-ink">
                {e.href ? (
                  <Link
                    href={e.href}
                    onClick={e.onOpen}
                    className="-mx-2.5 flex gap-3.5 rounded-[10px] px-2.5 py-3 transition-colors hover:bg-panel"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex gap-3.5 py-3">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SideBlock>
  )
}
