"use client"

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react"
import { Bot, CircleCheck, Info, Lightbulb, Loader2, Mic, SendHorizontal, ShieldCheck, Square, TimerOff } from "lucide-react"

import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS } from "@/lib/interview"
import type { InterviewQuestion, InterviewTurn } from "@/lib/types"
import { useSonioxStt } from "@/lib/use-soniox-stt"
import { cn } from "@/lib/utils"

// S6: khung chat phỏng vấn. Logic đồng hồ / nộp bài nằm ở InterviewRoom; component này chỉ hiển thị.
// Như một buổi phỏng vấn thật: không hiện điểm hay nhận xét sau từng câu; điểm STAR và nhận xét có trong báo cáo.

/** Thông báo guardrail cho một câu: không tính câu, SV sửa rồi gửi lại. */
export interface Rejection {
  id: string
  questionIndex: number
  reason: string
}

interface InterviewChatProps {
  sessionId?: string
  total: number
  turns: InterviewTurn[]
  current: InterviewQuestion | null
  rejections: Rejection[]
  candidateName: string | undefined
  candidateAvatar: string | null | undefined
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
  sending: boolean
  /** Đang tạm dừng: khoá ô nhập. */
  paused: boolean
  finished: boolean
  onViewReport: () => void
}

export function InterviewChat(props: InterviewChatProps) {
  const { sessionId, total, turns, current, rejections, candidateName, candidateAvatar, draft, sending, paused, finished } = props
  const endRef = useRef<HTMLDivElement>(null)
  const length = draft.trim().length

  const baseDraftRef = useRef("")

  const onTranscriptUpdate = useCallback(
    (speechText: string) => {
      const base = baseDraftRef.current
      const updated = base ? (speechText ? `${base.trim()} ${speechText.trimStart()}` : base) : speechText
      props.onDraftChange(updated)
    },
    [props],
  )

  const stt = useSonioxStt({
    sessionId,
    onTranscriptUpdate,
  })

  const canSend = !sending && !paused && !stt.isRecording && length >= MIN_ANSWER_CHARS && length <= MAX_ANSWER_CHARS

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns.length, current?.index, rejections.length, sending])

  useEffect(() => {
    if (paused || finished) {
      stt.stop()
    }
  }, [paused, finished, stt])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (canSend) props.onSend()
    }
  }

  function handleToggleRecord() {
    if (!stt.isRecording && !stt.isConnecting) {
      baseDraftRef.current = draft
    }
    stt.toggle()
  }

  function handleSend() {
    if (stt.isRecording) {
      stt.stop()
    }
    props.onSend()
  }

  const rejectionsOf = (index: number) => rejections.filter((r) => r.questionIndex === index)

  return (
    <div className="grid gap-4">
      <ol className="grid gap-5" aria-label="Hội thoại phỏng vấn" aria-live="polite">
        {turns.map((turn) => (
          <li key={turn.id} className="grid gap-5">
            <QuestionBubble index={turn.index} total={total} theme={turn.theme} text={turn.question} />
            {rejectionsOf(turn.index).map((r) => (
              <SystemBubble key={r.id} reason={r.reason} />
            ))}
            <AnswerBubble turn={turn} name={candidateName} avatar={candidateAvatar} />
          </li>
        ))}
        {current && (
          <li className="grid gap-5">
            <QuestionBubble index={current.index} total={total} theme={current.theme} text={current.text} />
            {rejectionsOf(current.index).map((r) => (
              <SystemBubble key={r.id} reason={r.reason} />
            ))}
          </li>
        )}
        {sending && (
          <li className="flex items-center gap-2 justify-self-start rounded-full bg-violet-soft/70 px-4 py-2 text-sm text-violet">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            AI Career Coach đang ghi nhận câu trả lời…
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {finished ? (
        <div className="grid justify-items-center gap-3 rounded-[20px] border border-good/30 bg-good-soft/50 p-6 text-center">
          <CircleCheck className="size-8 text-good" aria-hidden />
          <p className="font-heading text-lg font-bold">Bạn đã hoàn thành {total} câu hỏi</p>
          <p className="max-w-md text-sm text-ink-2">Báo cáo gồm điểm STAR từng câu và hướng dẫn cải thiện đã sẵn sàng.</p>
          <Button variant="violet" size="brand" onClick={props.onViewReport}>
            Xem kết quả
          </Button>
        </div>
      ) : (
        current && (
          <div className="sticky bottom-4 grid gap-3 rounded-[20px] border border-line bg-card p-4 shadow-float">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1 font-semibold text-violet">
                <Lightbulb className="size-3.5" aria-hidden />
                Trả lời theo STAR: bối cảnh → nhiệm vụ → hành động → kết quả
              </span>
              <span className="flex items-center gap-1 text-ink-2">
                <ShieldCheck className="size-3.5 text-blue" aria-hidden />
                Dựa trên trải nghiệm thật, không bịa số liệu.
              </span>
            </div>

            {stt.isRecording && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-bad-soft/80 px-3.5 py-2 text-xs font-medium text-bad ring-1 ring-bad/20">
                <span className="flex items-center gap-2">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bad opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-bad" />
                  </span>
                  <span>Đang thu âm qua Soniox STT: Hãy nói tự nhiên bằng tiếng Việt hoặc thuật ngữ chuyên môn…</span>
                </span>
                <span className="text-[11px] opacity-80">Bấm &quot;Dừng nói&quot; khi hoàn tất</span>
              </div>
            )}

            <Textarea
              value={draft}
              onChange={(e) => props.onDraftChange(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={MAX_ANSWER_CHARS}
              disabled={paused || sending}
              placeholder={
                paused
                  ? "Đang tạm dừng…"
                  : stt.isRecording
                  ? "Đang lắng nghe và nhận diện giọng nói qua Soniox STT..."
                  : "Nhập câu trả lời của bạn hoặc bấm 'Nói câu trả lời' để ghi âm trực tiếp…"
              }
              aria-label={`Câu trả lời cho câu ${current.index}`}
              className={cn(
                "min-h-28 resize-none border-0 bg-surface text-[15px] leading-6 focus-visible:ring-2",
                stt.isRecording && "ring-2 ring-bad/30 bg-bad-soft/10",
              )}
            />
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs", length > 0 && length < MIN_ANSWER_CHARS ? "text-warn" : "text-ink-3")}>
                {draft.length}/{MAX_ANSWER_CHARS} ký tự
                {length < MIN_ANSWER_CHARS ? ` · tối thiểu ${MIN_ANSWER_CHARS}` : " · Ctrl + Enter để gửi"}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={stt.isRecording ? "destructive" : "soft"}
                  className={cn(
                    "h-10 gap-2 px-3.5 transition-all",
                    stt.isRecording && "animate-pulse ring-2 ring-bad/40",
                  )}
                  onClick={handleToggleRecord}
                  disabled={paused || sending}
                  title={stt.isRecording ? "Bấm để dừng nói" : "Bấm để nói câu trả lời qua Soniox STT"}
                >
                  {stt.isConnecting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : stt.isRecording ? (
                    <Square className="size-4 fill-current" aria-hidden />
                  ) : (
                    <Mic className="size-4 text-violet" aria-hidden />
                  )}
                  <span className="text-xs font-semibold">
                    {stt.isConnecting
                      ? "Đang nối STT…"
                      : stt.isRecording
                      ? "Dừng nói"
                      : "Nói câu trả lời"}
                  </span>
                </Button>

                <Button variant="violet" className="h-10 px-5" onClick={handleSend} disabled={!canSend}>
                  {sending ? <Loader2 className="animate-spin" aria-hidden /> : <SendHorizontal aria-hidden />}
                  Gửi
                </Button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function QuestionBubble({ index, total, theme, text }: { index: number; total: number; theme: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white">
        <Bot className="size-5" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-heading font-bold text-violet">AI Career Coach</span>
          <Badge variant="violet">Người phỏng vấn</Badge>
        </p>
        <div className="grid gap-2 rounded-2xl rounded-tl-sm border border-violet/15 bg-violet-soft/40 p-4">
          <p className="text-xs font-semibold text-violet">
            Câu {index}/{total} · {theme}
          </p>
          <p className="text-[17px] leading-7 font-semibold text-ink">{text}</p>
        </div>
      </div>
    </div>
  )
}

function AnswerBubble({ turn, name, avatar }: { turn: InterviewTurn; name: string | undefined; avatar: string | null | undefined }) {
  return (
    <div className="flex gap-3">
      <UserAvatar name={name} src={avatar} className="size-10" />
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-heading font-bold text-blue">{name ?? "Bạn"}</span>
          <Badge variant="blue">Ứng viên</Badge>
          {turn.timed_out && (
            <Badge variant="warn">
              <TimerOff aria-hidden />
              Hết giờ
            </Badge>
          )}
        </p>
        <div className="rounded-2xl rounded-tl-sm bg-blue-soft/50 p-4">
          {turn.answer ? (
            <p className="text-[15px] leading-7 whitespace-pre-line text-ink">{turn.answer}</p>
          ) : (
            <p className="text-sm text-ink-2 italic">Hết giờ khi chưa có câu trả lời.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Bong bóng hệ thống màu trung tính khi câu trả lời bị guardrail chặn (không tính câu). */
function SystemBubble({ reason }: { reason: string }) {
  return (
    <div role="status" className="ml-13 flex gap-2.5 rounded-xl border border-line bg-card px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
      <div className="grid gap-0.5">
        <p className="text-sm text-ink">{reason}</p>
        <p className="text-xs text-ink-2">Nội dung bạn đã gõ vẫn còn trong ô nhập. Câu này chưa bị tính.</p>
      </div>
    </div>
  )
}
