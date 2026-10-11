"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ArrowLeft, ArrowRight, Check, History, Pause, Timer, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  MIN_ANSWER_CHARS,
  PAUSE_MAX_SECONDS,
  QUESTION_COUNT,
  QUESTION_THEMES,
  RUBRIC_SCALE,
  SECONDS_PER_QUESTION,
  STAR_META,
  STAR_ORDER,
  mmss,
} from "@/lib/interview"
import { cn } from "@/lib/utils"

const MINUTES = (QUESTION_COUNT * SECONDS_PER_QUESTION) / 60

// ---------- "Không hiển thị lại" (chỉ lưu trên trình duyệt này) ----------

const INTRO_HIDDEN_KEY = "careerx:interview-intro-hidden"

export function interviewIntroHidden(): boolean {
  try {
    return localStorage.getItem(INTRO_HIDDEN_KEY) === "1"
  } catch {
    return false
  }
}

function hideInterviewIntro() {
  try {
    localStorage.setItem(INTRO_HIDDEN_KEY, "1")
  } catch {
    // Trình duyệt chặn storage: popup sẽ hiện lại ở lần sau, không ảnh hưởng gì khác.
  }
}

// ---------- Popup giới thiệu khi vào trang ----------

const INTRO_POINTS = [
  "Chọn vị trí và CV để AI đặt câu hỏi sát thực tế",
  `Trả lời ${QUESTION_COUNT} câu hỏi, mỗi câu ${SECONDS_PER_QUESTION / 60} phút`,
  "Nhận điểm STAR và báo cáo sau buổi",
]

