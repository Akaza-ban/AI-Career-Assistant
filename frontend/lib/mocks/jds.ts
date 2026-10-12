// JD theo cấu trúc chung ở chế độ mock (mô phỏng src/services/jds.py và jd_library.py): JD thư viện có đủ các
// trường, JD sinh viên tự dán (JD của bạn) và phần quản trị thư viện JD.

import { ApiError } from "@/lib/api-error"
import { mockJdLibrary } from "@/lib/mocks/data"
import { parseJdText } from "@/lib/mocks/jd-parse"
import type {
  AdminJdDetail,
  AdminJdRow,
  AdminJdUpsert,
  AdminUploadedJd,
  CreatePastedJdRequest,
  JdDraft,
  JdFields,
  JdSkill,
  JobDescription,
} from "@/lib/types"
import { JD_MIN_WORDS } from "@/lib/types"

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Kỹ năng của thư viện (tên + tên gọi khác) để nhận ra kỹ năng trong JD dán vào. */
export function vocabulary(): JdSkill[] {
  const seen = new Map<string, JdSkill>()
  for (const jd of mockJdLibrary) for (const s of jd.skills) if (!seen.has(s.name.toLowerCase())) seen.set(s.name.toLowerCase(), s)
  return [...seen.values()]
}

// Thông tin nhanh của 8 JD mẫu (backend lấy từ toàn văn; ở mock điền sẵn cho đủ)
const FACTS: Record<string, JdFields> = {
  "jd-ba-intern": { location: "Hà Nội", employment_type: "internship", work_mode: "onsite", salary: "Phụ cấp 4 – 5 triệu", experience: "none" },
  "jd-da-intern": { location: "TP. Hồ Chí Minh", employment_type: "internship", work_mode: "hybrid", salary: "Phụ cấp 5 – 6 triệu", experience: "none" },
  "jd-po-assistant": { location: "Hà Nội", employment_type: "full_time", work_mode: "onsite", salary: "12 – 15 triệu", experience: "under_1" },
  "jd-mkt-analyst": { location: "TP. Hồ Chí Minh", employment_type: "full_time", work_mode: "hybrid", salary: "Thoả thuận", experience: "under_1" },
  "jd-xnk-fresher": { location: "Hải Phòng", employment_type: "full_time", work_mode: "onsite", salary: "9 – 12 triệu", experience: "none" },
  "jd-fa-fresher": { location: "Hà Nội", employment_type: "full_time", work_mode: "onsite", salary: "12 – 16 triệu", experience: "under_1" },
  "jd-be-intern": { location: "Đà Nẵng", employment_type: "internship", work_mode: "hybrid", salary: "Phụ cấp 4 triệu", experience: "none" },
  "jd-fe-junior": { location: "TP. Hồ Chí Minh", employment_type: "full_time", work_mode: "hybrid", salary: "15 – 20 triệu", experience: "1_2" },
}

const libraryMeta = new Map<string, { status: "published" | "hidden"; updated_at: string; usage: number; source_jd_id: string | null }>()
mockJdLibrary.forEach((jd, i) => {
  const draft = parseJdText(jd.content, vocabulary())
  Object.assign(jd, {
    description: draft.description,
    requirements: draft.requirements,
    benefits: draft.benefits,
    how_to_apply: draft.how_to_apply,
    majors: draft.majors,
    deadline: null,
    skills_source: "admin",
    ...FACTS[jd.id],
  })
  libraryMeta.set(jd.id, { status: "published", updated_at: ago(30 + i * 4), usage: [64, 51, 22, 17, 4, 12, 28, 9][i] ?? 0, source_jd_id: null })
})

const visible = (jd: JobDescription) => libraryMeta.get(jd.id)?.status !== "hidden"
export const publishedLibrary = () => mockJdLibrary.filter(visible)

// ---------- JD của bạn ----------

let pasted: JobDescription[] = []
export const pastedJds = () => pasted
export const findPasted = (id: string) => pasted.find((j) => j.id === id)

export function parse(text: string): JdDraft {
  if (words(text) < JD_MIN_WORDS) throw new ApiError(422, `Nội dung JD quá ngắn. Hãy dán tối thiểu ${JD_MIN_WORDS} từ.`, "jd_too_short")
  return parseJdText(text, vocabulary())
}

const REQUIRED: (keyof JdFields)[] = ["title", "level", "description", "requirements"]
const LABEL: Partial<Record<keyof JdFields, string>> = {
  title: "tên vị trí",
  level: "cấp bậc",
  description: "mô tả công việc",
  requirements: "yêu cầu ứng viên",
  company: "công ty",
  industry: "ngành",
  employment_type: "hình thức",
  work_mode: "nơi làm việc",
  location: "địa điểm",
  experience: "kinh nghiệm",
}

