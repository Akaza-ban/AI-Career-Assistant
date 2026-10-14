"use client"

import { useMemo, useState } from "react"
import { Plus } from "lucide-react"

import { PageHeader } from "@/components/common/page-header"
import { AddJdDialog, type JdDialogMode } from "@/components/student/library/add-jd-dialog"
import { AllPositions } from "@/components/student/library/all-positions"
import { JdQuickSheet } from "@/components/student/library/jd-quick-sheet"
import {
  cvOptionLabel,
  defaultCv,
  recommendationMap,
  useRecommendations,
  useSavedJds,
} from "@/components/student/library/library-data"
import { MyJds } from "@/components/student/library/my-jds"
import { RecommendationPanel } from "@/components/student/library/recommendation-panel"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"

/**
 * Thư viện JD (WIREFRAMES A2/B2, bản vẽ ThuVienJdCuaBan): gợi ý theo CV đang chọn, JD sinh viên tự dán (chỉ người dán
 * thấy), rồi toàn bộ thư viện kèm tìm kiếm và lọc.
 */
export function JdLibrary({ initialCvId }: { initialCvId: string | null }) {
  const library = useApi(api.listJdLibrary)
  const cvs = useApi(api.listCvVersions)
  const saved = useSavedJds()
  const mine = useApi(api.listPastedJds)
  const [dialog, setDialog] = useState<JdDialogMode | null>(null)
  const [pickedCvId, setPickedCvId] = useState<string | null>(initialCvId)
  const [openJdId, setOpenJdId] = useState<string | null>(null)

  const readyCvs = useMemo(() => (cvs.data ?? []).filter((cv) => cv.status === "ready"), [cvs.data])
  const cv = cvs.data ? defaultCv(cvs.data, pickedCvId) : null
  const recs = useRecommendations(cv?.id ?? null, true)
  const lookup = useMemo(() => recommendationMap(recs.data?.recommendations), [recs.data])

  // CV khác CV đang dùng thì mang theo sang trang chi tiết để mức phù hợp khớp với gợi ý đang xem.
  const detailHref = (jdId: string) =>
    `/student/library/${encodeURIComponent(jdId)}${cv && !cv.is_active ? `?cv=${encodeURIComponent(cv.id)}` : ""}`

  const hasCv = cvs.data ? cv !== null : cvs.error ? true : undefined
  const recError = cvs.error ?? recs.error
  const retryRecs = cvs.error ? cvs.reload : recs.reload
  const openJd = library.data?.find((jd) => jd.id === openJdId) ?? null
  const count = library.data?.length

  return (
    // Kiểu dashboard Stripe (DESIGN.md 3.6): tiêu đề trang rồi các vùng cách nhau 56–64px.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-14 md:gap-16">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:gap-11">
        {/* Dưới lg, thanh trên cùng đã hiện tên trang nên tiêu đề chỉ còn cho trình đọc màn hình. */}
        <PageHeader
          className="pt-2 max-lg:[&_h1]:sr-only max-md:[&_p]:hidden md:pt-4 lg:pt-12"
          title="Thư viện JD"
          description={`${count ? `${count} vị trí` : "Các vị trí"} đã chuẩn hoá yêu cầu theo mức Bắt buộc, Ưu tiên và Cộng thêm.`}
          actions={
            <>
              <CvPicker cvs={cvs.data ? readyCvs : undefined} value={cv} onChange={setPickedCvId} />
              <Button size="brand" className="h-[38px] px-4" onClick={() => setDialog({ kind: "create" })}>
                <Plus data-icon="inline-start" aria-hidden />
                Thêm JD
              </Button>
            </>
          }
        />

        <RecommendationPanel
          hasCv={hasCv}
          data={recs.data}
          error={recError}
          loading={recs.loading}
          onRetry={retryRecs}
          saved={saved}
          detailHref={detailHref}
          onOpen={setOpenJdId}
        />
      </div>

      <MyJds
        jds={mine.data}
        error={mine.error}
        onRetry={mine.reload}
        onAdd={() => setDialog({ kind: "create" })}
        onEdit={(jd) => setDialog({ kind: "edit", jd })}
        onDeleted={mine.reload}
      />

      <AllPositions
        library={library.data}
        error={library.error}
        onRetry={library.reload}
        recs={lookup}
        saved={saved}
        detailHref={detailHref}
        onOpen={setOpenJdId}
      />

      <AddJdDialog mode={dialog} onOpenChange={(open) => !open && setDialog(null)} onSaved={mine.reload} />

      <JdQuickSheet
        jd={openJd}
        cvLabel={cv ? cvOptionLabel(cv) : null}
        detailHref={detailHref}
        onClose={() => setOpenJdId(null)}
        match={openJd ? lookup.get(openJd.id) : undefined}
        hasCv={hasCv !== false}
        loading={hasCv === undefined || recs.loading}
        error={recError}
        onRetry={retryRecs}
      />
    </div>
  )
}

function CvPicker({
  cvs,
  value,
  onChange,
}: {
  cvs: CvVersion[] | undefined
  value: CvVersion | null
  onChange: (id: string) => void
}) {
  if (!cvs) return <Skeleton className="h-[38px] w-64 max-w-full rounded-[10px]" />
  if (cvs.length === 0 || !value) return null
  const items = cvs.map((cv) => ({ value: cv.id, label: cvOptionLabel(cv) }))
  return (
    <div className="flex max-w-full min-w-0 items-center gap-2.5">
      <span id="cv-pick-label" className="shrink-0 text-[13px] text-ink-3">
        Gợi ý theo
      </span>
      <Select items={items} value={value.id} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger
          aria-labelledby="cv-pick-label"
          className="h-[38px] max-w-[calc(100vw-7rem)] min-w-0 rounded-[10px] border-line-strong bg-card px-2.5 text-sm font-medium text-ink shadow-xs sm:max-w-[340px] sm:px-3"
        >
          <SelectValue className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent align="end">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
