"use client"

import Link from "next/link"
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  MessageCircle,
  Search,
  SendHorizontal,
  UserRound,
  UserRoundX,
  X,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useChat } from "@/components/chat/chat-context"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, formatRelativeTime, formatTime } from "@/lib/format"
import type { ChatParticipant, Conversation, ConversationSummary } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** Khi khung chat đang mở: hỏi tin mới của hội thoại mỗi 4 giây, danh sách hội thoại mỗi 10 giây. */
const THREAD_POLL_MS = 4_000
const LIST_POLL_MS = 10_000
const MAX_MESSAGE_CHARS = 2000
const COUNTER_FROM = 1800

/**
 * Khung chat góc dưới bên phải (toàn màn hình trên điện thoại). SV nhắn với cố vấn phụ trách;
 * cố vấn chọn SV trong danh sách hội thoại. Chỉ văn bản, tin mới được hỏi định kỳ (polling).
 */
export function ChatPanel() {
  const { open, role, closeChat } = useChat()
  if (!open) return null
  return (
    <section
      aria-label={role === "advisor" ? "Tin nhắn với sinh viên" : "Trò chuyện với cố vấn"}
      onKeyDown={(e) => e.key === "Escape" && closeChat()}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-card sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(620px,calc(100dvh-6rem))] sm:w-[400px] sm:rounded-[18px] sm:shadow-dialog sm:ring-1 sm:ring-line"
    >
      {role === "advisor" ? <AdvisorChat /> : <StudentChat />}
    </section>
  )
}

// ---------- Khung theo vai trò ----------

function StudentChat() {
  const { role } = useChat()
  const fetchList = useCallback(() => api.listConversations(role), [role])
  const { data, error, reload } = useApi(fetchList)

  if (error) {
    return (
      <>
        <PanelTop title="Trò chuyện với cố vấn" />
        <ErrorState message={error.message} onRetry={reload} />
      </>
    )
  }
  if (!data) {
    return (
      <>
        <PanelTop title="Trò chuyện với cố vấn" />
        <ThreadSkeleton />
      </>
    )
  }
  if (data.length === 0) {
    return (
      <>
        <PanelTop title="Trò chuyện với cố vấn" />
        <CenteredNote icon={UserRoundX} title="Bạn chưa được phân công cố vấn">
          Khi nhà trường phân công, bạn có thể nhắn tin với cố vấn ở đây.
        </CenteredNote>
      </>
    )
  }
  return <ChatThread key={data[0].student_id} studentId={data[0].student_id} />
}

function AdvisorChat() {
  const { studentId, openChat } = useChat()
  if (studentId) return <ChatThread key={studentId} studentId={studentId} onBack={() => openChat()} />
  return <ConversationList />
}

// ---------- Danh sách hội thoại (cố vấn) ----------

