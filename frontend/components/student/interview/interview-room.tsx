"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { AlertCircle, Circle, CircleCheck, ListChecks, LogOut, Pause, Play, ShieldCheck, Timer, TimerOff, UserRound } from "lucide-react"
import { toast } from "sonner"

import { InterviewChat, type Rejection } from "@/components/InterviewChat"
import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { PAUSE_MAX_SECONDS, QUESTION_THEMES, SECONDS_PER_QUESTION, formatScore, mmss } from "@/lib/interview"
import { setLeaveGuard } from "@/lib/leave-guard"
import type { InterviewSession } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** Hết giờ mà gửi thất bại (mất mạng...) thì thử lại sau ngần này. */
const RETRY_MS = 5000

// Figma: frame "Phòng phỏng vấn (Distraction-free)" (18:3478). PRD US-SV-04, S6.
export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const fetchSession = useCallback(() => api.getInterview(sessionId), [sessionId])
  const { data: session, error, reload } = useApi(fetchSession)

  if (error) {
    // 404: buổi đã bị huỷ/không tồn tại; 410: SV rời phòng quá lâu nên buổi đã bị huỷ.
    const gone = error instanceof ApiError && (error.status === 404 || error.status === 410)
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">{gone ? "Buổi phỏng vấn không còn" : "Không mở được phòng phỏng vấn"}</p>
        <p className="max-w-md text-sm text-ink-2">{error.message}</p>
        {gone ? (
          <Button nativeButton={false} render={<Link href="/student/interview/new" />}>
            Thiết lập buổi mới
          </Button>
        ) : (
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
        )}
      </Panel>
    )
  }

  if (!session) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang chuẩn bị phòng phỏng vấn">
        <Skeleton className="h-20 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[520px] rounded-[20px]" />
          <Skeleton className="h-[420px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  return <Room key={session.id} initial={session} />
}