function requireFields(data: JdFields, fields: (keyof JdFields)[]) {
  const missing = fields.filter((f) => {
    const v = data[f]
    return v === null || v === undefined || (typeof v === "string" && !v.trim())
  })
  if (missing.length) throw new ApiError(422, `Hãy điền ${missing.map((f) => LABEL[f]).join(", ")}.`, "jd_fields_required")
}

const defined = <T extends object>(obj: T) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>

/** Mô phỏng POST /jd: reviewed (hộp Thêm JD) bắt buộc đủ trường chính; dán nhanh chỉ cần tên vị trí. */
export function createPasted(id: string, body: CreatePastedJdRequest): JobDescription {
  if (words(body.text) < JD_MIN_WORDS) {
    throw new ApiError(422, `Nội dung JD quá ngắn (${words(body.text)} từ). Hãy bổ sung tối thiểu ${JD_MIN_WORDS} từ.`, "jd_too_short")
  }
  const draft = parseJdText(body.text, vocabulary())
  const { text, reviewed, skills, skills_source, ...fields } = body
  void skills_source
  const data: JdFields = { ...draft, ...defined(fields) }
  requireFields(data, reviewed ? REQUIRED : ["title"])
  const jd: JobDescription = {
    ...data,
    id,
    title: data.title!.trim(),
    company: data.company?.trim() || null,
    industry: data.industry ?? null,
    level: data.level ?? null,
    content: text,
    skills: skills?.length ? skills : draft.skills,
    skills_source: skills?.length ? (body.skills_source ?? draft.skills_source) : draft.skills_source,
    source: "pasted",
    created_at: new Date().toISOString(),
  }
  pasted = [jd, ...pasted]
  return jd
}

export function updatePasted(id: string, fields: JdFields): JobDescription {
  const jd = findPasted(id)
  if (!jd) throw new ApiError(404, "Không tìm thấy JD.", "jd_not_found")
  const next = { ...jd, ...defined(fields) } as JobDescription
  requireFields(next, REQUIRED)
  pasted = pasted.map((j) => (j.id === id ? next : j))
  return next
}

export function deletePasted(id: string) {
  if (!findPasted(id)) throw new ApiError(404, "Không tìm thấy JD.", "jd_not_found")
  pasted = pasted.filter((j) => j.id !== id)
}

// ---------- Quản trị ----------

const fold = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
const keyOf = (title: string, company: string | null | undefined) => `${fold(title)}|${fold(company)}`

// JD sinh viên khác đã dán (không kèm tên), để tab "JD sinh viên tải lên" có dữ liệu
const OTHER_UPLOADS: AdminUploadedJd[] = [
  { sample_jd_id: "jd-u-1", title: "Business Analyst – Mảng thanh toán", company: "Ví điện tử Z", level: "fresher", skills: [{ name: "SQL", importance: "required" }, { name: "BPMN", importance: "preferred" }, { name: "Jira", importance: "additional" }], student_count: 6, last_added_at: ago(0.1), library_jd_id: null },
  { sample_jd_id: "jd-u-2", title: "Data Analyst Intern", company: "Công ty Bán lẻ Y", level: "intern", skills: [{ name: "SQL", importance: "required" }, { name: "Power BI", importance: "required" }, { name: "Python", importance: "preferred" }], student_count: 4, last_added_at: ago(4), library_jd_id: null },
  { sample_jd_id: "jd-u-3", title: "Frontend Developer Intern", company: "Công ty Phần mềm V", level: "intern", skills: [{ name: "React", importance: "required" }, { name: "TypeScript", importance: "preferred" }], student_count: 3, last_added_at: ago(6), library_jd_id: null },
  { sample_jd_id: "jd-u-4", title: "Content Marketing Intern", company: null, level: "intern", skills: [{ name: "SEO", importance: "preferred" }], student_count: 1, last_added_at: ago(13), library_jd_id: null },
]
const OTHER_TEXT: Record<string, string> = {
  "jd-u-1":
    "Ví điện tử Z tuyển Business Analyst (Fresher) – Mảng thanh toán\nĐịa điểm: Hà Nội\nMức lương: 12 – 15 triệu\n\nMô tả công việc:\n- Làm việc với đội sản phẩm để thu thập và phân tích yêu cầu nghiệp vụ của mảng thanh toán.\n- Viết tài liệu BRD/SRS, vẽ quy trình bằng BPMN, quản lý backlog trên Jira cùng đội phát triển.\n\nYêu cầu:\n- Tốt nghiệp các ngành Hệ thống thông tin, Kinh tế; dưới 1 năm kinh nghiệm.\n- Biết SQL, có khả năng phân tích yêu cầu và trình bày rõ ràng.",
}

export function adminLibrary(): AdminJdRow[] {
  return [...mockJdLibrary]
    .sort((a, b) => a.title.localeCompare(b.title, "vi"))
    .map((jd) => {
      const meta = libraryMeta.get(jd.id)!
      return { id: jd.id, title: jd.title, company: jd.company, industry: jd.industry, level: jd.level, skills: jd.skills, status: meta.status, usage_30d: meta.usage, updated_at: meta.updated_at }
    })
}

