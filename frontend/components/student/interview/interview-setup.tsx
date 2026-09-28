"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Briefcase,
  CircleCheck,
  Clock,
  FileText,
  History,
  Info,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Mic,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { features } from "@/lib/features"
import { formatRelativeTime } from "@/lib/format"
import type { InterviewDifficulty, JobLevel } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const LEVELS: { value: JobLevel; title: string; description: string }[] = [
  { value: "intern", title: "Thực tập (Intern)", description: "Sinh viên năm 3–4 mới làm quen nghiệp vụ thực tế." },
  { value: "fresher", title: "Fresher", description: "Dưới 1 năm kinh nghiệm, đã nắm vững khung phân tích." },
  { value: "junior", title: "Junior", description: "1–2 năm kinh nghiệm độc lập, dẫn dắt tài liệu dự án." },
]

const DIFFICULTIES: { value: InterviewDifficulty; title: string; description: string }[] = [
  { value: "gentle", title: "Nhẹ nhàng", description: "Khởi động, AI gợi ý cấu trúc nếu bạn bế tắc." },
  { value: "realistic", title: "Thực tế doanh nghiệp", description: "Đặt câu hỏi xoáy sâu hành vi và số liệu." },
  { value: "stress", title: "Áp lực cao", description: "Thách thức giả định, giới hạn thời gian trả lời." },
]