function Room({ initial }: { initial: InterviewSession }) {
  const router = useRouter()
  const profile = useProfile()
  const total = initial.question_count

  const [turns, setTurns] = useState(initial.turns)
  const [current, setCurrent] = useState(initial.current_question)
  const [finished, setFinished] = useState(initial.status === "completed")
  const [rejections, setRejections] = useState<Rejection[]>([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  // Đồng hồ: hạn chót tính theo giờ máy từ số giây còn lại backend trả về.
  const [now, setNow] = useState(() => Date.now())
  const [deadlineAt, setDeadlineAt] = useState<number | null>(() =>
    initial.seconds_left !== null ? Date.now() + initial.seconds_left * 1000 : null,
  )
  const [pausedUntil, setPausedUntil] = useState<number | null>(() =>
    initial.paused ? Date.now() + (initial.pause_seconds_left ?? PAUSE_MAX_SECONDS) * 1000 : null,
  )
  const [frozenLeft, setFrozenLeft] = useState(initial.seconds_left ?? 0)
  const [pauseUsed, setPauseUsed] = useState(initial.pause_used)
  const submittingRef = useRef(false)
  const resumingRef = useRef(false)

  const paused = pausedUntil !== null
  const secondsLeft = paused ? frozenLeft : deadlineAt === null ? 0 : Math.max(0, Math.ceil((deadlineAt - now) / 1000))
  const pauseLeft = paused ? Math.max(0, Math.ceil((pausedUntil - now) / 1000)) : 0
  const active = !finished && current !== null

  function applyTimer(session: InterviewSession) {
    const t = Date.now()
    setPauseUsed(session.pause_used)
    if (session.paused) {
      setPausedUntil(t + (session.pause_seconds_left ?? PAUSE_MAX_SECONDS) * 1000)
      setFrozenLeft(session.seconds_left ?? 0)
    } else {
      setPausedUntil(null)
      setDeadlineAt(session.seconds_left !== null ? t + session.seconds_left * 1000 : null)
    }
  }

  async function submit(timedOut: boolean) {
    if (!current || submittingRef.current) return
    submittingRef.current = true
    setSending(true)
    try {
      const res = await api.submitAnswer(initial.id, { question_index: current.index, text: draft, timed_out: timedOut })
      if (!res.allowed) {
        // Guardrail: không tính câu, giữ nguyên nội dung để SV sửa; đồng hồ vẫn chạy.
        setRejections((r) => [
          ...r,
          { id: `${current.index}-${Date.now()}`, questionIndex: current.index, reason: res.reason ?? "Câu trả lời chưa hợp lệ." },
        ])
        if (res.seconds_left !== null) setDeadlineAt(Date.now() + res.seconds_left * 1000)
        return
      }
      setTurns((t) => [...t, res.turn!])
      setDraft("")
      if (res.finished) {
        setFinished(true)
        setCurrent(null)
        setDeadlineAt(null)
      } else {
        setCurrent(res.next_question)
        setDeadlineAt(Date.now() + (res.seconds_left ?? SECONDS_PER_QUESTION) * 1000)
      }
    } catch (err) {
      // Buổi đã đổi trạng thái ở backend (hết hạn, đã trả lời câu này...): tải lại để lấy trạng thái đúng.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409 || err.status === 410)) {
        toast.error(err.message)
        window.location.reload()
        return
      }
      if (timedOut) {
        toast.error("Không gửi được câu trả lời do lỗi kết nối. Hệ thống sẽ thử lại sau vài giây.")
        setDeadlineAt(Date.now() + RETRY_MS)
      } else {
        toast.error(err instanceof Error ? err.message : "Không gửi được câu trả lời.")
      }
    } finally {
      submittingRef.current = false
      setSending(false)
    }
  }

  async function pause() {
    try {
      applyTimer(await api.pauseInterview(initial.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tạm dừng được.")
    }
  }

  async function resume() {
    if (resumingRef.current) return
    resumingRef.current = true
    try {
      applyTimer(await api.resumeInterview(initial.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tiếp tục được.")
    } finally {
      resumingRef.current = false
    }
  }

  // Mỗi nhịp đồng hồ: hết giờ thì tự nộp phần đang gõ; hết 1 phút tạm dừng thì tự chạy lại.
  const onTick = useEffectEvent((t: number) => {
    setNow(t)
    if (!active || sending) return
    if (pausedUntil !== null) {
      if (t >= pausedUntil) void resume()
      return
    }
    if (deadlineAt !== null && t >= deadlineAt) void submit(true)
  })
  useEffect(() => {
    const timer = setInterval(() => onTick(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  // Đang làm dở: rời phòng = bỏ dở buổi (bị xoá, không tính lượt), nên hỏi xác nhận trước.
  useEffect(() => {
    if (!active) {
      setLeaveGuard(null)
      return
    }
    setLeaveGuard(
      `Bạn đã trả lời ${turns.length}/${total} câu. Nếu rời phòng bây giờ, buổi phỏng vấn sẽ không được lưu và không tính lượt.`,
      () => api.abandonInterview(initial.id),
    )
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => {
      setLeaveGuard(null)
      window.removeEventListener("beforeunload", warn)
    }
  }, [active, turns.length, total, initial.id])

  async function endEarly() {
    setConfirmEnd(false)
    setLeaveGuard(null)
    try {
      await api.abandonInterview(initial.id)
    } catch {
      // Backend vẫn tự huỷ buổi bỏ dở khi quá hạn.
    }
    toast.info("Đã kết thúc buổi phỏng vấn. Buổi này không được lưu và không tính lượt.")
    // Quay lại thiết lập với đúng vị trí đang luyện
    router.push(`/student/interview/new?jd=${encodeURIComponent(initial.jd.id)}`)
  }

  const answeredIndexes = new Set(turns.map((t) => t.index))
  const urgent = active && !paused && secondsLeft <= 60

  return (
    <div className="grid gap-6">
      {/* Thanh tiến độ dính dưới header: câu hiện tại, đồng hồ, tạm dừng, kết thúc sớm. */}
      <div className="sticky top-16 z-20 -mt-2 bg-surface pt-2 pb-2">
        <Panel className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-soft text-violet">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div className="grid min-w-0">
              <p className="truncate font-heading text-lg font-bold">{initial.jd.title}</p>
              <p className={cn("flex items-center gap-1.5 text-xs font-medium", paused ? "text-warn" : finished ? "text-good" : "text-bad")}>
                <span
                  className={cn("size-2 rounded-full", paused ? "bg-warn" : finished ? "bg-good" : "animate-pulse bg-bad")}
                  aria-hidden
                />
                {finished ? "Đã hoàn thành" : paused ? `Đang tạm dừng · tự chạy lại sau ${pauseLeft} giây` : "Đang phỏng vấn"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-blue-soft/60 px-4 py-2.5">
            <span className="font-heading text-sm font-bold text-blue">
              Câu {Math.min(turns.length + (finished ? 0 : 1), total)}/{total}
            </span>
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: total }, (_, i) => i + 1).map((index) => (
                <span
                  key={index}
                  className={cn(
                    "size-2.5 rounded-full",
                    answeredIndexes.has(index)
                      ? "bg-good"
                      : index === current?.index
                        ? "bg-violet ring-4 ring-violet/20"
                        : "bg-line",
                  )}
                />
              ))}
            </span>
            {active && (
              <span
                role="timer"
                aria-label={`Còn ${secondsLeft} giây cho câu này`}
                className={cn(
                  "flex items-center gap-1 border-l border-line pl-4 font-heading text-base font-bold tabular-nums",
                  secondsLeft <= 10 && !paused ? "animate-pulse text-bad" : urgent ? "text-warn" : "text-ink",
                )}
              >
                <Timer className="size-4" aria-hidden />
                {mmss(secondsLeft)}
              </span>
            )}
          </div>

          {active && (
            <div className="flex items-center gap-2">
              {paused ? (
                <Button variant="soft" className="h-9" onClick={() => void resume()}>
                  <Play aria-hidden />
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  variant="soft"
                  className="h-9"
                  onClick={() => void pause()}
                  disabled={pauseUsed || sending}
                  title={pauseUsed ? "Mỗi buổi chỉ được tạm dừng 1 lần" : `Tạm dừng tối đa ${PAUSE_MAX_SECONDS} giây`}
                >
                  <Pause aria-hidden />
                  {pauseUsed ? "Đã dùng tạm dừng" : "Tạm dừng"}
                </Button>
              )}
              <Button variant="ghost" className="h-9 text-bad hover:bg-bad-soft hover:text-bad" onClick={() => setConfirmEnd(true)}>
                <LogOut aria-hidden />
                Kết thúc sớm
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <InterviewChat
            total={total}
            turns={turns}
            current={finished ? null : current}
            rejections={rejections}
            candidateName={profile?.full_name}
            candidateAvatar={profile?.avatar_url}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => void submit(false)}
            sending={sending}
            paused={paused}
            finished={finished}
            onViewReport={() => router.push(`/student/interview/${encodeURIComponent(initial.id)}/report`)}
          />
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-52">
          <Panel className="grid gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-heading text-base font-bold">
                <ListChecks className="size-4 text-violet" aria-hidden />
                Lộ trình câu hỏi
              </h2>
              <span className="rounded-full bg-violet-soft px-2.5 py-0.5 text-xs font-semibold text-violet">
                {turns.length}/{total}
              </span>
            </div>
            <ol className="grid gap-2">
              {QUESTION_THEMES.slice(0, total).map((theme, i) => {
                const index = i + 1
                const turn = turns.find((t) => t.index === index)
                const isCurrent = !turn && index === current?.index
                return (
                  <li
                    key={theme}
                    className={cn(
                      "flex gap-2.5 rounded-xl p-3 text-sm",
                      isCurrent ? "bg-violet-soft/60 ring-1 ring-violet/20" : turn ? "bg-surface" : "",
                    )}
                  >
                    {turn ? (
                      turn.timed_out && !turn.answer ? (
                        <TimerOff className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                      ) : (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                      )
                    ) : isCurrent ? (
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 border-violet" aria-hidden>
                        <span className="size-1.5 rounded-full bg-violet" />
                      </span>
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    )}
                    <span className="grid min-w-0 flex-1">
                      <span className={cn("truncate", isCurrent ? "font-semibold text-violet" : "text-ink")}>
                        Câu {index}: {theme}
                      </span>
                      <span className={cn("text-xs", turn ? "text-good" : isCurrent ? "text-violet" : "text-ink-3")}>
                        {turn ? `Đã chấm · ${formatScore(turn.score ?? 0)}/5` : isCurrent ? "Đang trả lời" : "Sắp tới"}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </Panel>
          <Panel className="grid gap-2 p-5">
            <h2 className="flex items-center gap-2 font-heading text-base font-bold">
              <ShieldCheck className="size-4 text-blue" aria-hidden />
              Luật buổi phỏng vấn
            </h2>
            <ul className="grid gap-1.5 text-xs leading-5 text-ink-2">
              <li>Mỗi câu {SECONDS_PER_QUESTION / 60} phút. Hết giờ, phần đang gõ được tự nộp.</li>
              <li>Được tạm dừng 1 lần, tối đa {PAUSE_MAX_SECONDS} giây.</li>
              <li>Mỗi câu được chấm 4 tiêu chí S/T/A/R, thang 0–5.</li>
              <li>Kết thúc sớm hoặc rời phòng thì buổi không được lưu, không tính lượt.</li>
            </ul>
          </Panel>
        </aside>
      </div>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết thúc buổi phỏng vấn sớm?</DialogTitle>
            <DialogDescription>
              Bạn đã trả lời {turns.length}/{total} câu. Nếu kết thúc bây giờ, buổi này sẽ không được lưu, không có báo cáo và
              không tính lượt. Lần sau bạn sẽ bắt đầu lại từ đầu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="soft" onClick={() => setConfirmEnd(false)}>
              Tiếp tục trả lời
            </Button>
            <Button variant="destructive" onClick={() => void endEarly()}>
              Kết thúc, không lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
