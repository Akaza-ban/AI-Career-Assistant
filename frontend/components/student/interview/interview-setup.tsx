"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Briefcase,
  Clock,
  FileText,
  History,
  Info,
  ListChecks,
  Loader2,
  Pause,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import { formatDate, formatRelativeTime } from "@/lib/format"
import {
  LABEL_META,
  MIN_ANSWER_CHARS,
  PAUSE_MAX_SECONDS,
  QUESTION_COUNT,
  QUESTION_THEMES,
  RUBRIC_SCALE,
  SECONDS_PER_QUESTION,
  STAR_META,
  STAR_ORDER,
  formatScore,
  labelOf,
} from "@/lib/interview"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const MINUTES = (QUESTION_COUNT * SECONDS_PER_QUESTION) / 60

// Figma: frame "Thiết lập phỏng vấn" (18:3078). PRD US-SV-04, S5.
export function InterviewSetup({ initialJdId }: { initialJdId: string | null }) {
  const router = useRouter()
  const { data: jds } = useApi(api.listInterviewJds)
  const { data: cvs } = useApi(api.listCvVersions)
  const { data: recent } = useApi(api.listRecentInterviews)

  const [jdId, setJdId] = useState<string | null>(initialJdId)
  const [cvId, setCvId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const activeCv = cvs?.find((cv) => cv.id === cvId) ?? cvs?.find((cv) => cv.is_active) ?? cvs?.[0]
  // Vị trí điền sẵn từ trang kết quả phân tích (?jd=), nếu không thì vị trí đang gắn với CV, cuối cùng là mục đầu.
  const jd = useMemo(() => {
    if (!jds?.length) return undefined
    return jds.find((j) => j.id === jdId) ?? jds.find((j) => j.title === activeCv?.target_title) ?? jds[0]
  }, [jds, jdId, activeCv])

  const jdKey = jd?.id ?? ""
  const fetchQuota = useCallback(() => api.getQuota(jdKey), [jdKey])
  const { data: quota } = useApi(fetchQuota)
  const exhausted = quota !== undefined && quota.remaining === 0

  async function start() {
    if (!jd || !activeCv || exhausted) return
    setStarting(true)
    try {
      const session = await api.createInterview({ jd_id: jd.id, cv_version_id: activeCv.id })
      router.push(`/student/interview/${encodeURIComponent(session.id)}`)
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof Error ? err.message : "Không bắt đầu được phỏng vấn.")
      setStarting(false)
    }
  }

  if (!jds || !cvs) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-24 rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[720px] rounded-[20px]" />
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
        <p className="max-w-md text-sm text-ink-2">AI dựa vào vị trí ứng tuyển và kinh nghiệm trong CV để đánh giá câu trả lời.</p>
        <Button nativeButton={false} render={<Link href="/student/cv" />}>
          Đến CV của tôi
        </Button>
      </Panel>
    )
  }

  const jdItems = jds.map((j) => ({
    value: j.id,
    label: `${j.title}${j.company ? ` – ${j.company}` : ""}${j.source === "pasted" ? " (JD tự dán)" : ""}`,
  }))
  const cvItems = cvs.map((cv) => ({ value: cv.id, label: `${cv.file_name} (${cv.label})` }))

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="violet" className="h-auto px-2.5 py-1">
          <Sparkles aria-hidden />
          Mô phỏng AI STAR • {QUESTION_COUNT} câu hỏi
        </Badge>
        <h1 className="font-heading text-[32px] leading-10 font-extrabold">Thiết lập phiên phỏng vấn thử</h1>
        <p className="max-w-2xl text-ink-2">
          Chọn vị trí và CV, rồi trả lời {QUESTION_COUNT} câu hỏi hành vi như một buổi phỏng vấn thật. Mỗi câu trả lời được
          chấm theo khung STAR, thang 0–5.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-5">
          <Step n={1} title="Chọn vị trí & CV">
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
              <Field label="CV dùng làm bối cảnh" icon={FileText}>
                <Select items={cvItems} value={activeCv?.id ?? null} onValueChange={(v) => setCvId(String(v))}>
                  <SelectTrigger className="h-10 w-full min-w-0 bg-surface" aria-label="CV dùng làm bối cảnh">
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
            {jd && jd.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {jd.skills.map((s) => (
                  <span key={s.name} className="rounded-md bg-surface px-2 py-0.5 text-xs text-ink-2 ring-1 ring-line">
                    {s.name}
                  </span>
                ))}
              </div>
            )}
          </Step>

          <Step n={2} title="Buổi phỏng vấn diễn ra thế nào" aside={`${QUESTION_COUNT} câu · khoảng ${MINUTES} phút`}>
            <ol className="grid gap-2 sm:grid-cols-2">
              {QUESTION_THEMES.map((theme, i) => (
                <li key={theme} className="flex items-center gap-3 rounded-xl bg-surface p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-soft text-xs font-bold text-violet">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-ink">{theme}</span>
                </li>
              ))}
            </ol>
            <ul className="grid gap-2 text-sm text-ink">
              <Rule icon={Timer}>
                Mỗi câu có <strong>{SECONDS_PER_QUESTION / 60} phút</strong> đếm ngược, như người phỏng vấn không chờ mãi. Hết
                giờ, phần bạn đang gõ được tự nộp; nếu chưa đủ {MIN_ANSWER_CHARS} ký tự thì câu đó được 0 điểm.
              </Rule>
              <Rule icon={Pause}>Được tạm dừng 1 lần, tối đa {PAUSE_MAX_SECONDS} giây, sau đó đồng hồ tự chạy lại.</Rule>
              <Rule icon={ListChecks}>
                Sau mỗi câu, bạn thấy ngay điểm 4 tiêu chí S/T/A/R và nhận xét ngắn. Báo cáo đầy đủ có sau câu cuối.
              </Rule>
              <Rule icon={AlertCircle}>
                Kết thúc sớm hoặc rời phòng giữa chừng thì buổi <strong>không được lưu</strong> và không tính lượt.
              </Rule>
            </ul>
          </Step>

          <Step n={3} title="Khung STAR & thang điểm 0–5">
            <div className="grid gap-2 sm:grid-cols-2">
              {STAR_ORDER.map((key) => (
                <div key={key} className="flex gap-3 rounded-xl border border-line p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-soft font-heading font-bold text-blue">
                    {STAR_META[key].letter}
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-sm font-semibold text-ink">{STAR_META[key].label}</span>
                    <span className="text-xs leading-5 text-ink-2">{STAR_META[key].hint}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <p className="text-xs font-semibold text-ink-2">Mỗi tiêu chí chấm từ 0 đến 5:</p>
              <ul className="grid gap-1 text-xs sm:grid-cols-2">
                {RUBRIC_SCALE.map((r) => (
                  <li key={r.score} className="flex items-center gap-2 text-ink">
                    <span className="grid size-5 shrink-0 place-items-center rounded bg-surface font-semibold">{r.score}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            </div>
          </Step>
        </div>

        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <Panel className="grid gap-4 p-5">
            <h2 className="font-heading text-lg font-bold">Tóm tắt buổi phỏng vấn</h2>
            <dl className="grid gap-2 text-sm">
              <SummaryRow label="Vị trí" value={jd?.title ?? "—"} />
              <SummaryRow label="CV" value={activeCv ? `${activeCv.label}` : "—"} />
              <SummaryRow label="Số câu hỏi" value={`${QUESTION_COUNT} câu`} highlight />
              <SummaryRow label="Thời lượng" value={`Khoảng ${MINUTES} phút`} />
            </dl>

            {!quota ? (
              <Skeleton className="h-16 rounded-xl" />
            ) : (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl p-3 text-xs",
                  exhausted ? "bg-warn-soft text-warn" : "bg-violet-soft/60 text-violet",
                )}
              >
                <BatteryCharging className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="grid gap-0.5">
                  <span className="font-semibold">
                    Còn {quota.remaining}/{quota.limit} buổi cho vị trí này trong tuần
                  </span>
                  <span className="text-ink-2">Chỉ buổi hoàn thành đủ {QUESTION_COUNT} câu mới tính lượt.</span>
                  <span className="text-ink-2">Làm mới ngày {formatDate(quota.resets_at)}</span>
                </span>
              </div>
            )}

            <Button variant="violet" size="brand" disabled={starting || !jd || !activeCv || !quota || exhausted} onClick={start}>
              {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Bắt đầu phỏng vấn
              {!starting && <ArrowRight aria-hidden />}
            </Button>
            {exhausted && (
              <p className="flex items-start gap-1.5 text-xs text-warn" role="alert">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Bạn đã dùng hết lượt cho vị trí này trong tuần. Hãy chọn vị trí khác hoặc quay lại sau ngày làm mới.
              </p>
            )}
            <p className="flex gap-2 rounded-xl bg-blue-soft/50 p-3 text-xs leading-5 text-ink">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue" aria-hidden />
              Đây là luyện tập, không tính điểm chính thức. Hãy trả lời bằng trải nghiệm thật của bạn.
            </p>
          </Panel>

          <Panel className="grid gap-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold">Các buổi gần nhất</h2>
              <History className="size-4 text-ink-3" aria-hidden />
            </div>
            {!recent ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : recent.length === 0 ? (
              <p className="rounded-xl bg-surface p-4 text-center text-xs text-ink-2">Chưa có buổi phỏng vấn nào.</p>
            ) : (
              <ul className="grid gap-2">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/student/interview/${encodeURIComponent(r.id)}/report`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 hover:bg-blue-soft/50"
                    >
                      <span className="grid min-w-0">
                        <span className="truncate text-sm font-semibold text-ink">{r.jd.title}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-ink-2">
                          <Clock className="size-3 shrink-0" aria-hidden />
                          {formatRelativeTime(r.completed_at)}
                        </span>
                      </span>
                      <span className={cn("font-heading text-xl font-extrabold", LABEL_META[labelOf(r.overall_score)].className)}>
                        {formatScore(r.overall_score)}
                        <span className="text-xs font-medium text-ink-3">/5</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="flex items-start gap-2 px-1 text-xs leading-5 text-ink-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Hạn mức: {quota?.limit ?? 3} buổi có chấm điểm cho mỗi vị trí mỗi tuần (tính từ thứ Hai).
          </p>
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

function Rule({ icon: Icon, children }: { icon: typeof Timer; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 leading-6">
      <Icon className="mt-1 size-4 shrink-0 text-violet" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn("truncate text-right font-semibold", highlight ? "text-violet" : "text-ink")}>{value}</dd>
    </div>
  )
}
