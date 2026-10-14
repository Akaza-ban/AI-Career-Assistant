"use client"

import Link from "next/link"
import { ArrowRight, X } from "lucide-react"

import { MatchSummary, type MatchSummaryProps } from "@/components/student/library/library-bits"
import { levelText, metaLine } from "@/components/student/library/library-data"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { JobDescription } from "@/lib/types"

interface JdQuickSheetProps extends MatchSummaryProps {
  jd: JobDescription | null
  cvLabel: string | null
  detailHref: (jdId: string) => string
  onClose: () => void
}

/** Điện thoại: chạm một vị trí mở sheet mức phù hợp (WIREFRAMES B2/B3). */
export function JdQuickSheet({ jd, cvLabel, detailHref, onClose, ...match }: JdQuickSheetProps) {
  return (
    <Sheet open={jd !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[88dvh] gap-3.5 overflow-y-auto rounded-t-[22px] px-5 pt-2.5 pb-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {jd && (
          <>
            <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <SheetTitle className="font-heading text-xl leading-[26px] font-bold text-ink">{jd.title}</SheetTitle>
                <SheetDescription className="text-[13px] text-ink-3">
                  {metaLine(jd.company, levelText(jd.level))}
                </SheetDescription>
              </div>
              <SheetClose
                aria-label="Đóng"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-ink-2"
              >
                <X className="size-4" strokeWidth={2} aria-hidden />
              </SheetClose>
            </div>
            <div className="grid gap-2.5 rounded-card bg-panel px-4 py-3.5">
              <p className="truncate text-[13px] text-ink-2">
                Mức phù hợp với {cvLabel ? <span className="font-medium text-ink">{cvLabel}</span> : "CV của bạn"}
              </p>
              <MatchSummary {...match} />
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="soft"
                className="h-12 flex-1 rounded-full text-[15px] font-semibold"
                nativeButton={false}
                render={<Link href={detailHref(jd.id)} />}
              >
                Xem chi tiết
              </Button>
              <Button
                className="h-12 flex-[1.5] rounded-full text-[15px] font-semibold"
                nativeButton={false}
                render={<Link href={`/student/analysis/new?jd=${jd.id}`} />}
              >
                Phân tích chi tiết
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
