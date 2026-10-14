"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, ChevronRight, Clock, Columns3, Loader2, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { FeedbackWidget } from "@/components/FeedbackWidget"
import { AiProgress } from "@/components/common/ai-progress"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { CompareComments, CompareScores, CompareSkills } from "@/components/student/analysis/compare-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatDate, formatTime } from "@/lib/format"
import { COMPARE_MAX_JDS, COMPARE_MIN_JDS, type CompareJdsResponse } from "@/lib/types"
import { useApi } from "@/lib/use-api"

const STEPS = ["Đọc CV", "Đối chiếu từng vị trí", "Tìm kỹ năng thiếu chung", "Viết nhận xét"]
const STEP_MS = 1400
/** Sau mốc này đổi câu chữ "lâu hơn bình thường" (DESIGN.md mục 9). */
const SLOW_MS = 15_000

// So sánh tốn một lượt LLM: giữ kết quả theo (CV, danh sách JD) trong phiên để tải lại trang không phải chạy lại.
const cacheKey = (cvId: string, jdIds: string[]) => `careerx:compare:${cvId}:${jdIds.join(",")}`

function readCache(key: string): CompareJdsResponse | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as CompareJdsResponse) : null
  } catch {
    return null
  }
}

function clearCache(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Không xoá được thì trang So sánh dùng lại kết quả cũ trong phiên.
  }
}

function writeCache(key: string, data: CompareJdsResponse) {
  try {
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch {
    // Không lưu được (chế độ riêng tư, hết dung lượng): lần sau chạy lại.
  }
}

type State = { status: "running" } | { status: "done"; data: CompareJdsResponse } | { status: "error"; error: Error }

/** Kết quả so sánh 2–3 vị trí (WIREFRAMES A6, bản vẽ SoSanh). Đọc ?cv=<id>&jd=<id>,<id>[,<id>]. */
export function CompareResult({ cvId, jdIds }: { cvId: string | null; jdIds: string[] }) {
  const ids = [...new Set(jdIds)]
  const valid = cvId !== null && ids.length >= COMPARE_MIN_JDS && ids.length <= COMPARE_MAX_JDS
  if (!valid) return <MissingSelection cvId={cvId} />
  return <CompareRun key={cacheKey(cvId, ids)} cvId={cvId} jdIds={ids} />
}

function CompareRun({ cvId, jdIds }: { cvId: string; jdIds: string[] }) {
  const [state, setState] = useState<State>({ status: "running" })
  const [attempt, setAttempt] = useState(0)
  const key = cacheKey(cvId, jdIds)

  useEffect(() => {
    let active = true
    const cached = attempt === 0 ? readCache(key) : null
    const run = cached ? Promise.resolve(cached) : api.compareJds({ cv_version_id: cvId, jd_ids: jdIds })
    run.then(
      (data) => {
        if (!active) return
        writeCache(key, data)
        setState({ status: "done", data })
      },
      (err: unknown) => active && setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) }),
    )
    return () => {
      active = false
    }
    // jdIds đổi thì key đổi; component được dựng lại theo key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const changeHref = `/student/analysis/new?mode=multi&cv=${encodeURIComponent(cvId)}&jd=${jdIds.map(encodeURIComponent).join(",")}`

  if (state.status === "running") return <Running count={jdIds.length} />
  if (state.status === "error") {
    return (
      <div className="grid gap-14">
        <PageHeader title={`So sánh ${jdIds.length} vị trí`} />
        <section role="alert" className="flex flex-col items-center gap-3 border-y border-line px-4 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-bad-soft text-bad">
            <AlertCircle className="size-5" aria-hidden />
          </span>
          <h2 className="text-[22px] leading-7 font-semibold text-ink">Chưa so sánh được</h2>
          <p className="max-w-md text-[15px] leading-6 text-ink-2">{state.error.message}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button
              size="brand"
              onClick={() => {
                setState({ status: "running" })
                setAttempt((a) => a + 1)
              }}
            >
              Thử lại
            </Button>
            <Button variant="soft" size="brand" nativeButton={false} render={<Link href={changeHref} />}>
              Chọn lại vị trí
            </Button>
          </div>
        </section>
      </div>
    )
  }
  return <CompareView data={state.data} cvId={cvId} changeHref={changeHref} />
}

