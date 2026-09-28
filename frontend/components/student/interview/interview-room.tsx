"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CircleCheck, Circle, ListChecks, LogOut, Pause, Play, ShieldCheck, Timer, UserRound } from "lucide-react"
import { toast } from "sonner"

import { InterviewChat } from "@/components/InterviewChat"
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
import { api } from "@/lib/api"
import { setLeaveGuard } from "@/lib/leave-guard"
import type { InterviewQuestion } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

// Figma: frame "Phòng phỏng vấn (Distraction-free)" (18:3478). Task B2, PRD US-SV-04.
export function InterviewRoom({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const profile = useProfile()
  const fetchSession = useCallback(() => api.getInterview(sessionId), [sessionId])
  const { data: session, error, reload } = useApi(fetchSession)

  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const total = session?.questions.length ?? 0
  const allAnswered = total > 0 && answered.size === total
  const activeId = currentId ?? session?.questions[session.current_index]?.id ?? null

  // AC2: đang làm dở thì hỏi xác nhận trước khi rời phòng.
  useEffect(() => {
    if (!session || allAnswered) {
      setLeaveGuard(null)
      return
    }
    setLeaveGuard(
      `Bạn đã trả lời ${answered.size}/${total} câu. Buổi phỏng vấn chỉ được chấm điểm khi trả lời đủ tất cả câu hỏi, nên nếu rời đi bây giờ bạn sẽ không nhận được báo cáo.`,
    )
    return () => setLeaveGuard(null)
  }, [session, answered, total, allAnswered])

  // Đồng hồ cho câu hiện tại (chỉ để tham khảo, không tự khoá câu trả lời).
  useEffect(() => {
    if (!session || paused || allAnswered) return
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [session, paused, allAnswered])

  function handleAnswered(questionId: string, next: InterviewQuestion | null) {
    setAnswered((prev) => new Set(prev).add(questionId))
    setCurrentId(next?.id ?? null)
    setElapsed(0)
  }

  async function finish() {
    setFinishing(true)
    try {
      await api.finishInterview(sessionId)
      setLeaveGuard(null)
      router.push(`/student/interview/${encodeURIComponent(sessionId)}/report`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không nộp được bài phỏng vấn.")
      setFinishing(false)
    }
  }

  if (error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không mở được phòng phỏng vấn</p>
        <p className="text-sm text-ink-2">{error.message}</p>
        <Button variant="soft" onClick={reload}>
          Thử lại
        </Button>
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

  const limit = session.time_limit_seconds_per_question
  const overTime = limit !== null && elapsed > limit
  const currentIndex = session.questions.findIndex((q) => q.id === activeId)

  return (
    <div className="grid gap-6">
      {/* Thanh tiến độ dính dưới header để luôn thấy câu hiện tại, đồng hồ và nút kết thúc.
          Lớp bọc nền surface che phần chat cuộn qua khe giữa header và thanh. */}
      <div className="sticky top-16 z-20 -mt-2 bg-surface pt-2 pb-2">
        <Panel className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-soft text-violet">
              <UserRound className="size-5" aria-hidden />
            </span>
            <div className="grid min-w-0">
              <p className="truncate font-heading text-lg font-bold">{session.jd.title}</p>
              <p className="truncate text-sm text-ink-2">{session.round_title}</p>
              <p className={cn("flex items-center gap-1.5 text-xs font-medium", paused ? "text-warn" : "text-bad")}>
                <span className={cn("size-2 rounded-full", paused ? "bg-warn" : "animate-pulse bg-bad")} aria-hidden />
                {paused ? "Đang tạm dừng" : allAnswered ? "Đã hoàn thành câu hỏi" : "Đang phỏng vấn"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-blue-soft/60 px-4 py-2.5">
            <span className="font-heading text-sm font-bold text-blue">
              Câu {Math.min(answered.size + 1, total)}/{total}
            </span>
            <span className="flex gap-1.5" aria-hidden>
              {session.questions.map((q) => (
                <span
                  key={q.id}
                  className={cn(
                    "size-2.5 rounded-full",
                    answered.has(q.id) ? "bg-good" : q.id === activeId ? "bg-violet ring-4 ring-violet/20" : "bg-line",
                  )}
                />
              ))}
            </span>
            {limit !== null && !allAnswered && (
              <span className={cn("flex items-center gap-1 border-l border-line pl-4 text-sm", overTime ? "text-warn" : "text-ink")}>
                <Timer className="size-4" aria-hidden />
                {mmss(elapsed)} / {mmss(limit)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="soft" className="h-9" onClick={() => setPaused((p) => !p)} disabled={allAnswered}>
              {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
              {paused ? "Tiếp tục" : "Tạm dừng"}
            </Button>
            <Button
              variant="ghost"
              className="h-9 text-bad hover:bg-bad-soft hover:text-bad"
              onClick={() => (allAnswered ? finish() : setConfirmEnd(true))}
            >
              <LogOut aria-hidden />
              Kết thúc phỏng vấn
            </Button>
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <InterviewChat
            session={session}
            candidateName={profile?.full_name}
            candidateAvatar={profile?.avatar_url}
            onAnswered={handleAnswered}
            onFinish={finish}
            finishing={finishing}
            paused={paused}
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
                {answered.size}/{total}
              </span>
            </div>
            <ol className="grid gap-2">
              {session.questions.map((q, i) => {
                const isDone = answered.has(q.id)
                const isCurrent = q.id === activeId && !isDone
                return (
                  <li
                    key={q.id}
                    className={cn(
                      "flex gap-2.5 rounded-xl p-3 text-sm",
                      isCurrent ? "bg-violet-soft/60 ring-1 ring-violet/20" : isDone ? "bg-surface" : "",
                    )}
                  >
                    {isDone ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
                    ) : isCurrent ? (
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 border-violet" aria-hidden>
                        <span className="size-1.5 rounded-full bg-violet" />
                      </span>
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    )}
                    <span className="grid min-w-0">
                      <span className={cn("line-clamp-2", isCurrent ? "font-semibold text-violet" : "text-ink")}>
                        Câu {i + 1}: {q.based_on ?? q.text}
                      </span>
                      <span className={cn("text-xs", isDone ? "text-good" : isCurrent ? "text-violet" : "text-ink-3")}>
                        {isDone ? "Đã trả lời" : isCurrent ? "Đang trả lời" : i === currentIndex + 1 ? "Tiếp theo" : "Sắp tới"}
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
              Chuẩn đánh giá
            </h2>
            <p className="text-xs leading-5 text-ink-2">
              Mỗi câu trả lời được chấm theo rubric STAR (Tình huống, Nhiệm vụ, Hành động, Kết quả) sau khi bạn nộp đủ các
              câu hỏi. Điểm và nhận xét chi tiết có trong báo cáo.
            </p>
          </Panel>
        </aside>
      </div>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kết thúc phỏng vấn sớm?</DialogTitle>
            <DialogDescription>
              Bạn mới trả lời {answered.size}/{total} câu. Buổi phỏng vấn chỉ được chấm điểm khi trả lời đủ tất cả câu hỏi.
              Nếu kết thúc bây giờ, bạn sẽ không nhận được báo cáo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="soft" onClick={() => setConfirmEnd(false)}>
              Tiếp tục trả lời
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeaveGuard(null)
                setConfirmEnd(false)
                router.push("/student")
              }}
            >
              Kết thúc, không chấm điểm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
