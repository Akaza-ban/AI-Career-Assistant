"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState, type ReactNode } from "react"
import { AlertCircle, ChevronRight, CircleHelp, FileText, Heart, Library, Loader2 } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"
import { MatchBadge } from "@/components/common/match-badge"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone, ZoneLink } from "@/components/common/zone"
import { useRecommendations } from "@/components/student/library/library-data"
import { InterviewIntro, InterviewTour, interviewIntroHidden } from "@/components/student/interview/interview-tour"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { QUESTION_COUNT, SECONDS_PER_QUESTION } from "@/lib/interview"
import type { CvVersion, InterviewQuota, JobDescription, MatchLabel, StudentOverview } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const MINUTES = (QUESTION_COUNT * SECONDS_PER_QUESTION) / 60

/** "08/10" */
const shortDate = (iso: string) => formatDate(iso).slice(0, 5)

/** Điểm phỏng vấn luôn một chữ số thập phân: "3,8 / 5" (DESIGN.md 8.1). */
const score1 = (n: number) => n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Source = "suggested" | "analyzed"

interface PickRow {
  jd: JobDescription
  /** Gợi ý theo CV: chỉ hiện nhãn mức phù hợp, không hiện điểm (DESIGN.md 8.1). */
  match?: MatchLabel | null
  saved?: boolean
  /** Lượt phân tích gần nhất với vị trí này: điểm % + nhãn. */
  analysis?: { score: number | null; label: MatchLabel | null; at: string }
}

