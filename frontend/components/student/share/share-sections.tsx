"use client"

import Link from "next/link"
import { useState } from "react"
import {
  BarChart3,
  Clock,
  Eye,
  FileText,
  FileX2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  SquareArrowOutUpRight,
  UserRoundCheck,
} from "lucide-react"

import { useChat } from "@/components/chat/chat-context"
import { Panel } from "@/components/common/panel"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { formatPercent } from "@/lib/analysis"
import { formatDate, formatWhen } from "@/lib/format"
import { formatScore } from "@/lib/interview"
import type { AdvisorContact, AdvisorFeedback, SharedItem, SharedItemKind } from "@/lib/types"
import { cn } from "@/lib/utils"

// ---------- Thẻ cố vấn phụ trách ----------

export function AdvisorCard({ advisor }: { advisor: AdvisorContact | null }) {
  const { openChat } = useChat()
  if (!advisor) {
    return (
      <Panel className="flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface text-ink-3">
          <UserRoundCheck className="size-6" aria-hidden />
        </span>
        <div className="grid gap-1">
          <p className="font-heading font-bold">Bạn chưa được phân công cố vấn</p>
          <p className="text-sm text-ink-2">
            Khi nhà trường phân công, cố vấn sẽ xuất hiện ở đây. Tài liệu của bạn vẫn riêng tư cho tới khi bạn bật chia sẻ.
          </p>
        </div>
      </Panel>
    )
  }
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex min-w-0 items-center gap-5">
        <span className="relative shrink-0">
          <UserAvatar name={advisor.full_name} src={advisor.avatar_url} className="size-16 [&_[data-slot=avatar-fallback]]:text-lg" />
          <span className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-card bg-good" aria-hidden />
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-lg font-bold">{advisor.full_name}</span>
            <Badge variant="good" className="h-auto gap-1 px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-good" aria-hidden />
              Cố vấn phụ trách của bạn
            </Badge>
          </p>
          <p className="text-sm text-ink-2">{advisor.title}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
            <a href={`mailto:${advisor.email}`} className="flex items-center gap-1 hover:text-blue">
              <Mail className="size-3.5" aria-hidden />
              {advisor.email}
            </a>
            {advisor.office && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                Văn phòng: {advisor.office}
              </span>
            )}
            {advisor.office_hours && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                Giờ tư vấn: {advisor.office_hours}
              </span>
            )}
          </p>
        </div>
      </div>
      <Button size="brand" onClick={() => openChat()}>
        <MessageCircle aria-hidden />
        Nhắn tin cho cố vấn
      </Button>
    </Panel>
  )
}

// ---------- Danh sách tài liệu chia sẻ ----------

type ShareTab = "all" | SharedItemKind

const KIND_META: Record<
  SharedItemKind,
  { on: typeof FileText; off: typeof FileText; dateLabel: string; score: (value: number) => string }
> = {
  cv: { on: FileText, off: FileX2, dateLabel: "Tải lên", score: (v) => `Độ khớp JD gần nhất: ${formatPercent(v)}%` },
  interview_report: { on: Mic, off: MicOff, dateLabel: "Hoàn thành", score: (v) => `Điểm STAR: ${formatScore(v)}/5` },
}

