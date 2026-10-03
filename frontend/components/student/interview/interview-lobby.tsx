"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { AlertCircle, ArrowLeft, Bot, ClipboardCheck, Loader2, LogOut, Pause, Play, ShieldCheck, Timer } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import { QuestionRoadmap, RoomHeader, RoomProgress } from "@/components/student/interview/interview-room"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { MIN_ANSWER_CHARS, PAUSE_MAX_SECONDS, QUESTION_COUNT, SECONDS_PER_QUESTION, mmss } from "@/lib/interview"
import { useApi } from "@/lib/use-api"

/**
 * Phòng chờ trước khi bắt đầu: giao diện phòng phỏng vấn (chưa có câu hỏi) kèm popup luật buổi phỏng vấn.
 * Buổi phỏng vấn chỉ được tạo khi SV bấm "Sẵn sàng", vì đồng hồ câu 1 bắt đầu chạy ngay lúc tạo buổi
 * (create_session ở src/services/interview.py); "Quay lại" về trang Thiết lập, giữ nguyên vị trí và CV đã chọn.
 */
export function InterviewLobby({ jdId, cvId }: { jdId: string | null; cvId: string | null }) {
  const router = useRouter()
  const profile = useProfile()
  const { data: jds, error: jdsError, reload: reloadJds } = useApi(api.listInterviewJds)
  const { data: cvs, error: cvsError, reload: reloadCvs } = useApi(api.listCvVersions)
  const jdKey = jdId ?? ""
  const fetchQuota = useCallback(() => api.getQuota(jdKey), [jdKey])
  const { data: quota } = useApi(fetchQuota)
  const [starting, setStarting] = useState(false)

  const params = new URLSearchParams()
  if (jdId) params.set("jd", jdId)
  if (cvId) params.set("cv", cvId)
  const setupHref = `/student/interview/new${params.size > 0 ? `?${params}` : ""}`

  if (jdsError || cvsError) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không mở được phòng phỏng vấn</p>
        <p className="max-w-md text-sm text-ink-2">{(jdsError ?? cvsError)?.message}</p>
        <Button
          variant="soft"
          onClick={() => {
            reloadJds()
            reloadCvs()
          }}
        >
          Thử lại
        </Button>
      </Panel>
    )
  }

  if (!jds || !cvs) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang chuẩn bị phòng phỏng vấn">
        <Skeleton className="h-20 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[320px] rounded-[20px]" />
          <Skeleton className="h-[360px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  const jd = jds.find((j) => j.id === jdId)
  const cv = cvs.find((c) => c.id === cvId)
  if (!jd || !cv) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-warn" aria-hidden />
        <p className="font-heading font-bold">Chưa chọn vị trí hoặc CV cho buổi phỏng vấn</p>
        <p className="max-w-md text-sm text-ink-2">Hãy chọn vị trí ứng tuyển và CV ở trang Thiết lập rồi bắt đầu lại.</p>
        <Button nativeButton={false} render={<Link href={setupHref} />}>
          Về trang Thiết lập
        </Button>
      </Panel>
    )
  }

  const exhausted = quota !== undefined && quota.remaining === 0

  async function ready() {
    if (!jd || !cv) return
    setStarting(true)
    try {
      const session = await api.createInterview({ jd_id: jd.id, cv_version_id: cv.id })
      // replace: bấm Back trong phòng không quay lại phòng chờ (sẽ tạo thêm buổi mới)
      router.replace(`/student/interview/${encodeURIComponent(session.id)}`)
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Không bắt đầu được phỏng vấn.")
      setStarting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <RoomHeader title={jd.title} tone="idle" status="Chưa bắt đầu">
        <RoomProgress total={QUESTION_COUNT} answered={new Set()} currentIndex={null} label={`${QUESTION_COUNT} câu hỏi`}>
          <span className="flex items-center gap-1 border-l border-line pl-4 font-heading text-base font-bold text-ink-3 tabular-nums">
            <Timer className="size-4" aria-hidden />
            {mmss(SECONDS_PER_QUESTION)}
          </span>
        </RoomProgress>
      </RoomHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-heading font-bold text-violet">AI Career Coach</span>
              <Badge variant="violet">Người phỏng vấn</Badge>
            </p>
            <div className="rounded-2xl rounded-tl-sm border border-violet/15 bg-violet-soft/40 p-4 text-[15px] leading-7 text-ink">
              Chào {profile?.full_name ?? "bạn"}! Mình là AI Career Coach. Hôm nay mình sẽ phỏng vấn bạn cho vị trí{" "}
              <strong>{jd.title}</strong> với {QUESTION_COUNT} câu hỏi hành vi. Khi bạn sẵn sàng, mình sẽ bắt đầu với câu hỏi
              đầu tiên.
            </div>
          </div>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-52">
          <QuestionRoadmap total={QUESTION_COUNT} turns={[]} currentIndex={null} />
        </aside>
      </div>

      <RulesDialog
        context={`${jd.title} · ${cv.file_name} (${cv.label})`}
        quota={quota ? `Còn ${quota.remaining}/${quota.limit} buổi cho vị trí này trong tuần` : null}
        exhausted={exhausted}
        starting={starting}
        onBack={() => router.push(setupHref)}
        onReady={() => void ready()}
      />
    </div>
  )
}