// Bản vẽ "Thiết lập phỏng vấn" (WIREFRAMES A12). PRD US-SV-04, S5.
// Chọn một vị trí (gợi ý theo CV + đã lưu, hoặc vị trí đã phân tích) và CV, tóm tắt buổi ở thẻ dính bên phải.
// Cách phòng hoạt động nằm trong hướng dẫn từng bước: popup giới thiệu hiện mỗi lần vào trang (trừ khi SV tick
// "Không hiển thị lại"), nút "Hướng dẫn" mở thẳng hướng dẫn.
export function InterviewSetup({ initialJdId, initialCvId }: { initialJdId: string | null; initialCvId: string | null }) {
  const router = useRouter()
  const { data: jds, error: jdsError, reload: reloadJds } = useApi(api.listInterviewJds)
  const { data: cvs, error: cvsError, reload: reloadCvs } = useApi(api.listCvVersions)
  const { data: overview } = useApi(api.getOverview)
  const { data: savedList } = useApi(api.listSavedJds)

  const [jdId, setJdId] = useState<string | null>(initialJdId)
  const [cvId, setCvId] = useState<string | null>(initialCvId)
  const [source, setSource] = useState<Source | null>(null)
  const [starting, setStarting] = useState(false)
  const [introOpen, setIntroOpen] = useState(() => !interviewIntroHidden())
  const [tourOpen, setTourOpen] = useState(false)

  const activeCv = cvs?.find((cv) => cv.id === cvId) ?? cvs?.find((cv) => cv.is_active) ?? cvs?.[0]
  const recs = useRecommendations(activeCv?.status === "ready" ? activeCv.id : null, false)

  const byId = useMemo(() => new Map((jds ?? []).map((j) => [j.id, j])), [jds])

  // Gợi ý theo CV (theo thứ tự mức phù hợp) rồi tới vị trí đã lưu chưa có trong gợi ý.
  const suggested = useMemo<PickRow[]>(() => {
    const saved = new Set((savedList ?? []).map((s) => s.jd_id))
    const rows: PickRow[] = []
    for (const r of recs.data?.recommendations ?? []) {
      const jd = byId.get(r.jd_id)
      if (jd) rows.push({ jd, match: r.match_label, saved: saved.has(jd.id) })
    }
    for (const s of savedList ?? []) {
      const jd = byId.get(s.jd_id)
      if (jd && !rows.some((row) => row.jd.id === jd.id)) rows.push({ jd, saved: true })
    }
    return rows
  }, [recs.data, savedList, byId])

  // Mỗi vị trí một dòng, lấy lượt phân tích hoàn thành gần nhất.
  const analyzed = useMemo<PickRow[]>(() => {
    const rows: PickRow[] = []
    for (const a of overview?.recent_analyses ?? []) {
      const jd = byId.get(a.jd.id)
      if (!jd || a.status !== "completed" || rows.some((row) => row.jd.id === jd.id)) continue
      rows.push({ jd, analysis: { score: a.match_score, label: a.match_label, at: a.completed_at ?? a.created_at } })
    }
    return rows
  }, [overview, byId])

  // Vị trí điền sẵn (?jd=), rồi vị trí của lần phân tích gần nhất với CV này, rồi gợi ý đầu tiên.
  const jd = useMemo(() => {
    if (!jds?.length) return undefined
    return (
      byId.get(jdId ?? "") ??
      jds.find((j) => j.title === activeCv?.target_title) ??
      suggested[0]?.jd ??
      analyzed[0]?.jd ??
      jds[0]
    )
  }, [jds, byId, jdId, activeCv, suggested, analyzed])

  // Tab mặc định: tab có chứa vị trí đang chọn.
  const tab: Source =
    source ?? (jd && !suggested.some((r) => r.jd.id === jd.id) && analyzed.some((r) => r.jd.id === jd.id) ? "analyzed" : "suggested")
  const listLoading = tab === "suggested" ? !savedList || recs.loading : !overview
  const baseRows = tab === "suggested" ? suggested : analyzed
  // Vị trí đang chọn không thuộc danh sách nào (ví dụ mở từ Thư viện JD): hiện ở đầu tab gợi ý để SV thấy mình đã chọn gì.
  const orphan = jd && ![...suggested, ...analyzed].some((r) => r.jd.id === jd.id)
  const rows = jd && orphan && tab === "suggested" && !listLoading ? [{ jd }, ...baseRows] : baseRows

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

  const header = (
    <PageHeader
      title="Luyện phỏng vấn"
      description={`Chọn CV và vị trí. AI sẽ hỏi ${QUESTION_COUNT} câu và chấm theo khung STAR.`}
      actions={
        <>
          <Button
            variant="ghost"
            size="brand"
            className="glass text-ink shadow-xs hover:bg-card"
            onClick={() => setTourOpen(true)}
          >
            <CircleHelp aria-hidden />
            Hướng dẫn
          </Button>
          {jds && cvs && cvs.length > 0 && <QuotaPill quota={quota} />}
        </>
      }
    />
  )

  if (jdsError || cvsError) {
    return (
      <div className="grid gap-10">
        {header}
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={AlertCircle}
            title="Không tải được dữ liệu luyện phỏng vấn"
            description={(jdsError ?? cvsError)?.message}
            action={
              <Button
                size="brand"
                onClick={() => {
                  reloadJds()
                  reloadCvs()
                }}
              >
                Thử lại
              </Button>
            }
          />
        </Panel>
      </div>
    )
  }

  if (!jds || !cvs) {
    return (
      <div className="grid gap-10" aria-busy="true" aria-label="Đang tải">
        {header}
        <div className="flex flex-wrap items-start gap-14">
          <div className="grid min-w-0 flex-[999_1_460px] gap-3">
            <Skeleton className="h-10 w-56 rounded-lg" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[300px] max-w-[400px] min-w-0 flex-[1_1_340px] rounded-card" />
        </div>
      </div>
    )
  }

  if (cvs.length === 0) {
    return (
      <div className="grid gap-10">
        {header}
        <Panel className="mx-auto w-full max-w-lg p-0">
          <EmptyState
            icon={FileText}
            title="Bạn cần tải CV lên trước khi luyện phỏng vấn"
            description="AI dựa vào vị trí ứng tuyển và kinh nghiệm trong CV để đánh giá câu trả lời."
            action={
              <Button size="brand" nativeButton={false} render={<Link href="/student/cv" />}>
                Đến CV của tôi
              </Button>
            }
          />
        </Panel>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-[72px]">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:gap-11">
        {header}

        <div className="flex flex-wrap items-start gap-x-14 gap-y-12">
          <div data-tour="setup" className="grid min-w-0 flex-[999_1_460px] gap-12 md:gap-14">
            <Zone id="cv-pick-title" title="Chọn CV">
              <CvPicker cvs={cvs} value={activeCv} onChange={setCvId} />
            </Zone>
            <Zone
              id="pick-position-title"
              title="Chọn vị trí"
              aside={
                <SegmentedControl<Source>
                  aria-label="Nguồn vị trí"
                  size="sm"
                  value={tab}
                  onChange={setSource}
                  options={[
                    { value: "suggested", label: "Gợi ý & đã lưu" },
                    { value: "analyzed", label: "Đã phân tích" },
                  ]}
                />
              }
              className="[&>div:last-child]:pt-3.5"
            >
              <div className="min-w-0">
                {listLoading ? (
                  <div className="grid gap-2" aria-busy="true" aria-label="Đang tải danh sách vị trí">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-[58px] rounded-xl" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={Library}
                    title={tab === "suggested" ? "Chưa có gợi ý hay vị trí đã lưu" : "Bạn chưa phân tích vị trí nào"}
                    description={
                      tab === "suggested"
                        ? "Tìm vị trí trong Thư viện JD rồi lưu lại để luyện phỏng vấn."
                        : "Phân tích CV với một JD để luyện phỏng vấn đúng vị trí đó."
                    }
                  />
                ) : (
                  <div role="radiogroup" aria-labelledby="pick-position-title">
                    {rows.map((row, i) => (
                      <PositionRow key={row.jd.id} row={row} first={i === 0} checked={row.jd.id === jd?.id} onPick={setJdId} />
                    ))}
                  </div>
                )}
                <div className="mt-3.5">
                  <ZoneLink href="/student/library">Tìm trong Thư viện JD</ZoneLink>
                </div>
              </div>
            </Zone>
          </div>

          <SessionCard
            jd={jd}
            cv={activeCv}
            quota={quota}
            starting={starting}
            onStart={start}
          />
        </div>
      </div>

      <RecentSessions overview={overview} />

      <InterviewIntro open={introOpen} onClose={() => setIntroOpen(false)} onStartTour={() => setTourOpen(true)} />
      <InterviewTour open={tourOpen} onClose={() => setTourOpen(false)} weeklyLimit={quota?.limit ?? 3} />
    </div>
  )
}

// ---------- Hạn mức tuần ----------

/** "●●○ Còn 1 / 3 buổi tuần này": chấm đậm là buổi đã dùng của vị trí đang chọn. */
function QuotaPill({ quota }: { quota: InterviewQuota | undefined }) {
  if (!quota) return <Skeleton className="h-[46px] w-56 rounded-full" />
  return (
    <span
      className={cn(
        "glass inline-flex min-h-[46px] items-center gap-2.5 rounded-full px-5 text-sm font-medium shadow-xs",
        quota.remaining === 0 ? "text-warn" : "text-ink",
      )}
      title={`Cho vị trí đang chọn · làm mới ngày ${formatDate(quota.resets_at)}`}
    >
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: quota.limit }, (_, i) => (
          <i key={i} className={cn("size-2 rounded-full", i < quota.used ? "bg-blue" : "bg-line-strong")} />
        ))}
      </span>
      <span className="tabular-nums">
        Còn {quota.remaining} / {quota.limit} buổi tuần này
      </span>
    </span>
  )
}