function ItemStatus({ item }: { item: SharedItem }) {
  if (!item.shared) {
    return (
      <span className="flex items-center gap-1.5 text-ink-3">
        <Lock className="size-3.5" aria-hidden />
        Chỉ mình bạn thấy
      </span>
    )
  }
  if (item.has_advisor_comment) {
    return (
      <span className="flex items-center gap-1.5 text-violet">
        <MessageSquareText className="size-3.5" aria-hidden />
        Cố vấn đã để lại nhận xét
      </span>
    )
  }
  if (item.advisor_viewed_at) {
    return (
      <span className="flex items-center gap-1.5 text-good">
        <Eye className="size-3.5" aria-hidden />
        Cố vấn đã xem {formatWhen(item.advisor_viewed_at).toLowerCase()}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-ink-2">
      <Clock className="size-3.5" aria-hidden />
      Đang chia sẻ, cố vấn chưa xem
    </span>
  )
}

function SharedItemRow({
  item,
  pending,
  onToggle,
}: {
  item: SharedItem
  pending: boolean
  onToggle: (shared: boolean) => void
}) {
  const meta = KIND_META[item.kind]
  const Icon = item.shared ? meta.on : meta.off
  const isCv = item.kind === "cv"
  const switchId = `share-${item.id}`
  return (
    <li
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 transition-colors",
        item.shared ? "border-blue/15 bg-blue-soft/35" : "border-line bg-surface/60",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl",
          !item.shared ? "bg-card text-ink-3" : isCv ? "bg-blue-soft text-blue" : "bg-violet-soft text-violet",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor={switchId} className="truncate font-heading font-bold text-ink">
            {item.title}
          </label>
          {item.tag === "primary" && <Badge variant="blue">CV đang dùng</Badge>}
          {item.tag === "draft" && <Badge variant="neutral">Bản nháp</Badge>}
          {!isCv && <Badge variant="violet">Phỏng vấn thử</Badge>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
          {item.subtitle && (
            <>
              <span>{item.subtitle}</span>
              <span aria-hidden>•</span>
            </>
          )}
          <span>
            {meta.dateLabel} {formatDate(item.created_at)}
          </span>
          {item.score !== null && (
            <>
              <span aria-hidden>•</span>
              <span className={cn("font-medium", !item.shared ? "text-ink-2" : isCv ? "text-blue" : "text-violet")}>
                {meta.score(item.score)}
              </span>
            </>
          )}
        </p>
        <p className="text-xs">
          <ItemStatus item={item} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("w-8 text-right text-xs font-semibold", item.shared ? "text-blue" : "text-ink-3")} aria-hidden>
          {item.shared ? "BẬT" : "TẮT"}
        </span>
        <Switch id={switchId} size="lg" checked={item.shared} disabled={pending} onCheckedChange={onToggle} />
      </div>
    </li>
  )
}

const INITIAL_ROWS = 6

interface SharedItemsPanelProps {
  items: SharedItem[]
  pendingIds: Set<string>
  onChange: (ids: string[], shared: boolean) => void
}

export function SharedItemsPanel({ items, pendingIds, onChange }: SharedItemsPanelProps) {
  const [tab, setTab] = useState<ShareTab>("all")
  const [expanded, setExpanded] = useState(false)
  const count = (kind: ShareTab) => (kind === "all" ? items.length : items.filter((i) => i.kind === kind).length)
  const tabs: { value: ShareTab; label: string }[] = [
    { value: "all", label: `Tất cả (${count("all")})` },
    { value: "cv", label: `CV (${count("cv")})` },
    { value: "interview_report", label: `Báo cáo phỏng vấn (${count("interview_report")})` },
  ]
  const visible = tab === "all" ? items : items.filter((i) => i.kind === tab)
  const rows = expanded ? visible : visible.slice(0, INITIAL_ROWS)
  const sharedCount = items.filter((i) => i.shared).length
  const busy = pendingIds.size > 0

  return (
    <Panel className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 font-heading text-lg font-bold">
          Nội dung được chia sẻ
          <Badge variant="blue" className="h-auto px-2.5 py-0.5">
            Đang chia sẻ {sharedCount} / {items.length} tài liệu
          </Badge>
        </h2>
        <div className="flex gap-2">
          <Button
            variant="soft"
            className="h-9"
            disabled={busy || visible.every((i) => i.shared)}
            onClick={() => onChange(visible.filter((i) => !i.shared).map((i) => i.id), true)}
          >
            Chia sẻ tất cả
          </Button>
          <Button
            variant="outline"
            className="h-9"
            disabled={busy || visible.every((i) => !i.shared)}
            onClick={() => onChange(visible.filter((i) => i.shared).map((i) => i.id), false)}
          >
            Tắt tất cả
          </Button>
        </div>
      </div>

      <div role="group" aria-label="Loại tài liệu" className="flex w-fit flex-wrap rounded-xl bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card text-blue shadow-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-ink-2">
          {tab === "cv" ? "Bạn chưa tải lên CV nào." : "Chưa có tài liệu nào để chia sẻ."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((item) => (
            <SharedItemRow
              key={item.id}
              item={item}
              pending={pendingIds.has(item.id)}
              onToggle={(value) => onChange([item.id], value)}
            />
          ))}
        </ul>
      )}
      {visible.length > INITIAL_ROWS && (
        <Button variant="ghost" className="h-9 justify-self-center text-blue hover:bg-blue-soft hover:text-blue" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Thu gọn" : `Xem thêm ${visible.length - INITIAL_ROWS} tài liệu`}
        </Button>
      )}
    </Panel>
  )
}

