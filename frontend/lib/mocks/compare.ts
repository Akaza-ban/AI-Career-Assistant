// Mock cho So sánh nhiều vị trí (POST /jd/compare). JD tự dán ở lib/mocks/jds.ts.
// Mô phỏng src/services/jd_recommendation.compare_selected_jds_with_llm: chấm từng JD theo PRD 5.2, sắp giảm dần,
// kèm nhận xét ngắn và danh sách kỹ năng thiếu ở mọi JD.

import { recommendFromProfile, skillProfileOf } from "@/lib/mocks/library"
import type { CompareJdsResponse, JdComparisonItem, JobDescription, MatchLabel } from "@/lib/types"

const joinVi = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} và ${items[items.length - 1]}`

function summaryFor(item: Omit<JdComparisonItem, "llm_summary" | "llm_used" | "rank">, rank: number): string {
  const strong = item.matched_skills.slice(0, 2)
  const lead =
    rank === 1
      ? `Khớp tốt nhất trong các vị trí đã chọn${strong.length ? ` nhờ ${joinVi(strong)}` : ""}.`
      : strong.length
        ? `Có nền tảng ${joinVi(strong)}.`
        : "CV chưa thể hiện nhiều kỹ năng vị trí này cần."
  const gaps: string[] = []
  if (item.missing_skills.length) gaps.push(`còn thiếu ${joinVi(item.missing_skills.slice(0, 2))}`)
  if (item.partial_skills.length) gaps.push(`${joinVi(item.partial_skills.slice(0, 2))} mới chỉ được liệt kê`)
  return gaps.length ? `${lead} Tuy vậy ${gaps.join(", ")}.` : `${lead} Đã đáp ứng hầu hết yêu cầu.`
}

export function compareFromProfile(
  jds: JobDescription[],
  familyId: string,
  cv: { id: string; label: string; file_name: string },
): CompareJdsResponse {
  const scored = recommendFromProfile(jds, skillProfileOf(familyId), jds.length)
  const comparisons: JdComparisonItem[] = scored.map((item, i) => {
    const base = {
      jd_id: item.jd_id,
      title: item.title,
      company: item.company,
      industry: item.industry,
      level: item.level,
      match_score: item.match_score ?? 0,
      match_label: (item.match_label ?? "low") as MatchLabel,
      matched_skills: item.matched_skills,
      partial_skills: item.partial_skills,
      missing_skills: item.missing_skills,
      breakdown: item.breakdown,
    }
    return { ...base, rank: i + 1, llm_summary: summaryFor(base, i + 1), llm_used: true }
  })
  const common = comparisons.reduce<string[] | null>(
    (acc, c) => (acc === null ? [...c.missing_skills] : acc.filter((s) => c.missing_skills.includes(s))),
    null,
  )
  return {
    cv_version_id: cv.id,
    cv_label: cv.label,
    cv_name: cv.file_name,
    total_compared: comparisons.length,
    comparisons,
    common_missing_skills: common ?? [],
  }
}