/** Hình minh hoạ bên trái popup: câu hỏi, đồng hồ và điểm STAR như trong phòng (chỉ để trang trí). */
function IntroArt() {
  return (
    <div aria-hidden className="relative hidden overflow-hidden bg-panel md:block">
      <div className="absolute inset-0 grid place-content-center gap-3 px-10">
        <div className="grid w-60 gap-2 rounded-xl bg-card p-3 shadow-card">
          <span className="w-fit rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
            Câu 1 / {QUESTION_COUNT}
          </span>
          <span className="h-1.5 w-11/12 rounded bg-line-strong" />
          <span className="h-1.5 w-3/4 rounded bg-line" />
        </div>
        <div className="flex items-center gap-2 self-end justify-self-end">
          <span className="flex items-center gap-1 rounded-full bg-card px-3 py-1 text-sm font-semibold text-ink tabular-nums shadow-card">
            <Timer className="size-3.5" />
            {mmss(SECONDS_PER_QUESTION)}
          </span>
          <span className="grid size-7 place-items-center rounded-full bg-card text-ink shadow-card">
            <Pause className="size-3.5" />
          </span>
        </div>
        <div className="grid w-60 grid-cols-4 gap-1.5 rounded-xl bg-card p-3 shadow-card">
          {STAR_ORDER.map((key, i) => (
            <span
              key={key}
              className={cn(
                "relative grid h-10 place-items-center rounded-lg text-base font-semibold",
                i < 3 ? "bg-surface text-ink" : "border border-dashed border-line-strong text-ink-3",
              )}
            >
              {STAR_META[key].letter}
              {i < 3 && (
                <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-good text-white">
                  <Check className="size-2.5" />
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

interface InterviewIntroProps {
  open: boolean
  onClose: () => void
  /** Gọi sau khi popup đóng hẳn (để hướng dẫn mở ra không bị popup đang đóng cướp focus). */
  onStartTour: () => void
}

/**
 * Popup giới thiệu mỗi lần vào trang Thiết lập phỏng vấn: chọn xem hướng dẫn hoặc bỏ qua; tick "Không hiển thị lại"
 * thì từ lần sau không tự hiện nữa (vẫn mở hướng dẫn được bằng nút "Hướng dẫn").
 */
export function InterviewIntro({ open, onClose, onStartTour }: InterviewIntroProps) {
  const [dontShow, setDontShow] = useState(false)
  const startTour = useRef(false)
  const startRef = useRef<HTMLButtonElement>(null)

  function close(start: boolean) {
    if (dontShow) hideInterviewIntro()
    startTour.current = start
    onClose()
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => !next && close(false)}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen || !startTour.current) return
        startTour.current = false
        onStartTour()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          initialFocus={startRef}
          className="fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[min(880px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] bg-card shadow-dialog outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <IntroArt />
          <div className="relative grid gap-5 overflow-y-auto p-6 sm:p-8">
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
            <div className="grid gap-3 pr-6">
              <p className="text-[13px] font-semibold text-ink-3">Phòng phỏng vấn thử</p>
              <DialogPrimitive.Title className="text-[28px] leading-9 font-semibold tracking-[-0.02em] text-balance">
                Sẵn sàng cho buổi phỏng vấn thử của bạn?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[15px] leading-6 text-ink-2">
                {QUESTION_COUNT} câu hỏi hành vi như một buổi phỏng vấn thật, khoảng {MINUTES} phút. AI chấm từng câu theo
                khung STAR và gợi ý cách trình bày rõ hơn.
              </DialogPrimitive.Description>
            </div>
            <ol className="grid gap-2">
              {INTRO_POINTS.map((point, i) => (
                <li key={point} className="flex items-center gap-3 border-b border-line py-3 text-sm font-medium text-ink first:border-t">
                  <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-blue-soft text-xs font-semibold text-accent-strong">
                    {i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ol>
            <div className="grid gap-3">
              <p className="text-sm text-ink-2">Hướng dẫn gồm 5 bước ngắn, bạn có thể dừng bất cứ lúc nào.</p>
              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-ink">
                <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(v === true)} />
                Không hiển thị lại
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
              <Button variant="ghost" size="brand" onClick={() => close(false)}>
                Bỏ qua
              </Button>
              <Button ref={startRef} size="brand" onClick={() => close(true)}>
                Bắt đầu hướng dẫn
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ---------- Hướng dẫn từng bước ----------

/** Phần tử trên trang được làm nổi bật, đánh dấu bằng data-tour="...". */
export type TourTarget = "setup" | "summary"

interface TourStep {
  title: string
  body: ReactNode
  /** Không có: bước hiện giữa màn hình (nói về những gì diễn ra trong phòng, lúc này chưa mở). */
  target?: TourTarget
  illustration?: ReactNode
}

function steps(weeklyLimit: number): TourStep[] {
  return [
    {
      target: "setup",
      title: "Chọn CV và vị trí",
      body: "Chọn CV bạn dùng để trả lời, rồi chọn vị trí trong danh sách gợi ý, vị trí đã lưu hoặc vị trí đã phân tích. AI đặt câu hỏi theo vị trí và đối chiếu với kinh nghiệm trong CV.",
    },
    {
      title: `${QUESTION_COUNT} câu hỏi, ${QUESTION_COUNT} chủ đề`,
      body: "Mỗi câu hỏi xoay quanh một chủ đề. Hãy kể một trải nghiệm thật, cụ thể cho từng câu.",
      illustration: (
        <ol className="grid gap-2 sm:grid-cols-2">
          {QUESTION_THEMES.map((theme, i) => (
            <li key={theme} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-sm font-medium text-ink">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-soft text-xs font-semibold text-accent-strong">
                {i + 1}
              </span>
              {theme}
            </li>
          ))}
        </ol>
      ),
    },
    {
      title: "Đồng hồ và tạm dừng",
      body: (
        <>
          Mỗi câu có <strong className="text-ink">{SECONDS_PER_QUESTION / 60} phút</strong> đếm ngược. Hết giờ, phần bạn
          đang gõ được tự nộp; câu trả lời dưới {MIN_ANSWER_CHARS} ký tự được 0 điểm. Mỗi buổi được{" "}
          <strong className="text-ink">tạm dừng 1 lần</strong>, tối đa {PAUSE_MAX_SECONDS} giây.
        </>
      ),
      // Bản minh hoạ đồng hồ và nút Tạm dừng giống trong phòng phỏng vấn
      illustration: (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-surface p-4" aria-hidden>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-lg font-semibold text-ink tabular-nums shadow-card">
            <Timer className="size-4" />
            {mmss(SECONDS_PER_QUESTION)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-sm font-semibold text-ink shadow-card">
            <Pause className="size-4" />
            Tạm dừng
          </span>
        </div>
      ),
    },
    {
      title: "Chấm điểm theo STAR",
      body: "Mỗi câu được chấm 4 tiêu chí. Như một buổi phỏng vấn thật, điểm không hiện trong lúc trả lời; điểm và nhận xét từng câu có trong báo cáo sau khi bạn hoàn thành đủ các câu.",
      illustration: (
        <div className="grid gap-3">
          <div className="grid grid-cols-4 gap-2">
            {STAR_ORDER.map((key) => (
              <span key={key} className="grid justify-items-center gap-0.5 rounded-xl bg-surface px-1 py-2.5 text-center">
                <span className="text-lg font-semibold text-ink">{STAR_META[key].letter}</span>
                <span className="text-xs text-ink-2">{STAR_META[key].label}</span>
              </span>
            ))}
          </div>
          <p className="text-xs leading-5 text-ink-2">
            Thang 0–5:{" "}
            {RUBRIC_SCALE.filter((r) => [0, 3, 5].includes(r.score))
              .map((r) => `${r.score} = ${r.label.toLowerCase()}`)
              .join("; ")}
            .
          </p>
          <p className="flex items-start gap-2 rounded-xl bg-panel px-3 py-2.5 text-sm leading-5 text-ink-2">
            <History className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            Mọi buổi đã hoàn thành được lưu ở trang Lịch sử & Tiến bộ để bạn xem lại báo cáo và theo dõi điểm qua các buổi.
          </p>
        </div>
      ),
    },
    {
      target: "summary",
      title: "Lượt luyện và bắt đầu",
      body: (
        <>
          Mỗi vị trí có <strong className="text-ink">{weeklyLimit} buổi chấm điểm mỗi tuần</strong>; chỉ buổi làm đủ{" "}
          {QUESTION_COUNT} câu mới tính lượt. Bấm <strong className="text-ink">Vào phòng chờ</strong> để xem luật; đồng hồ chỉ
          chạy khi bạn bấm <strong className="text-ink">Sẵn sàng</strong>.
        </>
      ),
    },
  ]
}

// ---------- Vị trí ô được làm nổi bật, bong bóng và mũi nhọn ----------

const EDGE = 16
const GAP = 20
const HOLE_PADDING = 12
const CARET_INSET = 28

type Side = "right" | "bottom" | "left" | "top"

interface Layout {
  hole: { top: number; left: number; width: number; height: number } | null
  bubble: { top: number; left: number }
  /** Phía của ô mà bong bóng nằm, và vị trí mũi nhọn dọc theo cạnh bong bóng (px). */
  caret: { side: Side; offset: number } | null
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

/** Đặt bong bóng cạnh ô (ưu tiên bên phải, dưới, trái, trên); không có ô thì ở giữa màn hình. */
function layoutFor(target: HTMLElement | null, bubble: HTMLElement): Layout {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = bubble.offsetWidth
  const h = bubble.offsetHeight
  if (!target) return { hole: null, bubble: { top: (vh - h) / 2, left: (vw - w) / 2 }, caret: null }

  const r = target.getBoundingClientRect()
  const hole = {
    top: r.top - HOLE_PADDING,
    left: r.left - HOLE_PADDING,
    width: r.width + HOLE_PADDING * 2,
    height: r.height + HOLE_PADDING * 2,
  }
  const centerX = r.left + r.width / 2
  const centerY = r.top + r.height / 2
  const beside = (side: Side, left: number): Layout => {
    const top = clamp(centerY - h / 2, EDGE, vh - h - EDGE)
    return { hole, bubble: { top, left }, caret: { side, offset: clamp(centerY - top, CARET_INSET, h - CARET_INSET) } }
  }
  const stacked = (side: Side, top: number): Layout => {
    const left = clamp(centerX - w / 2, EDGE, vw - w - EDGE)
    return { hole, bubble: { top, left }, caret: { side, offset: clamp(centerX - left, CARET_INSET, w - CARET_INSET) } }
  }

  const right = hole.left + hole.width + GAP
  const below = hole.top + hole.height + GAP
  if (right + w <= vw - EDGE) return beside("right", right)
  if (below + h <= vh - EDGE) return stacked("bottom", below)
  if (hole.left - GAP - w >= EDGE) return beside("left", hole.left - GAP - w)
  if (hole.top - GAP - h >= EDGE) return stacked("top", hole.top - GAP - h)
  // Ô cao hơn màn hình, không còn chỗ trống quanh ô: đặt popup ở góc dưới bên phải trong ô, che phần cuối ít quan trọng.
  const left = clamp(hole.left + hole.width - w - 24, EDGE, vw - w - EDGE)
  return { hole, bubble: { top: vh - h - EDGE - 8, left }, caret: null }
}

/** Mũi nhọn trên cạnh bong bóng, chỉ về phía ô đang nói tới. */
function Caret({ side, offset }: { side: Side; offset: number }) {
  const edge = { right: "left", left: "right", bottom: "top", top: "bottom" }[side]
  const along = side === "right" || side === "left" ? "top" : "left"
  return <span aria-hidden className="absolute size-4 rotate-45 bg-card" style={{ [edge]: -7, [along]: offset - 8 }} />
}

interface InterviewTourProps {
  open: boolean
  /** Đóng bằng "Bỏ qua hướng dẫn", Esc hoặc nút cuối. */
  onClose: () => void
  /** Số buổi chấm điểm mỗi vị trí mỗi tuần (hạn mức hiện tại của SV). */
  weeklyLimit: number
}

/**
 * Hướng dẫn từng bước ở trang Thiết lập phỏng vấn: làm tối trang, khoét sáng ô đang nói tới (data-tour) kèm mũi nhọn
 * chỉ vào ô; các bước về những gì diễn ra trong phòng thì hiện giữa màn hình kèm hình minh hoạ.
 */
export function InterviewTour({ open, onClose, weeklyLimit }: InterviewTourProps) {
  const [index, setIndex] = useState(0)
  const [layout, setLayout] = useState<Layout | null>(null)
  const bubbleRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const all = useMemo(() => steps(weeklyLimit), [weeklyLimit])
  const step = all[index]
  const targetKey = step.target
  const last = index === all.length - 1

  const measure = useCallback(() => {
    if (!bubbleRef.current) return
    const target = targetKey ? document.querySelector<HTMLElement>(`[data-tour="${targetKey}"]`) : null
    setLayout(layoutFor(target, bubbleRef.current))
  }, [targetKey])

  // Popup có thể được gắn vào trang sau lần render đầu: đo ngay khi nó xuất hiện.
  const bubbleCallbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      bubbleRef.current = el
      if (el) measure()
    },
    [measure],
  )

  // Mỗi bước: cuộn ô đang nói tới vào giữa màn hình rồi đo lại (nội dung các bước cao thấp khác nhau).
  useLayoutEffect(() => {
    if (!open) return
    const target = targetKey ? document.querySelector<HTMLElement>(`[data-tour="${targetKey}"]`) : null
    // Ô cao hơn màn hình thì cuộn tới đầu ô (dưới header dính) để thấy phần đầu, không thì đặt giữa màn hình.
    if (target) {
      const tall = target.offsetHeight > window.innerHeight - 160
      if (tall) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 96, behavior: "instant" })
      else target.scrollIntoView({ block: "center", behavior: "instant" })
    }
    measure()
  }, [open, index, targetKey, measure])

  useEffect(() => {
    if (!open) return
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", measure, true)
    return () => {
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", measure, true)
    }
  }, [open, measure])

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return
        setIndex(0)
        setLayout(null)
      }}
      modal="trap-focus"
      disablePointerDismissal
    >
      <DialogPrimitive.Portal>
        {/* Lớp chặn bấm vào trang; bước có ô nổi bật thì phần tối nằm ở bóng của ô khoét sáng */}
        <div className={cn("fixed inset-0 z-50", layout?.hole ? "bg-transparent" : "bg-ink/30")} aria-hidden />
        {layout?.hole && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-50 rounded-[22px] shadow-[0_0_0_2px_var(--ink),0_0_0_9999px_rgb(24_24_27/0.45)] transition-all duration-300 ease-out"
            style={layout.hole}
          />
        )}
        <DialogPrimitive.Popup
          ref={bubbleCallbackRef}
          initialFocus={nextRef}
          className="fixed z-50 grid w-[min(460px,calc(100vw-32px))] gap-5 rounded-[22px] bg-card p-6 text-ink shadow-dialog outline-none transition-[top,left] duration-300 ease-out"
          // Ẩn bằng opacity (không dùng visibility) cho tới khi đo xong vị trí, để nút "Tiếp" vẫn nhận được focus ban đầu
          style={{ ...layout?.bubble, opacity: layout ? 1 : 0 }}
        >
          {layout?.caret && <Caret {...layout.caret} />}
          <div className="flex gap-1.5" aria-hidden>
            {all.map((_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= index ? "bg-ink" : "bg-line-strong")} />
            ))}
          </div>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-base font-semibold text-white">
              {index + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink-3">
                Bước {index + 1}/{all.length}
                <button type="button" onClick={onClose} className="font-medium text-ink-2 hover:text-ink hover:underline">
                  Bỏ qua hướng dẫn
                </button>
              </span>
              <DialogPrimitive.Title className="text-xl leading-7 font-semibold">{step.title}</DialogPrimitive.Title>
            </div>
          </div>
          <DialogPrimitive.Description className="text-[15px] leading-6 text-ink-2">{step.body}</DialogPrimitive.Description>
          {step.illustration}
          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            {index > 0 && (
              <Button variant="ghost" className="h-10 rounded-full px-3.5 font-semibold" onClick={() => setIndex(index - 1)}>
                <ArrowLeft aria-hidden />
                Quay lại
              </Button>
            )}
            <Button
              ref={nextRef}
              className="h-10 rounded-full px-5 font-semibold"
              onClick={() => (last ? onClose() : setIndex(index + 1))}
            >
              {last ? "Đã hiểu, bắt đầu thôi" : "Tiếp"}
              {!last && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
