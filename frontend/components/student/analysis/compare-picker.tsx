"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ChevronRight, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { SegmentedControl } from "@/components/common/segmented-control"
import { Zone } from "@/components/common/zone"
import {
  EMPTY_PASTE,
  ItemTags,
  JdAddList,
  JdPasteForm,
  SOURCE_OPTIONS,
  composeJdText,
  pasteErrors,
  type JdSource,
  type PastedJd,
  type PickItem,
  type PickItemsState,
} from "@/components/student/analysis/jd-picker-sections"
import { levelText, metaLine } from "@/components/student/library/library-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { COMPARE_MAX_JDS, COMPARE_MIN_JDS, type CvVersion } from "@/lib/types"
import { cn } from "@/lib/utils"

type Slot = { key: string; kind: "jd"; item: PickItem } | { key: string; kind: "paste"; draft: PastedJd }

let slotSeq = 0
const nextKey = () => `slot-${++slotSeq}`

interface ComparePickerProps {
  cv: CvVersion
  picks: PickItemsState
  /** Vị trí chọn sẵn từ ?jd= (ví dụ quay lại từ trang So sánh để đổi CV). */
  initialJdIds: string[]
  industries: string[]
}

/** Chế độ "So với nhiều vị trí" (WIREFRAMES A5, bản vẽ PhanTichNhieu): 2–3 vị trí rồi chuyển sang trang So sánh. */
export function ComparePicker({ cv, picks, initialJdIds, industries }: ComparePickerProps) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [panelOpen, setPanelOpen] = useState(initialJdIds.length < COMPARE_MIN_JDS)
  const [tab, setTab] = useState<JdSource>("list")
  const [draft, setDraft] = useState<PastedJd>(EMPTY_PASTE)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Gieo danh sách từ ?jd= một lần khi đã có dữ liệu vị trí.
  if (slots === null && (picks.items || picks.error)) {
    const byId = new Map((picks.items ?? []).map((item) => [item.id, item]))
    setSlots(
      initialJdIds
        .flatMap((id) => {
          const item = byId.get(id)
          return item ? [{ key: nextKey(), kind: "jd" as const, item }] : []
        })
        .slice(0, COMPARE_MAX_JDS),
    )
  }

  const list = useMemo(() => slots ?? [], [slots])
  const n = list.length
  const full = n >= COMPARE_MAX_JDS
  const exclude = useMemo(() => new Set(list.flatMap((s) => (s.kind === "jd" ? [s.item.id] : []))), [list])

  function closePanel() {
    setPanelOpen(false)
    setEditingKey(null)
    setDraft(EMPTY_PASTE)
    setShowErrors(false)
  }

  function openAdd() {
    setEditingKey(null)
    setDraft(EMPTY_PASTE)
    setShowErrors(false)
    setTab("list")
    setPanelOpen(true)
  }

  function pick(item: PickItem) {
    const next = [...list, { key: nextKey(), kind: "jd" as const, item }]
    setSlots(next)
    if (next.length >= COMPARE_MAX_JDS) closePanel()
  }

  function savePaste() {
    if (Object.keys(pasteErrors(draft)).length > 0) {
      setShowErrors(true)
      return
    }
    const next = editingKey
      ? list.map((s) => (s.key === editingKey ? { key: s.key, kind: "paste" as const, draft } : s))
      : [...list, { key: nextKey(), kind: "paste" as const, draft }]
    setSlots(next)
    closePanel()
  }

  function edit(slot: Extract<Slot, { kind: "paste" }>) {
    setEditingKey(slot.key)
    setDraft(slot.draft)
    setShowErrors(false)
    setTab("paste")
    setPanelOpen(true)
  }

  function remove(key: string) {
    setSlots(list.filter((s) => s.key !== key))
    if (editingKey === key) closePanel()
  }

  async function compare() {
    if (n < COMPARE_MIN_JDS) return
    setSubmitting(true)
    try {
      // JD tự dán được tạo lúc bấm So sánh, vì POST /jd/compare chỉ nhận jd_ids.
      const ids = await Promise.all(
        list.map(async (s) => {
          if (s.kind === "jd") return s.item.id
          const jd = await api.createPastedJd({
            title: s.draft.title.trim(),
            company: s.draft.company.trim() || undefined,
            level: s.draft.level ?? undefined,
            industry: s.draft.industry ?? undefined,
            text: composeJdText(s.draft),
          })
          if (s.draft.save) api.saveJd(jd.id).catch(() => toast.warning(`Chưa lưu được "${jd.title}" vào Đã lưu.`))
          return jd.id
        }),
      )
      const jd = ids.map(encodeURIComponent).join(",")
      router.push(`/student/analysis/compare?cv=${encodeURIComponent(cv.id)}&jd=${jd}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không bắt đầu so sánh được. Hãy thử lại.")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Zone
        id="compare-slots-title"
        title="Vị trí so sánh"
        className="max-w-[980px]"
        aside={
          <span className="text-sm text-ink-3 tabular-nums" aria-label={`Đã chọn ${n} trên tối đa ${COMPARE_MAX_JDS} vị trí`}>
            <b className="font-semibold text-ink">{n}</b> / {COMPARE_MAX_JDS}
          </span>
        }
      >
        <div className="-mt-3.5">
          <ol>
            {list.map((slot, i) => (
              <li key={slot.key} className="flex items-center gap-3 border-b border-line py-3.5 sm:gap-4">
                <span className="w-[22px] shrink-0 font-semibold text-ink-3 tabular-nums">{i + 1}</span>
                <SlotText slot={slot} />
                {slot.kind === "jd" ? (
                  <span className="hidden sm:flex">
                    <ItemTags item={slot.item} />
                  </span>
                ) : (
                  <>
                    <Badge variant="neutral" className="hidden h-[22px] px-2 sm:inline-flex">
                      JD tự dán
                    </Badge>
                    <button
                      type="button"
                      onClick={() => edit(slot)}
                      className="shrink-0 text-sm font-semibold text-blue hover:text-accent-strong"
                    >
                      Sửa
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => remove(slot.key)}
                  aria-label={`Bỏ ${slot.kind === "jd" ? slot.item.title : slot.draft.title}`}
                  className="grid size-[34px] shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ol>

          {!full && (
            <div className="flex items-center gap-3 pt-3.5 sm:gap-4">
              <span className="w-[22px] shrink-0 font-semibold text-ink-3 tabular-nums">{n + 1}</span>
              <button
                type="button"
                onClick={() => (panelOpen && !editingKey ? closePanel() : openAdd())}
                aria-expanded={panelOpen && !editingKey}
                aria-controls="add-panel"
                className="inline-flex min-h-9 items-center gap-2 font-semibold text-ink hover:text-blue"
              >
                <Plus className="size-4" aria-hidden />
                Thêm vị trí
              </button>
            </div>
          )}

          {panelOpen && (
            <div id="add-panel" className={cn("mt-3 rounded-2xl bg-panel px-4 py-4 sm:ml-[38px] sm:px-5 sm:py-[18px]", full && !editingKey && "hidden")}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <SegmentedControl
                  aria-label="Cách thêm vị trí"
                  size="sm"
                  className="w-full bg-card sm:w-[280px]"
                  value={tab}
                  onChange={setTab}
                  options={SOURCE_OPTIONS}
                />
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label="Đóng khung thêm vị trí"
                  className="grid size-[34px] shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-surface hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {tab === "list" ? (
                <JdAddList state={picks} exclude={exclude} onPick={pick} onPaste={() => setTab("paste")} />
              ) : (
                <div className="grid gap-5 pt-4">
                  <JdPasteForm
                    value={draft}
                    onChange={setDraft}
                    showErrors={showErrors}
                    industries={industries}
                    idPrefix="multi-paste"
                  />
                  <div className="flex justify-end">
                    <Button size="brand" onClick={savePaste}>
                      {editingKey ? "Cập nhật" : "Thêm"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-3.5 text-[13px] text-ink-3">
            Chọn từ {COMPARE_MIN_JDS} đến {COMPARE_MAX_JDS} vị trí.
          </p>
        </div>
      </Zone>

      <BottomActionBar>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm text-ink-2">
            Đã chọn <b className="font-semibold text-ink tabular-nums">{n}</b> vị trí
          </span>
          <span className="flex-1" />
          {n < COMPARE_MIN_JDS && (
            <span className="text-[13px] text-ink-3">Chọn thêm {COMPARE_MIN_JDS - n} vị trí để so sánh.</span>
          )}
          <Button size="brand" onClick={compare} disabled={submitting || n < COMPARE_MIN_JDS} className="max-sm:w-full">
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitting ? "Đang chuẩn bị…" : `So sánh ${Math.max(n, COMPARE_MIN_JDS)} vị trí`}
            {!submitting && <ChevronRight aria-hidden />}
          </Button>
        </div>
      </BottomActionBar>
    </>
  )
}

function SlotText({ slot }: { slot: Slot }) {
  const title = slot.kind === "jd" ? slot.item.title : slot.draft.title.trim()
  const meta =
    slot.kind === "jd"
      ? metaLine(slot.item.company, levelText(slot.item.level))
      : metaLine(slot.draft.company.trim(), levelText(slot.draft.level))
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-ink">{title}</span>
      <span className="block truncate text-sm text-ink-3">
        {meta || (slot.kind === "paste" ? "JD tự dán" : "")}
        {slot.kind === "paste" && meta && <span className="sm:hidden"> · JD tự dán</span>}
      </span>
    </span>
  )
}
