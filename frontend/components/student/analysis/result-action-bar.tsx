"use client"

import Link from "next/link"
import { ArrowRight, MessagesSquare } from "lucide-react"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { OPTIMIZER_AVAILABLE } from "@/lib/config"
import type { GapAnalysis } from "@/lib/types"

/**
 * Thanh dính đáy chỉ chứa hành động tiếp theo. Phản hồi về kết quả dùng khảo sát CSAT 5 sao cuối trang
 * (US-SV-06), không hỏi thêm "Hữu ích không?" ở đây để tránh hỏi hai lần.
 */
export function ResultActionBar({ analysis }: { analysis: GapAnalysis }) {
  const optimizeHref = `/student/analysis/${encodeURIComponent(analysis.id)}/optimize`
  const interviewHref = `/student/interview/new?jd=${encodeURIComponent(analysis.jd.id)}`

  return (
    <BottomActionBar>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className="hidden text-sm text-ink-2 sm:block">Bước tiếp theo: sửa CV theo gợi ý, rồi luyện phỏng vấn.</span>
        <span className="hidden flex-1 sm:block" />
        <div className="flex w-full items-center gap-2.5 sm:w-auto">
          <Button
            variant="soft"
            size="brand"
            className="max-sm:size-11 max-sm:min-h-0 max-sm:p-0"
            nativeButton={false}
            render={<Link href={interviewHref} aria-label="Luyện phỏng vấn cho vị trí này" />}
          >
            <MessagesSquare className="sm:hidden" aria-hidden />
            <span className="max-sm:sr-only">Luyện phỏng vấn</span>
          </Button>
          {OPTIMIZER_AVAILABLE ? (
            <Button size="brand" className="flex-1 sm:flex-none" nativeButton={false} render={<Link href={optimizeHref} />}>
              Mở trình tối ưu CV
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger render={<span tabIndex={0} className="grid flex-1 rounded-full sm:flex-none" />}>
                <Button size="brand" disabled>
                  Mở trình tối ưu CV
                  <ArrowRight aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Trình tối ưu CV sắp có</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </BottomActionBar>
  )
}
