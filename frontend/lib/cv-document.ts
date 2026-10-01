import type { CvDocument, OptimizerSession, Suggestion } from "@/lib/types"

/** Thay các dòng có gợi ý đã chấp nhận / sửa tay bằng nội dung cuối (final_text). */
export function applySuggestions(doc: CvDocument, suggestions: Suggestion[]): CvDocument {
  const replaced = new Map(
    suggestions.filter((s) => s.final_text !== null).map((s) => [s.line_id, s.final_text as string] as const),
  )
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({ ...line, text: replaced.get(line.id) ?? line.text })),
    })),
  }
}

/** Kỹ năng SV ghi là đang học trong bản nháp (chọn "chưa có kinh nghiệm" và có ghi chú). */
export function learningSkills(session: Pick<OptimizerSession, "capability_checks">) {
  return session.capability_checks
    .filter((c) => c.status === "no_experience" && c.learning_note)
    .map((c) => ({ name: c.skill, note: c.learning_note as string }))
}

/**
 * Nội dung CV nếu "Hoàn tất" ngay bây giờ: câu đã chấp nhận / sửa tay và kỹ năng đang học (không ghi là thành thạo).
 * Khớp cách backend tạo phiên bản mới (src/services/cv_optimizer.py).
 */
export function draftDocument(session: Pick<OptimizerSession, "document" | "suggestions" | "capability_checks">): CvDocument {
  const doc = applySuggestions(session.document, session.suggestions)
  const developing = new Map(doc.developing_skills.map((s) => [s.name.toLowerCase(), s]))
  for (const s of learningSkills(session)) developing.set(s.name.toLowerCase(), s)
  return { ...doc, developing_skills: [...developing.values()] }
}

export function suggestionCounts(suggestions: Suggestion[]) {
  return {
    accepted: suggestions.filter((s) => s.status === "accepted").length,
    edited: suggestions.filter((s) => s.status === "edited").length,
    rejected: suggestions.filter((s) => s.status === "rejected").length,
    pending: suggestions.filter((s) => s.status === "pending").length,
  }
}
