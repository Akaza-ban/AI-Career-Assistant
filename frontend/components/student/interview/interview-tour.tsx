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
    <div aria-hidden className="relative hidden overflow-hidden bg-navy md:block">
      <span className="absolute -top-24 -left-24 size-64 rounded-full border border-white/15" />
      <span className="absolute -right-20 -bottom-28 size-72 rounded-full border border-white/15" />
      <span className="absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/25 blur-3xl" />
      <div className="absolute inset-0 grid place-content-center gap-3 px-10">
        <div className="grid w-60 gap-2 rounded-xl border border-white/25 bg-white/5 p-3">
          <span className="w-fit rounded-full bg-violet px-2 py-0.5 text-[10px] font-semibold text-white">
            Câu 1/{QUESTION_COUNT}
          </span>
          <span className="h-1.5 w-11/12 rounded bg-white/40" />
          <span className="h-1.5 w-3/4 rounded bg-white/25" />
        </div>
        <div className="flex items-center gap-2 self-end justify-self-end">
          <span className="flex items-center gap-1 rounded-lg bg-gold px-2.5 py-1 font-heading text-sm font-bold text-navy tabular-nums">
            <Timer className="size-3.5" />
            {mmss(SECONDS_PER_QUESTION)}
          </span>
          <span className="grid size-7 place-items-center rounded-full bg-white/15 text-white">
            <Pause className="size-3.5" />
          </span>
        </div>
        <div className="grid w-60 grid-cols-4 gap-1.5 rounded-xl border border-white/25 bg-white/5 p-3">
          {STAR_ORDER.map((key, i) => (
            <span
              key={key}
              className={cn(
                "relative grid h-10 place-items-center rounded-lg font-heading text-base font-bold",
                i < 3 ? "bg-white/15 text-white" : "border border-dashed border-white/30 text-white/50",
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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          initialFocus={startRef}
          className="fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-32px)] w-[min(880px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] bg-card shadow-float outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <IntroArt />
          <div className="relative grid gap-5 overflow-y-auto p-6 sm:p-8">
            <DialogPrimitive.Close
              aria-label="Đóng"
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
            <div className="grid gap-3 pr-6">
              <p className="text-xs font-bold tracking-[0.12em] text-violet uppercase">Phòng phỏng vấn thử</p>
              <DialogPrimitive.Title className="font-heading text-[28px] leading-9 font-extrabold text-balance">
                Sẵn sàng cho <span className="text-grad">buổi phỏng vấn thử</span> của bạn?
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-[15px] leading-6 text-ink-2">
                {QUESTION_COUNT} câu hỏi hành vi như một buổi phỏng vấn thật, khoảng {MINUTES} phút. AI chấm từng câu theo
                khung STAR và gợi ý cách trình bày rõ hơn.
              </DialogPrimitive.Description>
            </div>
            <ol className="grid gap-2">
              {INTRO_POINTS.map((point, i) => (
                <li key={point} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm font-medium text-ink">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-soft font-heading text-xs font-bold text-violet">
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
              <Button variant="ghost" className="h-11 px-4" onClick={() => close(false)}>
                Bỏ qua
              </Button>
              <Button ref={startRef} variant="violet" size="brand" onClick={() => close(true)}>
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
      title: "Chọn vị trí và CV",
      body: "AI đặt câu hỏi theo vị trí bạn chọn và đối chiếu với kinh nghiệm trong CV. Các kỹ năng của vị trí hiện ngay bên dưới để bạn chuẩn bị ví dụ từ trước.",
    },
    {
      title: `${QUESTION_COUNT} câu hỏi, ${QUESTION_COUNT} chủ đề`,
      body: "Mỗi câu hỏi xoay quanh một chủ đề. Hãy kể một trải nghiệm thật, cụ thể cho từng câu.",
      illustration: (
        <ol className="grid gap-2 sm:grid-cols-2">
          {QUESTION_THEMES.map((theme, i) => (
            <li key={theme} className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-sm font-medium text-ink">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-soft text-xs font-bold text-violet">
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
          <span className="flex items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 font-heading text-lg font-bold text-ink tabular-nums shadow-card">
            <Timer className="size-4" />
            {mmss(SECONDS_PER_QUESTION)}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink shadow-card">
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
                <span className="font-heading text-lg font-bold text-blue">{STAR_META[key].letter}</span>
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
          <p className="flex items-start gap-2 rounded-xl bg-blue-soft/60 px-3 py-2.5 text-sm leading-5 text-ink">
            <History className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
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
          {QUESTION_COUNT} câu mới tính lượt. Bấm <strong className="text-ink">Bắt đầu phỏng vấn</strong> để vào phòng; đồng
          hồ chỉ chạy khi bạn đọc luật và bấm <strong className="text-ink">Sẵn sàng</strong>.
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
  return stacked("top", Math.max(EDGE, hole.top - GAP - h))
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
    target?.scrollIntoView({ block: "center", behavior: "instant" })
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
        <div className={cn("fixed inset-0 z-50", layout?.hole ? "bg-transparent" : "bg-navy/60")} aria-hidden />
        {layout?.hole && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-50 rounded-[26px] shadow-[0_0_0_3px_var(--violet),0_0_0_10px_rgb(103_65_224/0.25),0_0_0_9999px_rgb(11_21_51/0.6)] transition-all duration-300 ease-out"
            style={layout.hole}
          />
        )}
        <DialogPrimitive.Popup
          ref={bubbleCallbackRef}
          initialFocus={nextRef}
          className="fixed z-50 grid w-[min(460px,calc(100vw-32px))] gap-5 rounded-[20px] bg-card p-6 text-ink shadow-float outline-none transition-[top,left] duration-300 ease-out"
          // Ẩn bằng opacity (không dùng visibility) cho tới khi đo xong vị trí, để nút "Tiếp" vẫn nhận được focus ban đầu
          style={{ ...layout?.bubble, opacity: layout ? 1 : 0 }}
        >
          {layout?.caret && <Caret {...layout.caret} />}
          <div className="flex gap-1.5" aria-hidden>
            {all.map((_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= index ? "bg-violet" : "bg-line")} />
            ))}
          </div>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet font-heading text-base font-bold text-white shadow-[0_6px_14px_-6px_var(--violet)]">
              {index + 1}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex items-center justify-between gap-3 text-xs font-semibold text-violet">
                Bước {index + 1}/{all.length}
                <button type="button" onClick={onClose} className="font-medium text-ink-2 hover:text-ink hover:underline">
                  Bỏ qua hướng dẫn
                </button>
              </span>
              <DialogPrimitive.Title className="font-heading text-xl leading-7 font-bold">{step.title}</DialogPrimitive.Title>
            </div>
          </div>
          <DialogPrimitive.Description className="text-[15px] leading-6 text-ink-2">{step.body}</DialogPrimitive.Description>
          {step.illustration}
          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            {index > 0 && (
              <Button variant="ghost" className="h-10 px-3" onClick={() => setIndex(index - 1)}>
                <ArrowLeft aria-hidden />
                Quay lại
              </Button>
            )}
            <Button
              ref={nextRef}
              variant="violet"
              className="h-10 px-5"
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
