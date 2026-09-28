import type { CvDocument, Suggestion } from "@/lib/types"

/** Áp các gợi ý đã chấp nhận / sửa tay vào nội dung CV để ra bản cuối (dùng cho Xuất CV). */
export function applySuggestions(doc: CvDocument, suggestions: Suggestion[]): CvDocument {
  const replaced = new Map(
    suggestions
      .filter((s) => s.status === "accepted" || s.status === "edited")
      .map((s) => [s.line_id, s.proposed_text] as const),
  )
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => ({
        ...entry,
        lines: entry.lines.map((line) => ({ ...line, text: replaced.get(line.id) ?? line.text })),
      })),
    })),
  }
}

export function suggestionCounts(suggestions: Suggestion[]) {
  return {
    accepted: suggestions.filter((s) => s.status === "accepted").length,
    edited: suggestions.filter((s) => s.status === "edited").length,
    rejected: suggestions.filter((s) => s.status === "rejected").length,
    pending: suggestions.filter((s) => s.status === "pending").length,
  }
}
