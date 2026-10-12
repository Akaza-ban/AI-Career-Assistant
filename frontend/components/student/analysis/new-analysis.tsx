"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { PageHeader } from "@/components/common/page-header"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone } from "@/components/common/zone"
import { ComparePicker } from "@/components/student/analysis/compare-picker"
import { CvZone } from "@/components/student/analysis/cv-pick-step"
import {
  EMPTY_PASTE,
  JdPasteForm,
  JdRadioList,
  SOURCE_OPTIONS,
  composeJdText,
  pasteErrors,
  pasteMissingHint,
  usePickItems,
  type JdSource,
  type PastedJd,
  type PickItem,
  type PickItemsState,
} from "@/components/student/analysis/jd-picker-sections"
import { metaLine } from "@/components/student/library/library-data"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"
import { useAgentActions } from "@/lib/use-agent-actions"
import { useApi } from "@/lib/use-api"

type Mode = "single" | "multi"

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: "single", label: "So với 1 vị trí" },
  { value: "multi", label: "So với nhiều vị trí" },
]

/**
 * Phân tích CV & JD (WIREFRAMES A4, A5; bản vẽ PhanTich1, PhanTichNhieu). US-SV-02.
 * Chế độ nằm trong URL (?mode=multi) để quay lại được; ?cv= chọn sẵn CV, ?jd=<id>[,<id>] chọn sẵn vị trí.
 */
