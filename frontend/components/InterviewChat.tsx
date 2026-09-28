"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Lightbulb,
  Loader2,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api, ApiError } from "@/lib/api"
import { countWords } from "@/lib/text"
import type { InterviewQuestion, InterviewSession } from "@/lib/types"

// B2: khung chat phỏng vấn + guardrail đầu vào.
// Khi backend trả { allowed: false, reason }, hiển thị thông báo từ chối rõ ràng, thân thiện,
// giữ nguyên nội dung SV đã gõ để sửa và KHÔNG tính là đã trả lời câu hỏi.

type Message =
  | { id: string; kind: "question"; question: InterviewQuestion; at: string }
  | { id: string; kind: "answer"; text: string; at: string }
  | { id: string; kind: "feedback"; text: string; responseId: string; at: string }
  | { id: string; kind: "rejected"; reason: string; at: string }

const time = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })

interface InterviewChatProps {
  session: InterviewSession
  candidateName: string | undefined
  candidateAvatar: string | null | undefined
  /** Gọi khi một câu trả lời được chấp nhận (để cập nhật lộ trình câu hỏi). */
  onAnswered: (questionId: string, nextQuestion: InterviewQuestion | null) => void
  /** Hiển thị khi đã trả lời đủ; bấm để nộp và chấm điểm. */
  onFinish: () => void
  finishing: boolean
  paused: boolean
}