// Figma: frame "Thiết lập phỏng vấn" (18:3078). PRD US-SV-04.
export function InterviewSetup({ initialJdId }: { initialJdId: string | null }) {
  const router = useRouter()
  const { data: library } = useApi(api.listJdLibrary)
  const { data: cvs } = useApi(api.listCvVersions)
  const { data: rounds } = useApi(api.listInterviewRounds)
  const { data: quota } = useApi(api.getQuota)
  const { data: recent } = useApi(api.listRecentInterviews)

  const [jdId, setJdId] = useState<string | null>(initialJdId)
  const [cvId, setCvId] = useState<string | null>(null)
  const [level, setLevel] = useState<JobLevel>("intern")
  const [roundIds, setRoundIds] = useState<string[]>(["round-hr", "round-domain"])
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("realistic")
  const [starting, setStarting] = useState(false)

  const activeCv = cvs?.find((cv) => cv.id === cvId) ?? cvs?.find((cv) => cv.is_active) ?? cvs?.[0]
  const jd = useMemo(() => {
    if (!library?.length) return undefined
    return (
      library.find((j) => j.id === jdId) ??
      library.find((j) => j.title === activeCv?.target_title) ??
      library[0]
    )
  }, [library, jdId, activeCv])

  const chosenRounds = (rounds ?? []).filter((r) => roundIds.includes(r.id))
  const minutes = chosenRounds.reduce((sum, r) => sum + r.minutes, 0)
  const questions = chosenRounds.reduce((sum, r) => sum + r.question_count, 0)
  const remaining = quota ? Math.max(0, quota.limit - quota.used) : 0
  const overQuota = quota ? chosenRounds.length > remaining : false

  function toggleRound(id: string) {
    setRoundIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  async function start() {
    if (!jd || !activeCv || chosenRounds.length === 0 || overQuota) return
    setStarting(true)
    try {
      const session = await api.createInterview({
        jd_id: jd.id,
        cv_version_id: activeCv.id,
        level,
        round_ids: chosenRounds.map((r) => r.id),
        difficulty,
        mode: "text",
        question_count: questions,
      })
      router.push(`/student/interview/${encodeURIComponent(session.id)}`)
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Không bắt đầu được phỏng vấn.")
      setStarting(false)
    }
  }

  if (!library || !cvs || !rounds || !quota) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-24 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[900px] rounded-[20px]" />
          <Skeleton className="h-[480px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  if (cvs.length === 0) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <FileText className="size-8 text-ink-3" aria-hidden />
        <p className="font-heading font-bold">Bạn cần tải CV lên trước khi luyện phỏng vấn</p>
        <p className="max-w-md text-sm text-ink-2">AI dựa vào kinh nghiệm trong CV để đặt câu hỏi sát với bạn.</p>
        <Button nativeButton={false} render={<Link href="/student/cv" />}>
          Đến CV của tôi
        </Button>
      </Panel>
    )
  }

  const jdItems = library.map((j) => ({ value: j.id, label: `${j.title}${j.company ? ` – ${j.company}` : ""}` }))
  const cvItems = cvs.map((cv) => ({ value: cv.id, label: `${cv.file_name} (${cv.label})` }))

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="violet" className="h-auto px-2.5 py-1">
          <Sparkles aria-hidden />
          Mô phỏng AI STAR • 3 vòng phỏng vấn
        </Badge>
        <h1 className="font-heading text-[32px] leading-10 font-extrabold">Thiết lập phiên phỏng vấn thử</h1>
        <p className="max-w-2xl text-ink-2">
          Chọn bối cảnh và các vòng phỏng vấn theo JD mục tiêu để AI Career Coach cá nhân hoá bộ câu hỏi và chấm điểm theo
          chuẩn STAR.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <Step n={1} title="Chọn vị trí & CV đối soát">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vị trí ứng tuyển" icon={Briefcase}>
                <Select items={jdItems} value={jd?.id ?? null} onValueChange={(v) => setJdId(String(v))}>
                  <SelectTrigger className="h-10 w-full min-w-0 bg-surface" aria-label="Vị trí ứng tuyển">
                    <SelectValue className="min-w-0 truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {jdItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tệp CV đối soát" icon={FileText}>
                <Select items={cvItems} value={activeCv?.id ?? null} onValueChange={(v) => setCvId(String(v))}>
                  <SelectTrigger className="h-10 w-full min-w-0 bg-surface" aria-label="Tệp CV đối soát">
                    <SelectValue className="min-w-0 truncate" />
                  </SelectTrigger>
                  <SelectContent>
                    {cvItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {jd && (
              <div className="flex flex-wrap gap-1.5">
                {jd.skills.map((s) => (
                  <span key={s} className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </Step>

          <Step n={2} title="Cấp độ ứng tuyển">
            <div role="radiogroup" aria-label="Cấp độ ứng tuyển" className="grid gap-3 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <ChoiceCard key={l.value} selected={level === l.value} onClick={() => setLevel(l.value)} title={l.title}>
                  {l.description}
                </ChoiceCard>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
              <Info className="size-3.5" aria-hidden />
              Độ phức tạp câu hỏi và kỳ vọng số liệu định lượng (Result) được điều chỉnh theo cấp độ.
            </p>
          </Step>

          <Step n={3} title="Chọn vòng phỏng vấn (tuần tự)" aside="Chọn 1 hoặc nhiều vòng">
            <div className="grid gap-3" role="group" aria-label="Vòng phỏng vấn">
              {rounds.map((r) => {
                const checked = roundIds.includes(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleRound(r.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      checked ? "border-violet bg-violet-soft/40 ring-2 ring-violet/15" : "border-line hover:border-violet/40",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2",
                        checked ? "border-violet bg-violet text-white" : "border-ink-3",
                      )}
                    >
                      {checked && <CircleCheck className="size-3.5" />}
                    </span>
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-heading font-bold text-ink">{r.title}</span>
                        {r.focus_jd && <Badge variant="violet">Trọng tâm JD</Badge>}
                      </span>
                      <span className="text-[13px] text-ink-2">{r.description}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-ink-2">
                      <span className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5">
                        <Clock className="size-3" aria-hidden />
                        {r.minutes} phút
                      </span>
                      <span className="rounded-full bg-surface px-2 py-0.5">{r.question_count} câu hỏi</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-soft/50 px-4 py-2.5 text-sm text-ink">
              <span>
                {chosenRounds.length > 0
                  ? `Chạy tuần tự ${chosenRounds.length} vòng đã chọn (ước tính ~${minutes} phút, ${questions} câu hỏi)`
                  : "Hãy chọn ít nhất một vòng phỏng vấn"}
              </span>
              <span className="text-xs text-ink-2">Mỗi vòng có chấm điểm dùng 1 lượt trong tuần</span>
            </p>
          </Step>

          <Step n={4} title="Cấu hình tương tác & độ khó">
            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-ink">Hình thức tương tác với AI</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard selected onClick={() => {}} title="Chat văn bản" icon={MessageSquareText}>
                  Gõ câu trả lời, phù hợp mọi môi trường.
                </ChoiceCard>
                <ChoiceCard
                  selected={false}
                  disabled={!features.voiceInterview}
                  onClick={() => {}}
                  title="Nói trực tiếp (micro)"
                  icon={Mic}
                  badge={!features.voiceInterview ? "Sắp có" : undefined}
                >
                  Mô phỏng cuộc gọi phỏng vấn bằng giọng nói.
                </ChoiceCard>
              </div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-sm font-medium text-ink">Mức độ áp lực & phản hồi đào sâu</p>
              <div role="radiogroup" aria-label="Mức độ áp lực" className="grid gap-3 sm:grid-cols-3">
                {DIFFICULTIES.map((d) => (
                  <ChoiceCard
                    key={d.value}
                    selected={difficulty === d.value}
                    onClick={() => setDifficulty(d.value)}
                    title={d.title}
                  >
                    {d.description}
                  </ChoiceCard>
                ))}
              </div>
            </div>
          </Step>

          <p className="flex items-start gap-2 rounded-xl bg-violet-soft/50 p-4 text-xs leading-5 text-ink">
            <Info className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
            AI chấm 4 thành phần (Tình huống, Nhiệm vụ, Hành động, Kết quả) cho từng câu trả lời và gửi báo cáo chi tiết
            sau khi bạn hoàn thành đủ các câu hỏi.
          </p>
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <Panel className="grid gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold">Tóm tắt cấu hình</h2>
              <Badge variant="violet">Sẵn sàng</Badge>
            </div>
            <dl className="grid gap-2 text-sm">
              <SummaryRow label="Vị trí mục tiêu" value={jd?.title ?? "—"} />
              <SummaryRow label="Cấp độ" value={LEVELS.find((l) => l.value === level)!.title} />
              <SummaryRow label="Số vòng" value={`${chosenRounds.length} vòng`} highlight />
              <SummaryRow label="Ước tính thời lượng" value={`~${minutes} phút (${questions} câu)`} />
              <SummaryRow label="Chế độ tương tác" value="Chat văn bản" />
            </dl>
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl p-3 text-xs",
                overQuota || remaining === 0 ? "bg-warn-soft text-warn" : "bg-violet-soft/60 text-violet",
              )}
            >
              <BatteryCharging className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="grid gap-0.5">
                <span className="font-semibold">
                  Hạn ngạch tuần này: đã dùng {quota.used}/{quota.limit} lượt
                </span>
                <span>
                  {overQuota
                    ? `Chỉ còn ${remaining} lượt, hãy bớt số vòng hoặc xin cố vấn thêm lượt.`
                    : `Còn ${remaining} lượt phỏng vấn có chấm điểm`}
                </span>
                <span className="text-ink-2">Làm mới {formatRelativeTime(quota.resets_at).toLowerCase()}</span>
              </span>
            </div>
            <Button
              variant="violet"
              size="brand"
              disabled={starting || chosenRounds.length === 0 || overQuota || remaining === 0}
              onClick={start}
            >
              {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Bắt đầu phỏng vấn ngay
              {!starting && <ArrowRight aria-hidden />}
            </Button>
            {remaining === 0 && (
              <p className="flex items-start gap-1.5 text-xs text-warn" role="alert">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Bạn đã dùng hết lượt tuần này. Hãy liên hệ cố vấn hoặc quản trị viên để được cấp thêm lượt.
              </p>
            )}
            <p className="flex gap-2 rounded-xl bg-blue-soft/50 p-3 text-xs leading-5 text-ink">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
              Trước khi bắt đầu: chọn nơi yên tĩnh và trình bày theo cấu trúc S-T-A-R (Tình huống → Nhiệm vụ → Hành động →
              Kết quả) để tối ưu điểm số.
            </p>
          </Panel>

          <Panel className="grid gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold">Điểm các buổi gần nhất</h2>
              <History className="size-4 text-ink-3" aria-hidden />
            </div>
            {!recent ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : recent.length === 0 ? (
              <p className="rounded-xl bg-surface p-4 text-center text-xs text-ink-2">Chưa có buổi phỏng vấn nào.</p>
            ) : (
              <ul className="grid gap-2">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3">
                    <span className="grid min-w-0">
                      <span className="truncate text-sm font-semibold text-ink">{r.title}</span>
                      <span className="truncate text-xs text-ink-2">
                        {formatRelativeTime(r.completed_at)}
                        {r.note && ` · ${r.note}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-heading text-xl font-extrabold",
                        r.total_score >= 80 ? "text-good" : r.total_score >= 70 ? "text-blue" : "text-violet",
                      )}
                    >
                      {r.total_score}
                      <span className="text-xs font-medium text-ink-3">/100</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/student/history" className="text-center text-xs font-medium text-violet hover:underline">
              Xem toàn bộ lịch sử & biểu đồ tiến bộ STAR →
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

function Step({ n, title, aside, children }: { n: number; title: string; aside?: string; children: ReactNode }) {
  return (
    <Panel className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-heading text-lg font-bold">
          <span className="grid size-7 place-items-center rounded-full bg-violet-soft text-sm text-violet">{n}</span>
          {title}
        </h2>
        {aside && <span className="text-xs text-ink-2">{aside}</span>}
      </div>
      {children}
    </Panel>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Briefcase; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      {children}
    </div>
  )
}

function ChoiceCard({
  selected,
  onClick,
  title,
  icon: Icon,
  badge,
  disabled,
  children,
}: {
  selected: boolean
  onClick: () => void
  title: string
  icon?: typeof Mic
  badge?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid gap-1 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-violet bg-violet-soft/40 ring-2 ring-violet/15" : "border-line enabled:hover:border-violet/40",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-heading text-sm font-bold text-ink">
          {Icon && <Icon className="size-4 text-violet" aria-hidden />}
          {title}
        </span>
        {badge ? (
          <Badge variant="neutral">{badge}</Badge>
        ) : (
          <span
            aria-hidden
            className={cn(
              "grid size-4 place-items-center rounded-full border-2",
              selected ? "border-violet" : "border-ink-3",
            )}
          >
            {selected && <span className="size-2 rounded-full bg-violet" />}
          </span>
        )}
      </span>
      <span className="text-xs leading-5 text-ink-2">{children}</span>
    </button>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn("text-right font-semibold", highlight ? "text-violet" : "text-ink")}>{value}</dd>
    </div>
  )
}
