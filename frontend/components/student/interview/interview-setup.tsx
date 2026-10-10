"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Briefcase,
  CircleHelp,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { Panel, SectionHeader } from "@/components/common/panel"
import { InterviewIntro, InterviewTour, interviewIntroHidden } from "@/components/student/interview/interview-tour"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { QUESTION_COUNT, SECONDS_PER_QUESTION } from "@/lib/interview"
import { useApi } from "@/lib/use-api"
import { useAgentActions } from "@/lib/use-agent-actions"
import { cn } from "@/lib/utils"

const MINUTES = (QUESTION_COUNT * SECONDS_PER_QUESTION) / 60

// Figma: frame "Thiết lập phỏng vấn" (18:3078). PRD US-SV-04, S5.
// Trang chỉ giữ phần chọn vị trí & CV và tóm tắt (xếp chồng, trải hết bề ngang khung tập trung). Cách phòng hoạt
// động (chủ đề câu hỏi, đồng hồ, khung STAR, lượt) nằm trong hướng dẫn từng bước: popup giới thiệu hiện mỗi lần vào
// trang (trừ khi SV tick "Không hiển thị lại"), nút "Hướng dẫn" mở thẳng hướng dẫn từng bước.
export function InterviewSetup({ initialJdId, initialCvId }: { initialJdId: string | null; initialCvId: string | null }) {
  const router = useRouter()
  const { data: jds } = useApi(api.listInterviewJds)
  const { data: cvs } = useApi(api.listCvVersions)

  const [jdId, setJdId] = useState<string | null>(initialJdId)
  const [cvId, setCvId] = useState<string | null>(initialCvId)
  const [starting, setStarting] = useState(false)
  const [introOpen, setIntroOpen] = useState(() => !interviewIntroHidden())
  const [tourOpen, setTourOpen] = useState(false)

  useAgentActions({
    resetView: ({ clear_filters, close_modals }) => {
      if (clear_filters) { setJdId(initialJdId); setCvId(initialCvId) }
      if (close_modals) { setIntroOpen(false); setTourOpen(false) }
    },
  })

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

  // Vào phòng chờ: xem luật rồi bấm "Sẵn sàng" mới tạo buổi (đồng hồ câu 1 chạy ngay khi tạo buổi).
  function start() {
    if (!jd || !activeCv || exhausted) return
    setStarting(true)
    router.push(`/student/interview/start?jd=${encodeURIComponent(jd.id)}&cv=${encodeURIComponent(activeCv.id)}`)
  }

  if (!jds || !cvs) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-24 rounded-[20px]" />
        <Skeleton className="h-[180px] rounded-[20px]" />
        <Skeleton className="h-[200px] rounded-[20px]" />
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
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Badge variant="violet" className="h-auto px-2.5 py-1">
            <Sparkles aria-hidden />
            Mô phỏng AI STAR • {QUESTION_COUNT} câu hỏi
          </Badge>
          <h1 className="font-heading text-[32px] leading-10 font-extrabold">Thiết lập phiên phỏng vấn thử</h1>
          <p className="max-w-2xl text-ink-2">
            Chọn vị trí và CV, rồi trả lời {QUESTION_COUNT} câu hỏi hành vi như một buổi phỏng vấn thật.
          </p>
        </div>
        <Button variant="soft" className="h-10 px-4" onClick={() => setTourOpen(true)}>
          <CircleHelp aria-hidden />
          Hướng dẫn
        </Button>
      </div>

      {/* Tiêu đề mục đặt ngoài ô như trang Tổng quan; data-tour bọc cả tiêu đề để hướng dẫn làm nổi bật cả mục */}
      <section data-tour="setup" className="grid gap-3">
        <SectionHeader title="Chọn vị trí & CV" />
        <Panel className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vị trí ứng tuyển" icon={Briefcase}>
              <Select items={jdItems} value={jd?.id ?? null} onValueChange={(v) => setJdId(String(v))}>
                <SelectTrigger data-agent-target="select-jd" className="h-10 w-full min-w-0 bg-surface" aria-label="Vị trí ứng tuyển">
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
                <SelectTrigger data-agent-target="select-cv" className="h-10 w-full min-w-0 bg-surface" aria-label="CV dùng làm bối cảnh">
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
        </Panel>
      </section>

      <section data-tour="summary" className="grid gap-3">
        <SectionHeader title="Tóm tắt buổi phỏng vấn" />
        <Panel className="grid gap-5 p-6">
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid min-w-0 gap-4">
              {/* Cột CV rộng hơn để đủ chỗ cho tên file */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)]">
                <SummaryStat label="Vị trí" value={jd?.title ?? "—"} />
                <SummaryStat
                  label="CV"
                  value={activeCv?.file_name ?? "—"}
                  sub={activeCv ? `Phiên bản ${activeCv.label}` : undefined}
                />
                <SummaryStat label="Số câu hỏi" value={`${QUESTION_COUNT} câu`} highlight />
                <SummaryStat label="Thời lượng" value={`Khoảng ${MINUTES} phút`} />
              </dl>
              <div className="flex flex-wrap gap-2 text-xs">
                {!quota ? (
                  <Skeleton className="h-8 w-72 rounded-lg" />
                ) : (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2",
                      exhausted ? "bg-warn-soft text-warn" : "bg-violet-soft/60 text-violet",
                    )}
                  >
                    <BatteryCharging className="size-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-semibold">
                        Còn {quota.remaining}/{quota.limit} buổi cho vị trí này trong tuần
                      </strong>
                      <span className="text-ink-2"> · làm mới ngày {formatDate(quota.resets_at)}</span>
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5 rounded-lg bg-blue-soft/50 px-3 py-2 text-ink">
                  <ShieldCheck className="size-4 shrink-0 text-blue" aria-hidden />
                  Luyện tập, không tính điểm chính thức. Hãy trả lời bằng trải nghiệm thật.
                </span>
              </div>
            </div>
            <div className="grid gap-2 lg:w-72">
              <Button data-agent-target="btn-start-interview" variant="violet" size="brand" disabled={starting || !jd || !activeCv || !quota || exhausted} onClick={start}>
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
            </div>
          </div>
        </Panel>
      </section>

      <InterviewIntro open={introOpen} onClose={() => setIntroOpen(false)} onStartTour={() => setTourOpen(true)} />
      <InterviewTour open={tourOpen} onClose={() => setTourOpen(false)} weeklyLimit={quota?.limit ?? 3} />
    </div>
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

interface SummaryStatProps {
  label: string
  value: string
  /** Dòng phụ dưới giá trị, ví dụ phiên bản của CV. */
  sub?: string
  highlight?: boolean
}

function SummaryStat({ label, value, sub, highlight }: SummaryStatProps) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="grid min-w-0">
        <span className={cn("truncate font-heading text-base font-bold", highlight ? "text-violet" : "text-ink")} title={value}>
          {value}
        </span>
        {sub && <span className="text-xs text-ink-2">{sub}</span>}
      </dd>
    </div>
  )
}