export function InterviewChat({
  session,
  candidateName,
  candidateAvatar,
  onAnswered,
  onFinish,
  finishing,
  paused,
}: InterviewChatProps) {
  const first = session.questions[session.current_index] ?? session.questions[0]
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: `q-${first.id}`, kind: "question", question: first, at: time() },
  ])
  const [current, setCurrent] = useState<InterviewQuestion | null>(first)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [showStar, setShowStar] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const done = current === null

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

  async function send() {
    const text = draft.trim()
    if (!text || !current || sending || paused) return
    setSending(true)
    try {
      const res = await api.submitAnswer(session.id, { question_id: current.id, text })
      if (!res.allowed) {
        // Guardrail: không ghi nhận câu trả lời, giữ nguyên draft để SV sửa.
        setMessages((m) => [...m, { id: `r-${Date.now()}`, kind: "rejected", reason: res.reason, at: time() }])
        inputRef.current?.focus()
        return
      }
      const next = res.next_question
      setMessages((m) => [
        ...m,
        { id: `a-${current.id}`, kind: "answer", text, at: time() },
        ...(res.feedback
          ? [{ id: `f-${current.id}`, kind: "feedback" as const, text: res.feedback, responseId: res.response_id, at: time() }]
          : []),
        ...(next ? [{ id: `q-${next.id}`, kind: "question" as const, question: next, at: time() }] : []),
      ])
      setDraft("")
      setCurrent(next)
      onAnswered(current.id, next)
    } catch (err) {
      const reason = err instanceof ApiError || err instanceof Error ? err.message : "Không gửi được câu trả lời."
      setMessages((m) => [...m, { id: `r-${Date.now()}`, kind: "rejected", reason, at: time() }])
    } finally {
      setSending(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-5" aria-label="Hội thoại phỏng vấn" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id}>
            <ChatMessage message={m} total={session.questions.length} candidateName={candidateName} candidateAvatar={candidateAvatar} />
          </li>
        ))}
        {sending && (
          <li className="flex items-center gap-2 justify-self-start rounded-full bg-violet-soft/70 px-4 py-2 text-sm text-violet">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-bounce rounded-full bg-violet" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </span>
            AI Career Coach đang ghi nhận câu trả lời…
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {done ? (
        <div className="grid justify-items-center gap-3 rounded-[20px] border border-good/30 bg-good-soft/50 p-6 text-center">
          <CircleCheck className="size-8 text-good" aria-hidden />
          <p className="font-heading text-lg font-bold">Bạn đã trả lời đủ {session.questions.length} câu hỏi</p>
          <p className="max-w-md text-sm text-ink-2">Nộp bài để AI chấm điểm từng câu theo rubric STAR và tạo báo cáo chi tiết.</p>
          <Button variant="violet" size="brand" onClick={onFinish} disabled={finishing}>
            {finishing && <Loader2 className="animate-spin" aria-hidden />}
            {finishing ? "Đang chấm điểm…" : "Nộp & xem báo cáo"}
          </Button>
        </div>
      ) : (
        <div className="sticky bottom-4 grid gap-3 rounded-[20px] border border-line bg-card p-4 shadow-float">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowStar((v) => !v)}
              aria-expanded={showStar}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1 text-xs font-semibold text-violet"
            >
              <Lightbulb className="size-3.5" aria-hidden />
              Gợi ý khung STAR
              {showStar ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
            </button>
            <span className="flex items-center gap-1 text-xs text-ink-2">
              <ShieldCheck className="size-3.5 text-blue" aria-hidden />
              Hãy trả lời dựa trên trải nghiệm thật. Không bịa đặt số liệu để AI đánh giá chuẩn.
            </span>
          </div>
          {showStar && (
            <ul className="grid gap-1 rounded-xl bg-violet-soft/40 p-3 text-xs leading-5 text-ink sm:grid-cols-2">
              <li><strong className="text-blue">S – Tình huống:</strong> bối cảnh, thời gian, quy mô.</li>
              <li><strong className="text-blue">T – Nhiệm vụ:</strong> vai trò và trách nhiệm của bạn.</li>
              <li><strong className="text-violet">A – Hành động:</strong> bạn đã làm gì, dùng công cụ gì.</li>
              <li><strong className="text-violet">R – Kết quả:</strong> con số hoặc thay đổi đo được.</li>
            </ul>
          )}
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={paused}
            placeholder={paused ? "Phỏng vấn đang tạm dừng…" : "Nhập câu trả lời của bạn…"}
            aria-label={current ? `Câu trả lời cho câu ${current.index}` : "Câu trả lời"}
            className="min-h-24 resize-none border-0 bg-surface text-[15px] leading-6 focus-visible:ring-2"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-3">
              {countWords(draft)} từ · Ctrl + Enter để gửi
            </span>
            <Button variant="violet" className="h-10 px-5" onClick={send} disabled={!draft.trim() || sending || paused}>
              {sending ? <Loader2 className="animate-spin" aria-hidden /> : <SendHorizontal aria-hidden />}
              Gửi
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatMessage({
  message: m,
  total,
  candidateName,
  candidateAvatar,
}: {
  message: Message
  total: number
  candidateName: string | undefined
  candidateAvatar: string | null | undefined
}) {
  if (m.kind === "question") {
    return (
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="grid min-w-0 flex-1 gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-heading font-bold text-violet">AI Career Coach</span>
            <Badge variant="violet">Người phỏng vấn</Badge>
            <span className="ml-auto text-xs text-ink-3">{m.at}</span>
          </p>
          <div className="grid gap-3 rounded-2xl rounded-tl-sm border border-violet/15 bg-violet-soft/40 p-4">
            <p className="text-xs font-semibold text-violet">
              Câu {m.question.index}/{total}
            </p>
            <p className="text-[17px] leading-7 font-semibold text-ink">{m.question.text}</p>
            {m.question.based_on && (
              <p className="inline-flex items-center gap-1.5 justify-self-start rounded-lg bg-card px-2.5 py-1 text-xs text-violet ring-1 ring-violet/15">
                <Target className="size-3.5" aria-hidden />
                Dựa trên: {m.question.based_on}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }
  if (m.kind === "answer") {
    return (
      <div className="flex gap-3">
        <UserAvatar name={candidateName} src={candidateAvatar} className="size-10" />
        <div className="grid min-w-0 flex-1 gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-heading font-bold text-blue">{candidateName ?? "Bạn"}</span>
            <Badge variant="blue">Ứng viên</Badge>
            <span className="ml-auto text-xs text-ink-3">{m.at}</span>
          </p>
          <div className="grid gap-2 rounded-2xl rounded-tl-sm bg-blue-soft/50 p-4">
            <p className="text-[15px] leading-7 whitespace-pre-line text-ink">{m.text}</p>
            <p className="text-xs text-ink-2">Đã ghi nhận {countWords(m.text)} từ</p>
          </div>
        </div>
      </div>
    )
  }
  if (m.kind === "feedback") {
    return (
      <div className="ml-13 grid gap-1.5 rounded-xl bg-surface px-4 py-3">
        <p className="text-sm text-ink">{m.text}</p>
        <FeedbackWidget variant="thumbs" responseId={m.responseId} />
      </div>
    )
  }
  return (
    <div role="alert" className="ml-13 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft/60 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-ink">Câu trả lời chưa được ghi nhận</p>
        <p className="text-sm text-ink">{m.reason}</p>
        <p className="text-xs text-ink-2">Nội dung bạn đã gõ vẫn còn trong ô nhập, hãy chỉnh sửa rồi gửi lại. Lượt này không bị tính.</p>
      </div>
    </div>
  )
}