// ---------- Phản hồi từ cố vấn ----------

export function AdvisorFeedbackPanel({ feedback, onOpen }: { feedback: AdvisorFeedback[]; onOpen: (id: string) => void }) {
  const unread = feedback.filter((f) => !f.read).length
  return (
    <Panel className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          Phản hồi từ cố vấn
          {unread > 0 && (
            <span className="rounded-full bg-bad px-1.5 text-xs font-semibold text-white" aria-label={`${unread} chưa đọc`}>
              {unread}
            </span>
          )}
        </h2>
        <span className="text-xs text-ink-2">Gần đây</span>
      </div>
      {feedback.length === 0 ? (
        <p className="rounded-xl bg-surface p-4 text-center text-sm text-ink-2">
          Chưa có nhận xét nào. Bật chia sẻ một báo cáo phỏng vấn để cố vấn góp ý.
        </p>
      ) : (
        <ul className="grid gap-3">
          {feedback.map((f) => (
            <li key={f.id} className={cn("grid gap-2 rounded-2xl p-4", f.read ? "bg-surface" : "bg-blue-soft/50 ring-1 ring-blue/15")}>
              <p className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-heading font-bold text-ink">
                  {!f.read && <span className="size-2 rounded-full bg-blue" aria-label="Chưa đọc" />}
                  {f.advisor_name}
                </span>
                <time dateTime={f.created_at} className="text-ink-2">
                  {formatWhen(f.created_at)}
                </time>
              </p>
              <blockquote className="text-sm leading-6 text-ink">“{f.comment}”</blockquote>
              <Link
                href={`/student/interview/${encodeURIComponent(f.target.id)}/report`}
                onClick={() => onOpen(f.id)}
                className="flex w-fit items-center gap-1 text-sm font-medium text-blue hover:underline"
              >
                {f.target.label}
                <SquareArrowOutUpRight className="size-3.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------- Dải nguyên tắc riêng tư ----------

/** Theo lựa chọn (a): cố vấn luôn thấy số liệu tổng hợp; nội dung chỉ thấy khi SV bật chia sẻ. */
export function PrivacyStrip() {
  return (
    <div className="grid gap-3 rounded-[20px] bg-blue-soft/50 px-5 py-4 text-sm leading-6 text-ink sm:grid-cols-2">
      <p className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-blue">
          <Lock className="size-4" aria-hidden />
        </span>
        <span>
          <strong className="text-blue">Nội dung chỉ thấy khi bạn bật chia sẻ:</strong> file CV, câu trả lời và nhận xét
          AI trong báo cáo phỏng vấn, chi tiết kỹ năng trong phân tích. Tắt lúc nào cũng được.
        </span>
      </p>
      <p className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-blue">
          <BarChart3 className="size-4" aria-hidden />
        </span>
        <span>
          <strong className="text-blue">Cố vấn phụ trách luôn thấy số liệu tổng hợp:</strong> điểm STAR từng buổi, mức
          tiến bộ, độ khớp CV và ngày hoạt động, để kịp thời hỗ trợ khi bạn gặp khó khăn.
        </span>
      </p>
    </div>
  )
}
