import { Badge } from "@/components/ui/badge"
import { MATCH_LABEL_META } from "@/lib/analysis"
import type { MatchLabel } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Badge mức phù hợp Cao / Khá / Trung bình kèm chấm tròn (DESIGN.md mục 8.2). */
export function MatchBadge({ label, prefix, className }: { label: MatchLabel; prefix?: string; className?: string }) {
  const meta = MATCH_LABEL_META[label]
  return (
    <Badge variant={meta.badge} className={cn("h-[22px] px-2", className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {/* "Độ khớp cao" viết thường; "Mức phù hợp: Cao" giữ hoa sau dấu hai chấm */}
      {prefix ? `${prefix} ${prefix.endsWith(":") ? meta.text : meta.text.toLowerCase()}` : meta.text}
    </Badge>
  )
}