// ---------- Chọn vị trí ----------

function PositionRow({
  row,
  first,
  checked,
  onPick,
}: {
  row: PickRow
  first: boolean
  checked: boolean
  onPick: (id: string) => void
}) {
  const { jd, match, saved, analysis } = row
  return (
    <>
      {!first && <div className="h-px bg-line" aria-hidden />}
      <label
        className={cn(
          "-mx-3.5 flex cursor-pointer items-center gap-3.5 rounded-xl p-3.5 transition-[background-color,box-shadow] duration-150 hover:bg-panel",
          "has-[:checked]:bg-panel has-[:checked]:shadow-[inset_0_0_0_1.5px_var(--ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue",
        )}
      >
        <input
          type="radio"
          name="interview-position"
          value={jd.id}
          checked={checked}
          onChange={() => onPick(jd.id)}
          className="grid size-[18px] shrink-0 appearance-none rounded-full border-[1.5px] border-line-strong bg-card outline-none checked:border-ink checked:bg-[radial-gradient(circle,var(--ink)_0_4px,var(--card)_4.5px)]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{jd.title}</span>
          <span className="block truncate text-sm text-ink-3">
            {[jd.company, jd.source === "pasted" ? "JD tự dán" : null].filter(Boolean).join(" · ") || "Không rõ công ty"}
          </span>
        </span>
        {match ? (
          <MatchBadge label={match} />
        ) : analysis ? (
          <span className="flex shrink-0 items-center gap-2">
            {analysis.score !== null && (
              <span className="text-sm font-semibold text-ink tabular-nums">{Math.round(analysis.score)}%</span>
            )}
            {analysis.label && <MatchBadge label={analysis.label} className="hidden sm:inline-flex" />}
          </span>
        ) : saved ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-blue">
            <Heart className="size-4 fill-current" aria-hidden />
            Đã lưu
          </span>
        ) : null}
      </label>
    </>
  )
}

// ---------- Chọn CV ----------