function Running({ count }: { count: number }) {
  const [step, setStep] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), STEP_MS)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => {
      clearInterval(timer)
      clearTimeout(slowTimer)
    }
  }, [])
  return (
    <div className="grid gap-14">
      <PageHeader title={`So sánh ${count} vị trí`} />
      <AiProgress
        className="rounded-none! border-0 border-b bg-transparent px-0 pt-0 pb-8 sm:px-0 sm:pt-0"
        title="Đang so sánh…"
        description={
          slow
            ? "Lâu hơn bình thường một chút… Bạn cứ ở lại trang này, kết quả sẽ tự hiện khi xong."
            : "Thường mất 10–30 giây. Bạn cứ ở lại trang này, kết quả sẽ tự hiện khi xong."
        }
        steps={STEPS}
        current={step}
      />
    </div>
  )
}

/** Lượt so sánh đã lưu (bản vẽ SoSanhTuLichSu), mở từ Dòng thời gian ở Lịch sử & tiến bộ. Không chạy lại AI. */
export function SavedCompare({ id }: { id: string }) {
  const fetchSaved = useCallback(
    () => api.listComparisonHistory(50).then((rows) => rows.find((r) => r.id === id) ?? null),
    [id],
  )
  const { data, error, reload } = useApi(fetchSaved)

  if (error) {
    return (
      <div className="grid gap-14">
        <PageHeader title="So sánh vị trí" />
        <EmptyState
          icon={AlertCircle}
          title="Không tải được lượt so sánh"
          description={error.message}
          action={
            <Button size="brand" onClick={reload}>
              Thử lại
            </Button>
          }
        />
      </div>
    )
  }
  if (data === undefined) {
    return (
      <div className="grid gap-14" aria-busy="true" aria-label="Đang tải lượt so sánh">
        <Skeleton className="mt-12 h-[46px] w-72" />
        <Skeleton className="h-[160px] rounded-card" />
        <Skeleton className="h-[320px] rounded-card" />
      </div>
    )
  }
  if (data === null || !data.cv_version_id) {
    return (
      <div className="grid gap-14">
        <PageHeader title="So sánh vị trí" />
        <EmptyState
          icon={Columns3}
          title="Không tìm thấy lượt so sánh này"
          description="Lượt so sánh có thể đã bị xoá khỏi lịch sử."
          action={
            <Button size="brand" nativeButton={false} render={<Link href="/student/history" />}>
              Về Lịch sử & tiến bộ
            </Button>
          }
        />
      </div>
    )
  }
  const jdIds = data.comparisons.map((c) => c.jd_id)
  const changeHref = `/student/analysis/new?mode=multi&cv=${encodeURIComponent(data.cv_version_id)}&jd=${jdIds.map(encodeURIComponent).join(",")}`
  return <CompareView data={data} cvId={data.cv_version_id} changeHref={changeHref} saved={{ id, jdIds }} />
}