function ConversationList() {
  const { role, openChat, unread } = useChat()
  const [rows, setRows] = useState<ConversationSummary[]>()
  const [error, setError] = useState<Error>()
  const [query, setQuery] = useState("")

  useEffect(() => {
    let active = true
    const load = () =>
      api.listConversations(role).then(
        (data) => {
          if (!active) return
          setRows(data)
          setError(undefined)
        },
        (err: unknown) => active && setError(err instanceof Error ? err : new Error(String(err))),
      )
    void load()
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), LIST_POLL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [role])

  // Chỉ hiện sinh viên đã có tin nhắn; muốn nhắn SV mới thì bấm "Nhắn tin" ở hồ sơ / danh sách sinh viên.
  const started = (rows ?? []).filter((r) => r.last_message)
  const q = query.trim().toLowerCase()
  const visible = started.filter((r) => !q || r.counterpart.full_name.toLowerCase().includes(q))

  return (
    <>
      <PanelTop title="Tin nhắn" aside={unread > 0 ? `${unread} chưa đọc` : undefined} />
      <div className="border-b border-line px-4 py-3">
        <label className="flex h-10 items-center gap-2 rounded-[10px] bg-card px-3 ring-1 ring-line-strong transition-shadow focus-within:ring-ink">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sinh viên…"
            aria-label="Tìm sinh viên"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {error && !rows ? (
          <ErrorState message={error.message} />
        ) : !rows ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-2">
            {rows.length === 0
              ? "Bạn chưa được phân công sinh viên nào."
              : started.length === 0
                ? "Chưa có cuộc trò chuyện nào. Bấm “Nhắn tin” ở hồ sơ sinh viên để bắt đầu."
                : "Không có cuộc trò chuyện nào khớp."}
          </p>
        ) : (
          <ul className="grid grid-cols-1 p-2">
            {visible.map((r) => (
              <li key={r.student_id}>
                <button
                  type="button"
                  onClick={() => openChat(r.student_id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel"
                >
                  <UserAvatar name={r.counterpart.full_name} src={r.counterpart.avatar_url} className="size-10" />
                  <span className="grid min-w-0 flex-1 grid-cols-1 gap-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm text-ink", r.unread_count > 0 ? "font-semibold" : "font-medium")}>
                        {r.counterpart.full_name}
                      </span>
                      {r.last_message && (
                        <span className="shrink-0 text-[11px] text-ink-3">{shortTime(r.last_message.created_at)}</span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", r.unread_count > 0 ? "font-semibold text-ink" : "text-ink-2")}>
                        {r.last_message && `${r.last_message.mine ? "Bạn: " : ""}${r.last_message.body}`}
                      </span>
                      {r.unread_count > 0 && (
                        <span
                          className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-blue px-1.5 text-[11px] font-bold text-on-blue"
                          aria-label={`${r.unread_count} tin chưa đọc`}
                        >
                          {r.unread_count}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ---------- Một hội thoại ----------

function ChatThread({ studentId, onBack }: { studentId: string; onBack?: () => void }) {
  const { role, refreshUnread } = useChat()
  const [conversation, setConversation] = useState<Conversation>()
  const [error, setError] = useState<Error>()
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  // Bỏ kết quả của lượt hỏi bắt đầu trước khi gửi tin (tránh ghi đè tin vừa gửi bằng dữ liệu cũ)
  const requestSeq = useRef(0)

  const load = useCallback(() => {
    const seq = ++requestSeq.current
    return api.getConversation(role, studentId).then(
      (data) => {
        if (seq !== requestSeq.current) return
        setConversation(data)
        setError(undefined)
        // Đang mở hội thoại thì tin mới coi như đã đọc
        if (data.messages.some((m) => !m.mine && !m.read_at)) {
          return api.markConversationRead(role, studentId).then(refreshUnread)
        }
      },
      (err: unknown) => {
        if (seq === requestSeq.current) setError(err instanceof Error ? err : new Error(String(err)))
      },
    )
  }, [role, studentId, refreshUnread])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), THREAD_POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const count = conversation?.messages.length ?? 0
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [count])

  async function send(body: string) {
    const message = await api.sendMessage(role, studentId, body)
    requestSeq.current++
    stickToBottom.current = true
    setConversation((c) => (c ? { ...c, messages: [...c.messages, message] } : c))
  }

  const counterpart = conversation?.counterpart
  const lastMine = conversation?.messages.findLast((m) => m.mine)

  return (
    <>
      <ThreadHeader counterpart={counterpart} studentId={studentId} onBack={onBack} />
      {counterpart?.office_hours && (
        <p className="flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5 text-[13px] text-ink-2">
          <Clock className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          Giờ tư vấn: {counterpart.office_hours}. Tin nhắn ngoài giờ sẽ được trả lời sau.
        </p>
      )}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4"
      >
        {error && !conversation ? (
          <ErrorState message={error.message} onRetry={() => void load()} />
        ) : !conversation ? (
          <ThreadSkeleton />
        ) : conversation.messages.length === 0 ? (
          <CenteredNote icon={MessageCircle} title="Chưa có tin nhắn nào">
            {role === "student"
              ? "Bạn có thể hỏi cố vấn về CV, kết quả phỏng vấn thử hoặc hẹn lịch tư vấn."
              : `Gửi tin nhắn đầu tiên cho ${conversation.counterpart.full_name}.`}
          </CenteredNote>
        ) : (
          <ol className="grid grid-cols-1 gap-1.5" role="log" aria-live="polite" aria-label="Tin nhắn">
            {conversation.messages.map((m, i) => {
              const previous = conversation.messages[i - 1]
              const newDay = !previous || dayKey(previous.created_at) !== dayKey(m.created_at)
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <li className="py-2 text-center text-xs font-medium text-ink-3" aria-hidden>
                      {dayLabel(m.created_at)}
                    </li>
                  )}
                  <li className={cn("grid max-w-[85%] gap-0.5", m.mine ? "justify-self-end justify-items-end" : "justify-self-start")}>
                    <p
                      className={cn(
                        "rounded-[18px] px-3.5 py-2 text-sm leading-6 wrap-anywhere whitespace-pre-wrap",
                        m.mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-surface text-ink",
                      )}
                    >
                      <span className="sr-only">{m.mine ? "Bạn: " : `${conversation.counterpart.full_name}: `}</span>
                      {m.body}
                    </p>
                    <span className="flex items-center gap-1 px-1 text-[11px] text-ink-3">
                      {formatTime(m.created_at)}
                      {m.id === lastMine?.id &&
                        (m.read_at ? (
                          <span className="flex items-center gap-0.5 text-ink-2">
                            <CheckCheck className="size-3.5" aria-hidden />
                            Đã xem
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <Check className="size-3.5" aria-hidden />
                            Đã gửi
                          </span>
                        ))}
                    </span>
                  </li>
                </Fragment>
              )
            })}
          </ol>
        )}
      </div>
      <Composer disabled={!conversation} onSend={send} />
    </>
  )
}

function ThreadHeader({
  counterpart,
  studentId,
  onBack,
}: {
  counterpart: ChatParticipant | undefined
  studentId: string
  onBack?: () => void
}) {
  const { role, closeChat } = useChat()
  return (
    <header className="flex items-center gap-3 border-b border-line py-3 pr-3 pl-4">
      {onBack && (
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-surface" aria-label="Quay lại danh sách tin nhắn" onClick={onBack}>
          <ArrowLeft aria-hidden />
        </Button>
      )}
      {counterpart ? (
        <>
          <UserAvatar name={counterpart.full_name} src={counterpart.avatar_url} className="size-9" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate text-[15px] leading-5 font-semibold text-ink">{counterpart.full_name}</span>
            <span className="truncate text-[13px] text-ink-3">{counterpart.subtitle}</span>
          </span>
        </>
      ) : (
        <span className="flex flex-1 items-center gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </span>
      )}
      {role === "advisor" && (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-ink-2 hover:bg-surface"
          aria-label="Mở hồ sơ sinh viên"
          nativeButton={false}
          render={<Link href={`/advisor/students/${encodeURIComponent(studentId)}`} />}
        >
          <UserRound aria-hidden />
        </Button>
      )}
      <CloseButton onClick={closeChat} />
    </header>
  )
}

function Composer({ disabled, onSend }: { disabled: boolean; onSend: (body: string) => Promise<void> }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const trimmed = text.trim()
  const tooLong = trimmed.length > MAX_MESSAGE_CHARS

  async function submit() {
    if (!trimmed || tooLong || sending || disabled) return
    setSending(true)
    try {
      await onSend(trimmed)
      setText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được tin nhắn.")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="grid gap-1.5 border-t border-line px-4 pt-3 pb-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-end gap-2 rounded-[14px] bg-card py-1.5 pr-1.5 pl-3.5 ring-1 ring-line-strong transition-shadow focus-within:ring-ink">
        <textarea
          rows={1}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Không gửi khi đang gõ dấu tiếng Việt bằng bộ gõ (IME)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Nhập tin nhắn…"
          aria-label="Nội dung tin nhắn"
          className="field-sizing-content max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm leading-6 outline-none placeholder:text-ink-3"
        />
        <Button
          type="submit"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          disabled={!trimmed || tooLong || sending || disabled}
          aria-label="Gửi tin nhắn"
        >
          <SendHorizontal aria-hidden />
        </Button>
      </div>
      <p className="flex justify-between gap-2 px-1 text-xs text-ink-3">
        <span>Enter để gửi, Shift + Enter để xuống dòng</span>
        {trimmed.length >= COUNTER_FROM && (
          <span className={cn(tooLong && "font-semibold text-bad")}>
            {trimmed.length}/{MAX_MESSAGE_CHARS}
          </span>
        )}
      </p>
    </form>
  )
}

// ---------- Phần dùng chung ----------

function PanelTop({ title, aside }: { title: string; aside?: string }) {
  const { closeChat } = useChat()
  return (
    <header className="flex items-center gap-2 border-b border-line py-3.5 pr-3 pl-5">
      <span className="grid min-w-0 flex-1">
        <h2 className="truncate text-base leading-6 font-semibold text-ink">{title}</h2>
        {aside && <span className="text-[13px] text-ink-3">{aside}</span>}
      </span>
      <CloseButton onClick={closeChat} />
    </header>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="rounded-full text-ink-2 hover:bg-surface" aria-label="Đóng khung tin nhắn" onClick={onClick}>
      <X aria-hidden />
    </Button>
  )
}

function CenteredNote({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="grid h-full content-center justify-items-center gap-2 p-6 text-center">
      <span className="mb-1 grid size-11 place-items-center rounded-full bg-surface text-ink-2">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-[280px] text-[13px] leading-5 text-ink-3">{children}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="grid justify-items-center gap-2 p-6 text-center">
      <AlertCircle className="size-6 text-bad" aria-hidden />
      <p className="text-sm text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="soft" size="sm" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="grid gap-3 p-4" aria-label="Đang tải tin nhắn">
      <Skeleton className="h-10 w-3/5 rounded-2xl" />
      <Skeleton className="h-14 w-2/3 justify-self-end rounded-2xl" />
      <Skeleton className="h-10 w-1/2 rounded-2xl" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-label="Đang tải hội thoại">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

const dayKey = (iso: string) => new Date(iso).toDateString()

/** "Hôm nay", "Hôm qua" hoặc "07/09/2026". */
function dayLabel(iso: string, now = new Date()): string {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(iso) === now.toDateString()) return "Hôm nay"
  if (dayKey(iso) === yesterday.toDateString()) return "Hôm qua"
  return formatDate(iso)
}

/** Giờ gửi nếu trong ngày, ngược lại "3 ngày trước". */
function shortTime(iso: string): string {
  return dayKey(iso) === new Date().toDateString() ? formatTime(iso) : formatRelativeTime(iso)
}
