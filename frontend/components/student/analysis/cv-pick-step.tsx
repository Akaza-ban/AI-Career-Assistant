"use client"

import Link from "next/link"
import { ArrowRight, CircleCheck, FileText, Upload } from "lucide-react"

import { Panel } from "@/components/common/panel"
import { ScoreRing } from "@/components/common/score-ring"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatBytes, formatRelativeTime } from "@/lib/format"
import type { CvVersion } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CvPickStepProps {
  cvs: CvVersion[]
  selectedId: string
  onSelect: (id: string) => void
  onContinue: () => void
}

/** Bước 1 của luồng phân tích: chọn phiên bản CV để đối chiếu với JD. */
export function CvPickStep({ cvs, selectedId, onSelect, onContinue }: CvPickStepProps) {
  const selected = cvs.find((cv) => cv.id === selectedId)
  return (
    <>
      <Panel className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="font-heading text-lg font-bold">Chọn phiên bản CV để phân tích</h2>
            <p className="text-sm text-ink-2">
              Mỗi lần phân tích gắn với một phiên bản CV cụ thể, để bạn so sánh kết quả giữa các phiên bản về sau.
            </p>
          </div>
          <Button variant="soft" className="h-9" nativeButton={false} render={<Link href="/student/cv" />}>
            <Upload aria-hidden />
            Tải CV mới
          </Button>
        </div>

        <div role="radiogroup" aria-label="Phiên bản CV" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cvs.map((cv) => {
            const checked = cv.id === selectedId
            return (
              <button
                key={cv.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => onSelect(cv.id)}
                className={cn(
                  "grid gap-3 rounded-xl border p-4 text-left transition-colors",
                  checked ? "border-blue bg-blue-soft/50 ring-2 ring-blue/20" : "border-line bg-surface/60 hover:border-blue/40",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2",
                        checked ? "border-blue" : "border-ink-3",
                      )}
                    >
                      {checked && <span className="size-2 rounded-full bg-blue" />}
                    </span>
                    <span className="grid min-w-0">
                      <span className="truncate font-heading font-bold text-ink" title={cv.file_name}>
                        {cv.file_name}
                      </span>
                      <span className="text-xs text-ink-2">
                        {cv.label} · {cv.file_type.toUpperCase()} · {formatBytes(cv.size_bytes)} · cập nhật{" "}
                        {formatRelativeTime(cv.uploaded_at).toLowerCase()}
                      </span>
                    </span>
                  </span>
                  {cv.ats_score !== null && <ScoreRing score={cv.ats_score} size={36} strokeWidth={3.5} labelClassName="text-xs" />}
                </span>
                <span className="flex flex-wrap gap-1.5 pl-6.5">
                  {cv.is_active && (
                    <Badge variant="good">
                      <CircleCheck aria-hidden />
                      Đang dùng
                    </Badge>
                  )}
                  {cv.is_draft && <Badge variant="neutral">Bản nháp</Badge>}
                  <Badge variant={cv.target_title ? "blue" : "neutral"}>{cv.target_title ?? "Chưa gắn vị trí"}</Badge>
                </span>
              </button>
            )
          })}
        </div>
      </Panel>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-card/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <span className="font-medium text-ink-2">Đã chọn:</span>
            {selected && (
              <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-blue-soft px-3 py-1 font-medium text-blue">
                <FileText className="size-3.5 shrink-0" aria-hidden />
                <span className="max-w-72 truncate">
                  {selected.file_name} ({selected.label})
                </span>
              </span>
            )}
          </span>
          <Button className="h-10 px-6 shadow-md" onClick={onContinue} disabled={!selected}>
            Tiếp tục chọn JD
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>
    </>
  )
}
