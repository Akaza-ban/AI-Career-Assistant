import type { CvDocLine, CvDocument, OptimizerSession, Suggestion } from "@/lib/types"

/** Dòng câu kinh nghiệm mới (kỹ năng còn thiếu, SV đã áp dụng) trong bản xem trước; id "cap-<mã yêu cầu>". */
export const NEW_LINE_PREFIX = "cap-"

/**
 * Thay các dòng có gợi ý đã chấp nhận / sửa tay bằng nội dung cuối (final_text). Gạch ý bị ngắt dòng khi trích PDF
 * (extra_line_ids) hiển thị gộp thành một dòng, như câu mà gợi ý thay thế (khớp finalize ở backend).
 */
export function applySuggestions(doc: CvDocument, suggestions: Suggestion[]): CvDocument {
  const replaced = new Map(
    suggestions.filter((s) => s.final_text !== null).map((s) => [s.line_id, s.final_text as string] as const),
  )
  const joined = new Map(
    suggestions.filter((s) => s.extra_line_ids?.length).map((s) => [s.line_id, s.original_text] as const),
  )
  const merged = new Set(suggestions.flatMap((s) => s.extra_line_ids ?? []))
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      lines: section.lines
        .filter((line) => !merged.has(line.id))
        .map((line) => ({ ...line, text: replaced.get(line.id) ?? joined.get(line.id) ?? line.text })),
    })),
  }
}

/** Câu kinh nghiệm SV đã áp dụng cho kỹ năng còn thiếu, theo dòng sẽ chèn sau (khớp finalize ở backend). */
export function addedLines(session: Pick<OptimizerSession, "capability_checks" | "entries">) {
  const after = new Map((session.entries ?? []).map((e) => [e.id, e.after_line_id] as const))
  const out = new Map<string, CvDocLine[]>()
  for (const c of session.capability_checks) {
    const target = c.entry_id ? after.get(c.entry_id) : undefined
    if (!c.final_text || !target) continue
    out.set(target, [...(out.get(target) ?? []), { id: `${NEW_LINE_PREFIX}${c.id}`, line_no: -1, text: c.final_text, kind: "bullet" }])
  }
  return out
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
export function draftDocument(
  session: Pick<OptimizerSession, "document" | "suggestions" | "capability_checks" | "entries">,
): CvDocument {
  const applied = applySuggestions(session.document, session.suggestions)
  const added = addedLines(session)
  const doc = {
    ...applied,
    sections: applied.sections.map((section) => ({
      ...section,
      lines: section.lines.flatMap((line) => [line, ...(added.get(line.id) ?? [])]),
    })),
  }
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
