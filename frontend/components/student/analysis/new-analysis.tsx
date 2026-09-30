"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ClipboardPaste, Library, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { AnalysisStepper } from "@/components/student/analysis/analysis-stepper"
import { CvPickStep } from "@/components/student/analysis/cv-pick-step"
import {
  IntegrityBox,
  JD_TABS,
  JdLibraryPicker,
  JdPasteForm,
  SelectedCvCard,
  type JdTab,
  type PastedJd,
} from "@/components/student/analysis/jd-picker-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { countWords } from "@/lib/text"
import { JD_MIN_WORDS, type JobDescription } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const EMPTY_PASTE: PastedJd = { title: "", company: "", text: "" }

// Figma: frame "Chọn vị trí ứng tuyển" (18:2637). US-SV-02.
export function NewAnalysis({ initialCvId }: { initialCvId: string | null }) {
  const router = useRouter()
  const { data: cvs } = useApi(api.listCvVersions)
  const { data: library } = useApi(api.listJdLibrary)

  const [cvId, setCvId] = useState<string | null>(initialCvId)
  // Vào từ nút "Phân tích" trên thẻ CV (?cv=) thì CV đã chọn sẵn → vào thẳng bước 2.
  const [step, setStep] = useState<0 | 1>(initialCvId ? 1 : 0)
  const [tab, setTab] = useState<JdTab>("library")
  const [paste, setPaste] = useState<PastedJd>(EMPTY_PASTE)
  const [libraryJd, setLibraryJd] = useState<JobDescription | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  const pasteTouched = paste.title.trim() !== "" || paste.text.trim() !== ""
  const pasteReady = paste.title.trim() !== "" && countWords(paste.text) >= JD_MIN_WORDS
  // SV chỉ chọn một nguồn JD: tab đang mở quyết định gửi JD thư viện hay JD tự dán.
  const ready = tab === "library" ? libraryJd !== null : pasteReady
  const missingHint =
    tab === "library" ? "Hãy chọn một vị trí trong thư viện JD." : `Nhập tiêu đề và tối thiểu ${JD_MIN_WORDS} từ nội dung JD.`
  const selectionLabel =
    tab === "library"
      ? libraryJd && { text: libraryJd.title, source: "Thư viện", icon: Library }
      : paste.title.trim() && { text: paste.title.trim(), source: "Dán tay", icon: ClipboardPaste }

  function reset() {
    setPaste(EMPTY_PASTE)
    setLibraryJd(null)
  }

  async function submit() {
    if (!selectedCv || !ready) return
    setSubmitting(true)
    try {
      const analysis = await api.createGapAnalysis(
        tab === "library"
          ? { cv_version_id: selectedCv.id, jd_id: libraryJd!.id }
          : {
              cv_version_id: selectedCv.id,
              jd_text: paste.text,
              jd_title: paste.title.trim(),
              jd_company: paste.company.trim() || undefined,
            },
      )
      // Trang kết quả hiển thị tiến độ từng bước cho tới khi phân tích xong.
      router.push(`/student/analysis/${encodeURIComponent(analysis.id)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bắt đầu phân tích được. Hãy thử lại.")
      setSubmitting(false)
    }
  }

  if (!cvs || !selectedCv) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-[88px] rounded-[20px]" />
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[420px] rounded-[20px]" />
          <Skeleton className="h-[640px] rounded-[20px]" />
        </div>
      </div>
    )
  }

  const SelectionIcon = selectionLabel ? selectionLabel.icon : null
  const steps = [
    { title: "Chọn CV", description: step === 0 ? "Chọn phiên bản CV để đối chiếu" : selectedCv.file_name },
    { title: "Chọn vị trí / JD", description: "Chọn từ thư viện hoặc dán JD" },
    { title: "Xem phân tích", description: "Đối soát và đề xuất cải thiện" },
  ]

  if (step === 0) {
    return (
      <div className="grid gap-6">
        <AnalysisStepper current={0} steps={steps} />
        <CvPickStep
          cvs={cvs}
          selectedId={selectedCv.id}
          onSelect={setCvId}
          onContinue={() => {
            setCvId(selectedCv.id)
            setStep(1)
            window.scrollTo({ top: 0 })
          }}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <AnalysisStepper current={1} steps={steps} onStepClick={() => setStep(0)} />

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="grid min-w-0 gap-4 lg:sticky lg:top-24">
          <SelectedCvCard selected={selectedCv} onChangeCv={() => setStep(0)} />
          <IntegrityBox />
        </aside>

        <div className="grid min-w-0 gap-4">
          <div role="tablist" aria-label="Cách chọn JD" className="flex gap-1 rounded-2xl border border-line bg-surface p-1.5">
            {JD_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  tab === value ? "bg-card text-blue shadow-card" : "text-ink-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {value === "library" && library && (
                  <span className="rounded-full bg-violet-soft px-2 py-0.5 text-xs text-violet">{library.length} vị trí</span>
                )}
              </button>
            ))}
          </div>

          {tab === "library" ? (
            <JdLibraryPicker items={library} selected={libraryJd} onSelect={setLibraryJd} />
          ) : (
            <JdPasteForm value={paste} onChange={setPaste} showErrors={pasteTouched} />
          )}
        </div>
      </div>

      {/* Thanh hành động dính đáy (Figma: node 18:2980) */}
      <BottomActionBar>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs">
            <span className="font-medium text-ink-2">Đã chọn:</span>
            {selectionLabel && SelectionIcon ? (
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-blue-soft py-1 pr-2 pl-3 font-medium text-blue">
                <SelectionIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="max-w-72 truncate">
                  {selectionLabel.text} ({selectionLabel.source})
                </span>
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Bỏ chọn vị trí"
                  className="grid size-4 shrink-0 place-items-center rounded-full hover:bg-blue/10"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ) : (
              <span className="text-ink-3">Chưa có vị trí nào</span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!ready && <span className="text-xs text-ink-2">{missingHint}</span>}
            <Button variant="ghost" className="h-10 px-4 text-ink-2" onClick={reset} disabled={submitting}>
              Huỷ & Chọn lại
            </Button>
            <Button className="h-10 px-6 shadow-md" onClick={submit} disabled={submitting || !ready}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {submitting ? "Đang gửi…" : "Phân tích CV với JD"}
              {!submitting && <ArrowRight aria-hidden />}
            </Button>
          </div>
        </div>
      </BottomActionBar>
    </div>
  )
}