export function NewAnalysis({ initialCvId, initialJdIds }: { initialCvId: string | null; initialJdIds: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode: Mode = searchParams.get("mode") === "multi" ? "multi" : "single"
  const { data: cvs, error: cvError, reload: reloadCvs } = useApi(api.listCvVersions)
  const [cvId, setCvId] = useState<string | null>(initialCvId)

  // US-SV-02 AC3: chưa có CV thì chặn và đưa về trang CV để tải lên.
  useEffect(() => {
    if (cvs && cvs.length === 0) {
      toast.warning("Bạn cần tải CV lên trước khi phân tích với JD.")
      router.replace("/student/cv")
    }
  }, [cvs, router])

  // CV mặc định: từ ?cv=, nếu không thì phiên bản đang dùng, cuối cùng là bản mới nhất.
  const selectedCv = useMemo(() => {
    if (!cvs?.length) return undefined
    return cvs.find((cv) => cv.id === cvId) ?? cvs.find((cv) => cv.is_active) ?? cvs[0]
  }, [cvs, cvId])

  const picks = usePickItems(selectedCv?.status === "ready" ? selectedCv.id : null, initialJdIds)
  const industries = useMemo(
    () => [...new Set((picks.jds ?? []).flatMap((jd) => (jd.industry ? [jd.industry] : [])))].sort((a, b) => a.localeCompare(b, "vi")),
    [picks.jds],
  )

  // Ghi chế độ và CV vào URL để tải lại hoặc quay lại vẫn đúng màn đang xem (không tải lại trang).
  function syncUrl(next: { mode?: Mode; cv?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.mode) {
      if (next.mode === "multi") params.set("mode", "multi")
      else params.delete("mode")
    }
    if (next.cv) params.set("cv", next.cv)
    const query = params.toString()
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14">
      {/* Dưới lg, thanh trên cùng đã hiện tên trang nên tiêu đề chỉ còn cho trình đọc màn hình (như Thư viện JD). */}
      <PageHeader
        className="pt-2 pb-0 max-lg:[&_h1]:sr-only max-sm:[&>div:last-child]:w-full md:pt-4 lg:pt-12"
        title="Phân tích CV & JD"
        description="So CV với vị trí bạn nhắm tới để biết còn thiếu gì."
        actions={
          <SegmentedControl
            aria-label="Chế độ phân tích"
            size="lg"
        className="w-full p-1 sm:w-auto"
            value={mode}
            onChange={(m) => syncUrl({ mode: m })}
            options={MODE_OPTIONS}
          />
        }
      />

      {cvError ? (
        <Zone id="cv-zone-title" title="CV">
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
            Không tải được danh sách CV.
            <Button variant="soft" className="h-9 rounded-full px-4" onClick={reloadCvs}>
              Thử lại
            </Button>
          </div>
        </Zone>
      ) : !selectedCv ? (
        <LoadingZones />
      ) : (
        <>
          <CvZone
            cvs={cvs ?? []}
            selected={selectedCv}
            onSelect={(cv) => {
              setCvId(cv.id)
              syncUrl({ cv: cv.id })
            }}
          />
          {mode === "single" ? (
            <SinglePicker
              key="single"
              cv={selectedCv}
              picks={picks}
              initialJdId={initialJdIds[0] ?? null}
              industries={industries}
            />
          ) : (
            <ComparePicker key="multi" cv={selectedCv} picks={picks} initialJdIds={initialJdIds} industries={industries} />
          )}
        </>
      )}
    </div>
  )
}

function LoadingZones() {
  return (
    <div className="grid gap-14" aria-busy="true" aria-label="Đang tải">
      {[72, 280].map((h) => (
        <div key={h} className="grid gap-5">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="rounded-card" style={{ height: h }} />
        </div>
      ))}
    </div>
  )
}

interface SinglePickerProps {
  cv: CvVersion
  picks: PickItemsState
  initialJdId: string | null
  industries: string[]
}

/** Chế độ "So với 1 vị trí": chọn một vị trí gợi ý / đã lưu hoặc dán JD, rồi bắt đầu phân tích. */
function SinglePicker({ cv, picks, initialJdId, industries }: SinglePickerProps) {
  const router = useRouter()
  const [tab, setTab] = useState<JdSource>("list")
  const [selected, setSelected] = useState<PickItem | null>(null)
  const [paste, setPaste] = useState<PastedJd>(EMPTY_PASTE)
  const [submitting, setSubmitting] = useState(false)

  // Chọn sẵn vị trí từ ?jd= khi danh sách đã tải; nếu không có thì chọn vị trí đầu danh sách.
  const [seeded, setSeeded] = useState(false)
  if (!seeded && picks.items) {
    setSeeded(true)
    setSelected(picks.items.find((item) => item.id === initialJdId) ?? picks.items[0] ?? null)
  }

  const pasteReady = Object.keys(pasteErrors(paste)).length === 0
  const ready = tab === "list" ? selected !== null : pasteReady
  const hint = tab === "list" ? "Hãy chọn một vị trí." : pasteMissingHint(paste)
  // Trợ lý AI: báo vị trí đang chọn và cho phép đặt lại lựa chọn.
  useAgentActions({
    getContext: () => ({
      selected_cv_id: cv.id,
      page_state: { active_tab: tab, selected_jd_id: tab === "list" ? selected?.id : undefined },
    }),
    resetView: ({ clear_filters }) => {
      if (!clear_filters || submitting) return
      setTab("list")
      setPaste(EMPTY_PASTE)
      setSelected(picks.items?.find((item) => item.id === initialJdId) ?? picks.items?.[0] ?? null)
    },
  })

  const chosen =
    tab === "list"
      ? selected && metaLine(selected.title, selected.company)
      : paste.title.trim() && metaLine(paste.title.trim(), paste.company.trim())

  async function submit() {
    if (!ready) return
    setSubmitting(true)
    try {
      const analysis = await api.createGapAnalysis(
        tab === "list"
          ? { cv_version_id: cv.id, jd_id: selected!.id }
          : {
              cv_version_id: cv.id,
              jd_text: composeJdText(paste),
              jd_title: paste.title.trim(),
              jd_company: paste.company.trim() || undefined,
            },
      )
      if (tab === "paste" && paste.save) {
        api.saveJd(analysis.jd.id).catch(() => toast.warning("Chưa lưu được JD này vào Đã lưu."))
      }
      // Trang kết quả hiển thị tiến độ từng bước cho tới khi phân tích xong.
      router.push(`/student/analysis/${encodeURIComponent(analysis.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bắt đầu phân tích được. Hãy thử lại.")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Zone
        id="pick-title"
        title="Chọn vị trí"
        aside={
          <SegmentedControl
            aria-label="Cách chọn vị trí"
            size="sm"
            className="w-full sm:w-[280px]"
            value={tab}
            onChange={setTab}
            options={SOURCE_OPTIONS}
          />
        }
      >
        <div className="-mt-3.5 max-w-[980px]">
          {tab === "list" ? (
            <div className="pt-3.5">
              <JdRadioList state={picks} value={selected?.id ?? null} onChange={setSelected} onPaste={() => setTab("paste")} />
            </div>
          ) : (
            <div className="pt-6">
              <JdPasteForm
                value={paste}
                onChange={setPaste}
                showErrors={false}
                industries={industries}
                idPrefix="single-paste"
              />
            </div>
          )}
        </div>
      </Zone>

      <BottomActionBar>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-[1_1_240px] items-baseline gap-2.5">
            <span className="shrink-0 text-sm text-ink-3">Đã chọn</span>
            {chosen ? (
              <b className="truncate font-semibold text-ink">{chosen}</b>
            ) : (
              <span className="truncate text-sm text-ink-3">Chưa có vị trí nào</span>
            )}
          </div>
          {!ready && hint && <span className="text-[13px] text-ink-3">{hint}</span>}
          <Button
            data-agent-target="btn-start-analysis"
            size="brand"
            onClick={submit}
            disabled={submitting || !ready}
            className="max-sm:w-full"
          >
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitting ? "Đang gửi…" : "Bắt đầu phân tích"}
            {!submitting && <ChevronRight aria-hidden />}
          </Button>
        </div>
      </BottomActionBar>
    </>
  )
}
