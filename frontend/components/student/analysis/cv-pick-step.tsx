"use client"

import { useState } from "react"
import { FileText } from "lucide-react"

import { Zone } from "@/components/common/zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CvVersion } from "@/lib/types"
import { cn } from "@/lib/utils"

/** "09/10" */
const shortDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
}

interface CvZoneProps {
  cvs: CvVersion[]
  selected: CvVersion
  onSelect: (cv: CvVersion) => void
}

/**
 * Vùng "CV" của màn Phân tích (bản vẽ PhanTich1): một dòng tên CV, nhãn Đang dùng, phiên bản · ngày cập nhật và nút
 * "Đổi CV" mở danh sách các CV sẵn sàng ngay bên dưới. Chỉ chọn CV đã có trong "CV của tôi", không tải CV mới ở đây.
 */
export function CvZone({ cvs, selected, onSelect }: CvZoneProps) {
  const [open, setOpen] = useState(false)
  const choices = cvs.filter((cv) => cv.status === "ready")

  return (
    <Zone id="cv-zone-title" title="CV">
      <div data-agent-target="select-cv" className="-mt-3 flex items-center gap-3.5 border-b border-line py-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface text-ink-2">
          <FileText className="size-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <b className="truncate font-semibold text-ink" title={selected.file_name}>
              {selected.file_name}
            </b>
            {selected.is_active && <ActiveBadge />}
          </div>
          <div className="text-sm text-ink-3">
            Phiên bản {selected.label} · cập nhật {shortDate(selected.uploaded_at)}
          </div>
        </div>
        {choices.length > 1 && (
          <Button
            variant="outline"
            className="h-9 shrink-0 rounded-full border-line-strong bg-card px-3.5 text-[13px] font-semibold"
            aria-expanded={open}
            aria-controls="cv-choices"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Đóng" : "Đổi CV"}
          </Button>
        )}
      </div>

      {open && (
        <div id="cv-choices" role="radiogroup" aria-label="Chọn CV để phân tích" className="mt-3 rounded-2xl bg-panel px-3 py-2 sm:px-5">
          {choices.map((cv) => {
            const checked = cv.id === selected.id
            return (
              <button
                key={cv.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  onSelect(cv)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3.5 border-b border-line py-3 text-left last:border-0"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] bg-card",
                    checked ? "border-ink" : "border-line-strong",
                  )}
                >
                  {checked && <span className="size-2 rounded-full bg-ink" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{cv.file_name}</span>
                  <span className="block text-sm text-ink-3">
                    Phiên bản {cv.label} · cập nhật {shortDate(cv.uploaded_at)}
                  </span>
                </span>
                {cv.is_active && <ActiveBadge />}
              </button>
            )
          })}
        </div>
      )}
    </Zone>
  )
}

function ActiveBadge() {
  return (
    <Badge variant="good" className="h-[22px] shrink-0 px-2">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      Đang dùng
    </Badge>
  )
}