function CompareView({
  data,
  cvId,
  changeHref,
  saved,
}: {
  data: CompareJdsResponse
  cvId: string
  changeHref: string
  /** Mở lại từ lịch sử: thay "Đổi CV" bằng "So sánh lại" và nút xoá. */
  saved?: { id: string; jdIds: string[] }
}) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const top = data.comparisons[0]
  const n = data.comparisons.length
  const cvLine = [data.cv_name, data.cv_label].filter(Boolean).join(" · ")
  const savedAt = saved && data.created_at ? `${formatTime(data.created_at)}, ${formatDate(data.created_at)}` : null

  // So sánh lại với CV và JD hiện tại: bỏ kết quả cũ trong phiên để trang So sánh gọi AI chạy lại.
  function compareAgain() {
    if (!saved) return
    const ids = [...new Set(saved.jdIds)]
    clearCache(cacheKey(cvId, ids))
    router.push(`/student/analysis/compare?cv=${encodeURIComponent(cvId)}&jd=${ids.map(encodeURIComponent).join(",")}`)
  }

  async function remove() {
    if (!saved) return
    try {
      await api.deleteComparisonHistory(saved.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xoá được. Hãy thử lại.")
      throw err
    }
    toast.success("Đã xoá lượt so sánh khỏi lịch sử.")
    router.push("/student/history")
  }

  // Phân tích chi tiết vị trí #1 với đúng CV đã so sánh.
  async function analyzeTop() {
    if (!top) return
    setStarting(true)
    try {
      const analysis = await api.createGapAnalysis({ cv_version_id: data.cv_version_id ?? cvId, jd_id: top.jd_id })
      router.push(`/student/analysis/${encodeURIComponent(analysis.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bắt đầu phân tích được. Hãy thử lại.")
      setStarting(false)
    }
  }

  if (!top) {
    return (
      <div className="grid gap-14">
        <PageHeader title="So sánh vị trí" description={cvLine || undefined} />
        <EmptyState
          icon={Columns3}
          title="Chưa có kết quả so sánh"
          description="Không nhận được kết quả cho các vị trí đã chọn. Hãy chọn lại và thử lần nữa."
          action={
            <Button variant="soft" size="brand" nativeButton={false} render={<Link href={changeHref} />}>
              Chọn lại vị trí
            </Button>
          }
        />
      </div>
    )
  }

  // Một lần like / dislike cho cả bảng, theo cặp CV – nhóm vị trí
  const feedbackId = `cmp_${data.cv_version_id ?? cvId}_${data.comparisons.map((c) => c.jd_id).sort().join("_")}`
  const interviewHref = `/student/interview/new?jd=${encodeURIComponent(top.jd_id)}&cv=${encodeURIComponent(data.cv_version_id ?? cvId)}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-16">
      <PageHeader
        title={`So sánh ${n} vị trí`}
        description={
          savedAt ? (
            <>
              {cvLine}
              <span className="mt-2 flex items-center gap-2 text-sm text-ink-3">
                <Clock className="size-[15px]" strokeWidth={1.75} aria-hidden />
                Kết quả đã lưu lúc {savedAt}
              </span>
            </>
          ) : (
            cvLine || undefined
          )
        }
        actions={
          <>
            {saved ? (
              <>
                <Button
                  variant="outline"
                  size="brand"
                  className="w-11 border-line-strong bg-card px-0 text-ink-2 shadow-xs hover:text-bad"
                  aria-label="Xoá khỏi lịch sử"
                  title="Xoá khỏi lịch sử"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 aria-hidden />
                </Button>
                <Button variant="outline" size="brand" className="border-line-strong bg-card shadow-xs" onClick={compareAgain}>
                  <RotateCcw aria-hidden />
                  So sánh lại
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="brand"
                className="border-line-strong bg-card shadow-xs"
                nativeButton={false}
                render={<Link href={changeHref} />}
              >
                Đổi CV
              </Button>
            )}
            <Button size="brand" onClick={analyzeTop} disabled={starting}>
              {starting && <Loader2 className="animate-spin" aria-hidden />}
              Phân tích chi tiết vị trí #1
              {!starting && <ChevronRight aria-hidden />}
            </Button>
          </>
        }
      />
      <CompareScores data={data} />
      <CompareSkills data={data} />
      <div className="grid gap-10">
        <CompareComments data={data} />
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="brand"
            className="border-line-strong bg-card"
            nativeButton={false}
            render={<Link href={interviewHref} />}
          >
            Luyện phỏng vấn
          </Button>
        </div>
        <FeedbackWidget
          variant="question"
          responseId={feedbackId}
          activity="jd_compare"
          question="Bảng so sánh này có giúp bạn chọn vị trí?"
          className="border-t border-line pt-6"
        />
      </div>
      {saved && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          icon={Trash2}
          destructive
          title="Xoá lượt so sánh này?"
          description={`Lượt so sánh ${n} vị trí${data.created_at ? ` ngày ${formatDate(data.created_at)}` : ""} sẽ biến mất khỏi lịch sử. Các lượt phân tích và JD đã lưu không bị ảnh hưởng.`}
          confirmLabel="Xoá"
          onConfirm={remove}
        />
      )}
    </div>
  )
}

function MissingSelection({ cvId }: { cvId: string | null }) {
  const href = `/student/analysis/new?${new URLSearchParams({ mode: "multi", ...(cvId ? { cv: cvId } : {}) }).toString()}`
  return (
    <div className="grid gap-14">
      <PageHeader title="So sánh vị trí" description="So CV với 2–3 vị trí cùng lúc để chọn hướng phù hợp nhất." />
      <EmptyState
        icon={Columns3}
        title="Chưa chọn vị trí để so sánh"
        description={`Chọn từ ${COMPARE_MIN_JDS} đến ${COMPARE_MAX_JDS} vị trí ở màn Phân tích CV & JD.`}
        action={
          <Button size="brand" nativeButton={false} render={<Link href={href} />}>
            Chọn vị trí
          </Button>
        }
      />
    </div>
  )
}