function CvPicker({ cvs, value, onChange }: { cvs: CvVersion[]; value: CvVersion | undefined; onChange: (id: string) => void }) {
  const items = cvs.map((cv) => ({ value: cv.id, label: `${cv.file_name} · ${cv.label}` }))
  return (
    <div>
      <Select items={items} value={value?.id ?? null} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger
          aria-labelledby="cv-pick-title"
          className="h-11 w-full max-w-[420px] min-w-0 rounded-[10px] border-line-strong bg-card px-3.5 text-[15px] font-medium text-ink"
        >
          <SelectValue className="min-w-0 truncate">
            {() =>
              value ? (
                <span className="flex min-w-0 items-center gap-3">
                  <span className="min-w-0 truncate">{value.file_name}</span>
                  <span className="shrink-0 text-[13px] font-normal text-ink-3">sửa {shortDate(value.uploaded_at)}</span>
                </span>
              ) : (
                "Chọn CV"
              )
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {cvs.map((cv) => (
            <SelectItem key={cv.id} value={cv.id}>
              <span className="grid">
                <span className="font-medium">{cv.file_name}</span>
                <span className="text-xs text-ink-3">
                  {cv.label} · sửa {shortDate(cv.uploaded_at)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ---------- Thẻ tóm tắt buổi ----------

interface SessionCardProps {
  jd: JobDescription | undefined
  cv: CvVersion | undefined
  quota: InterviewQuota | undefined
  starting: boolean
  onStart: () => void
}

function SessionCard({ jd, cv, quota, starting, onStart }: SessionCardProps) {
  const exhausted = quota !== undefined && quota.remaining === 0
  const rows: [string, string][] = [
    ["Vị trí", jd?.title ?? "—"],
    ["CV", cv?.file_name ?? "—"],
    ["Số câu", `${QUESTION_COUNT} câu · khoảng ${MINUTES} phút`],
    ["Chấm điểm", "Theo STAR, thang 5"],
  ]
  return (
    <aside
      data-tour="summary"
      aria-labelledby="session-card-title"
      className="w-full max-w-[400px] min-w-0 flex-[1_1_340px] rounded-card bg-card p-6 shadow-[var(--shadow-card),0_0_0_1px_var(--line)] lg:sticky lg:top-24"
    >
      <h3 id="session-card-title" className="text-base font-semibold text-ink">
        Buổi phỏng vấn của bạn
      </h3>
      <dl className="mt-3.5 grid grid-cols-[auto_minmax(0,1fr)] text-sm">
        {rows.map(([label, value], i) => (
          <div key={label} className="contents">
            <dt className={cn("py-[11px] pr-4 text-ink-3", i < rows.length - 1 && "border-b border-line")}>{label}</dt>
            <dd
              className={cn("truncate py-[11px] text-right font-medium text-ink", i < rows.length - 1 && "border-b border-line")}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <Button
        size="brand"
        className="mt-[18px] w-full"
        disabled={starting || !jd || !cv || !quota || exhausted}
        onClick={onStart}
      >
        {starting && <Loader2 className="animate-spin" aria-hidden />}
        Vào phòng chờ
        {!starting && <ChevronRight aria-hidden />}
      </Button>
      {exhausted && (
        <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-5 text-warn" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Bạn đã dùng hết lượt cho vị trí này trong tuần. Chọn vị trí khác hoặc quay lại sau ngày{" "}
          {formatDate(quota.resets_at)}.
        </p>
      )}
    </aside>
  )
}

// ---------- Buổi gần đây ----------

function RecentSessions({ overview }: { overview: StudentOverview | undefined }) {
  const active = overview?.in_progress.interview ?? null
  const done = overview?.recent_interviews ?? []

  return (
    <Zone
      id="recent-sessions-title"
      title="Buổi gần đây"
      aside={<ZoneLink href="/student/history">Xem lịch sử</ZoneLink>}
      className="[&>div:last-child]:pt-2"
    >
      {!overview ? (
        <div className="grid gap-2 pt-2" aria-busy="true" aria-label="Đang tải buổi gần đây">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : !active && done.length === 0 ? (
        <p className="py-6 text-sm text-ink-3">Chưa có buổi nào. Buổi đã hoàn thành sẽ hiện ở đây kèm báo cáo.</p>
      ) : (
        <ul>
          {active && (
            <SessionRow
              href={`/student/interview/${encodeURIComponent(active.id)}`}
              title={active.jd.title}
              middle={
                <Badge variant="blue" className="h-[22px] px-2">
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                  {active.paused ? "Dừng ở" : "Đang dở"} câu {active.current_index} / {active.question_count}
                </Badge>
              }
              date="Đang làm"
              action="Tiếp tục"
            />
          )}
          {done.map((s) => (
            <SessionRow
              key={s.id}
              href={`/student/interview/${encodeURIComponent(s.id)}/report`}
              title={s.jd.title}
              middle={<span className="font-semibold text-ink tabular-nums">{score1(s.overall_score)} / 5</span>}
              date={shortDate(s.completed_at)}
              action="Báo cáo"
            />
          ))}
        </ul>
      )}
    </Zone>
  )
}

function SessionRow({
  href,
  title,
  middle,
  date,
  action,
}: {
  href: string
  title: string
  middle: ReactNode
  date: string
  action: string
}) {
  return (
    <li className="border-b border-line">
      <Link
        href={href}
        className="-mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-3.5 text-ink transition-colors hover:bg-panel sm:gap-4"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        <span className="shrink-0">{middle}</span>
        <span className="hidden w-[90px] shrink-0 text-sm text-ink-3 sm:block">{date}</span>
        <span className="w-16 shrink-0 text-right text-sm font-semibold text-blue sm:w-20">{action}</span>
      </Link>
    </li>
  )
}
