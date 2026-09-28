"use client"

import { Sparkles } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

/** "Còn N lượt phỏng vấn tuần này" (NFR: giới hạn 3 vòng có chấm điểm/tuần). */
export function QuotaPill({ className }: { className?: string }) {
  const { data: quota } = useApi(api.getQuota)

  if (!quota) return <Skeleton className={cn("h-7 w-52 rounded-full", className)} />

  const remaining = Math.max(0, quota.limit - quota.used)
  const exhausted = remaining === 0

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
        exhausted ? "bg-warn-soft text-warn" : "bg-violet-soft text-violet",
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {exhausted ? "Đã hết lượt phỏng vấn tuần này" : `Còn ${remaining} lượt phỏng vấn tuần này`}
    </span>
  )
}