const RULES: { icon: typeof Timer; text: ReactNode }[] = [
  {
    icon: Timer,
    text: (
      <>
        Mỗi câu có <strong>{SECONDS_PER_QUESTION / 60} phút</strong>. Hết giờ, phần bạn đang gõ được tự nộp; câu trả lời dưới{" "}
        {MIN_ANSWER_CHARS} ký tự được 0 điểm.
      </>
    ),
  },
  {
    icon: Pause,
    text: (
      <>
        Được <strong>tạm dừng 1 lần</strong> mỗi buổi, tối đa {PAUSE_MAX_SECONDS} giây.
      </>
    ),
  },
  {
    icon: ClipboardCheck,
    text: (
      <>
        Điểm và nhận xét <strong>không hiện trong lúc phỏng vấn</strong>; bạn xem đầy đủ trong báo cáo sau khi trả lời đủ{" "}
        {QUESTION_COUNT} câu.
      </>
    ),
  },
  {
    icon: LogOut,
    text: (
      <>
        Kết thúc sớm hoặc rời phòng giữa chừng thì buổi <strong>không được lưu</strong> và không tính lượt.
      </>
    ),
  },
  {
    icon: ShieldCheck,
    text: "Trả lời bằng trải nghiệm thật của bạn; nội dung không liên quan đến buổi phỏng vấn sẽ không được tính.",
  },
]

interface RulesDialogProps {
  /** "Vị trí · CV" của buổi sắp bắt đầu. */
  context: string
  quota: string | null
  exhausted: boolean
  starting: boolean
  onBack: () => void
  onReady: () => void
}

/** Popup luật buổi phỏng vấn; chỉ đóng bằng "Quay lại" hoặc "Sẵn sàng" (Esc và bấm ra ngoài không đóng). */
function RulesDialog({ context, quota, exhausted, starting, onBack, onReady }: RulesDialogProps) {
  return (
    <DialogPrimitive.Root open disablePointerDismissal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-[24px] bg-card p-6 shadow-float outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:p-8">
          <div className="grid gap-2">
            <p className="text-xs font-bold tracking-[0.12em] text-violet uppercase">Trước khi bắt đầu</p>
            <DialogPrimitive.Title className="font-heading text-[26px] leading-8 font-extrabold">
              Luật buổi phỏng vấn
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="grid gap-0.5 text-sm text-ink-2">
              <span className="truncate" title={context}>
                {context}
              </span>
              {quota && <span className={exhausted ? "font-medium text-warn" : "text-violet"}>{quota}</span>}
            </DialogPrimitive.Description>
          </div>

          <ul className="grid gap-2">
            {RULES.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm leading-6 text-ink">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-soft text-violet">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>

          {exhausted ? (
            <p className="flex items-start gap-1.5 text-sm text-warn" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Bạn đã dùng hết lượt cho vị trí này trong tuần. Hãy quay lại chọn vị trí khác.
            </p>
          ) : (
            <p className="text-sm text-ink-2">Đồng hồ câu 1 chỉ bắt đầu chạy khi bạn bấm Sẵn sàng.</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
            <Button variant="ghost" className="h-11 px-4" onClick={onBack} disabled={starting}>
              <ArrowLeft aria-hidden />
              Quay lại
            </Button>
            <Button variant="violet" size="brand" onClick={onReady} disabled={starting || exhausted}>
              {starting ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {starting ? "Đang mở phòng…" : "Sẵn sàng"}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