export function adminUploaded(): AdminUploadedJd[] {
  const library = new Map(mockJdLibrary.map((jd) => [keyOf(jd.title, jd.company), jd.id]))
  const promoted = new Map([...libraryMeta].filter(([, m]) => m.source_jd_id).map(([id, m]) => [m.source_jd_id!, id]))
  const own: AdminUploadedJd[] = pasted.map((jd) => ({
    sample_jd_id: jd.id,
    title: jd.title,
    company: jd.company,
    level: jd.level,
    skills: jd.skills,
    student_count: 1,
    last_added_at: jd.created_at ?? new Date().toISOString(),
    library_jd_id: null,
  }))
  return [...own, ...OTHER_UPLOADS]
    .map((row) => ({ ...row, library_jd_id: library.get(keyOf(row.title, row.company)) ?? promoted.get(row.sample_jd_id) ?? null }))
    .sort((a, b) => b.student_count - a.student_count || b.last_added_at.localeCompare(a.last_added_at))
}

export function adminGet(id: string): AdminJdDetail {
  const lib = mockJdLibrary.find((j) => j.id === id)
  if (lib) {
    const meta = libraryMeta.get(id)!
    return { ...lib, status: meta.status, source_jd_id: meta.source_jd_id, updated_at: meta.updated_at }
  }
  const own = findPasted(id)
  if (own) return own
  const other = OTHER_UPLOADS.find((u) => u.sample_jd_id === id)
  if (other) {
    const text = OTHER_TEXT[id] ?? `${other.title}\n\nMô tả công việc:\n- Thông tin chi tiết do sinh viên dán.\n\nYêu cầu:\n- ${other.skills.map((s) => s.name).join(", ")}.`
    const draft = parseJdText(text, vocabulary())
    return { ...draft, id, title: other.title, company: other.company, industry: null, level: other.level, skills: other.skills, content: text, source: "pasted" }
  }
  throw new ApiError(404, "Không tìm thấy JD.", "jd_not_found")
}

const ADMIN_REQUIRED: (keyof JdFields)[] = [...REQUIRED, "company", "industry", "employment_type", "work_mode", "location", "experience"]

function checkLibrary(data: JdFields, skills: JdSkill[] | undefined, selfId?: string) {
  requireFields(data, ADMIN_REQUIRED)
  if (!(skills ?? []).some((s) => s.importance === "required")) {
    throw new ApiError(422, "Hãy thêm ít nhất một kỹ năng bắt buộc.", "jd_skills_required")
  }
  const key = keyOf(data.title!, data.company)
  if (mockJdLibrary.some((j) => j.id !== selfId && keyOf(j.title, j.company) === key)) {
    throw new ApiError(409, "Thư viện đã có vị trí cùng tên và công ty.", "jd_duplicate")
  }
}

const compose = (f: JdFields) =>
  [f.title, f.description && `Mô tả công việc:\n${f.description}`, f.requirements && `Yêu cầu ứng viên:\n${f.requirements}`, f.benefits && `Quyền lợi:\n${f.benefits}`]
    .filter(Boolean)
    .join("\n\n")

export function adminCreate(body: AdminJdUpsert): AdminJdDetail {
  const { skills, text, source_jd_id, status, ...fields } = body
  void status
  checkLibrary(fields, skills)
  const now = new Date().toISOString()
  const jd: JobDescription = {
    ...fields,
    id: `jd-${Date.now().toString(36)}`,
    title: fields.title!.trim(),
    company: fields.company ?? null,
    industry: fields.industry ?? null,
    level: fields.level ?? null,
    skills: skills ?? [],
    content: text?.trim() || compose(fields),
    source: "library",
    skills_source: "admin",
    created_at: now,
  }
  mockJdLibrary.push(jd)
  libraryMeta.set(jd.id, { status: "published", updated_at: now, usage: 0, source_jd_id: source_jd_id ?? null })
  return adminGet(jd.id)
}

export function adminUpdate(id: string, body: AdminJdUpsert): AdminJdDetail {
  const index = mockJdLibrary.findIndex((j) => j.id === id)
  if (index < 0) throw new ApiError(404, "Không tìm thấy JD trong thư viện.", "jd_not_found")
  const { skills, text, source_jd_id, status, ...fields } = body
  void text
  void source_jd_id
  const next = { ...mockJdLibrary[index], ...defined(fields), ...(skills ? { skills } : {}) } as JobDescription
  if (Object.keys(defined(fields)).length || skills) checkLibrary(next, next.skills, id)
  mockJdLibrary[index] = next
  const meta = libraryMeta.get(id)!
  libraryMeta.set(id, { ...meta, status: status ?? meta.status, updated_at: new Date().toISOString() })
  return adminGet(id)
}
