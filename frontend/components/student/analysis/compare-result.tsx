"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AlertCircle, ChevronRight, Columns3, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { AiProgress } from "@/components/common/ai-progress"
import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { CompareComments, CompareScores, CompareSkills } from "@/components/student/analysis/compare-sections"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { COMPARE_MAX_JDS, COMPARE_MIN_JDS, type CompareJdsResponse } from "@/lib/types"

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

function CompareView({ data, cvId, changeHref }: { data: CompareJdsResponse; cvId: string; changeHref: string }) {
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const top = data.comparisons[0]
  const n = data.comparisons.length
  const cvLine = [data.cv_name, data.cv_label].filter(Boolean).join(" · ")

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

  const interviewHref = `/student/interview/new?jd=${encodeURIComponent(top.jd_id)}&cv=${encodeURIComponent(data.cv_version_id ?? cvId)}`

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-16">
      <PageHeader
        title={`So sánh ${n} vị trí`}
        description={cvLine || undefined}
        actions={
          <>
            <Button
              variant="outline"
              size="brand"
              className="border-line-strong bg-card shadow-xs"
              nativeButton={false}
              render={<Link href={changeHref} />}
            >
              Đổi CV
            </Button>
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
      </div>
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
