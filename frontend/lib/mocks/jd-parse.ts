// Tách toàn văn JD cho chế độ mock (rút gọn từ src/services/jd_parser.py, chỉ phần quy tắc, không gọi AI).

import type { EmploymentType, ExperienceLevel, JdDraft, JdSkill, JobLevel, WorkMode } from "@/lib/types"

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()

type Section = "intro" | "description" | "requirements" | "preferred" | "additional" | "benefits" | "how_to_apply"

const HEADINGS: [Section, string[]][] = [
  ["preferred", ["uu tien", "nice to have", "preferred"]],
  ["additional", ["diem cong", "cong them", "plus"]],
  ["benefits", ["quyen loi", "phuc loi", "che do", "dai ngo", "benefit"]],
  ["how_to_apply", ["cach ung tuyen", "nop ho so", "lien he", "how to apply"]],
  ["requirements", ["yeu cau", "tieu chuan", "bat buoc", "requirement", "qualification"]],
  ["description", ["mo ta", "trach nhiem", "nhiem vu", "cong viec", "job description", "responsibilit"]],
  ["intro", ["gioi thieu", "ve chung toi", "about"]],
]
const HEADING_LINE = /^[\s\-–•*#>\d.)]*([^:]{2,60}?)\s*:\s*(.*)$/
const BULLET = /^\s*[-–•*+]\s+/

function sectionOf(heading: string): Section | null {
  const key = fold(heading).trim()
  for (const [kind, words] of HEADINGS) if (words.some((w) => key.startsWith(w))) return kind
  return null
}

function splitSections(text: string): Partial<Record<Section, string[]>> {
  const out: Partial<Record<Section, string[]>> = {}
  let current: Section = "intro"
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(HEADING_LINE)
    let kind = m ? sectionOf(m[1]) : null
    let rest = m && kind ? m[2].trim() : ""
    if (!kind && line.length <= 60 && !BULLET.test(line)) {
      kind = sectionOf(line.replace(/:$/, ""))
      rest = ""
    }
    if (kind) {
      current = kind
      out[current] ??= []
      if (rest) out[current]!.push(rest)
      continue
    }
    ;(out[current] ??= []).push(line)
  }
  return out
}

const LABELS: [string, string[]][] = [
  ["title", ["vi tri", "chuc danh", "position"]],
  ["company", ["cong ty", "company"]],
  ["location", ["dia diem", "noi lam viec", "location"]],
  ["salary", ["muc luong", "luong", "thu nhap", "salary"]],
  ["deadline", ["han nop", "han chot", "deadline"]],
  ["employment_type", ["hinh thuc", "loai hinh"]],
  ["experience", ["kinh nghiem", "experience"]],
]

function labeled(text: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(HEADING_LINE)
    if (!m || !m[2].trim()) continue
    const key = fold(m[1]).trim()
    for (const [field, words] of LABELS) {
      if (!(field in found) && words.some((w) => key === w || key.startsWith(w + " "))) found[field] = m[2].trim()
    }
  }
  return found
}

function firstOf<T extends string>(text: string, rules: [T, string[]][]): T | null {
  const f = fold(text)
  for (const [value, words] of rules) if (words.some((w) => f.includes(w))) return value
  return null
}

const LEVEL_RULES: [JobLevel, string[]][] = [
  ["intern", ["thuc tap", "intern"]],
  ["fresher", ["fresher", "moi tot nghiep", "moi ra truong"]],
  ["junior", ["junior"]],
]
const EMPLOYMENT_RULES: [EmploymentType, string[]][] = [
  ["part_time", ["ban thoi gian", "part-time", "part time"]],
  ["internship", ["thuc tap", "internship"]],
  ["full_time", ["toan thoi gian", "full-time", "full time"]],
]
const WORK_MODE_RULES: [WorkMode, string[]][] = [
  ["hybrid", ["hybrid", "ket hop", "linh hoat"]],
  ["remote", ["remote", "tu xa"]],
  ["onsite", ["tai van phong", "onsite", "on-site"]],
]
const EXPERIENCE_RULES: [ExperienceLevel, string[]][] = [
  ["none", ["khong yeu cau kinh nghiem", "chua co kinh nghiem"]],
  ["under_1", ["duoi 1 nam", "6 thang"]],
  ["1_2", ["1 - 2 nam", "1-2 nam", "tu 1 nam"]],
  ["2_plus", ["2 nam", "3 nam"]],
]

function titleAndCompany(text: string): [string | null, string | null] {
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  if (!first || HEADING_LINE.test(first) || sectionOf(first.replace(/:$/, ""))) return [null, null]
  const m = first.match(/^(.{2,80}?)\s+tuyển(?:\s+dụng)?\s+(.+)$/i)
  if (m) return [m[2].split(/\s+(?:làm việc|cho|tại)\s+|[.;]/)[0].replace(/^[\s,–-]+|[\s,–-]+$/g, "") || null, m[1].trim()]
  return [first.length <= 120 ? first : null, null]
}

function majorsOf(requirements: string): string[] {
  const m = requirements.match(/(?:chuyên\s+)?ngành\s+([^.;\n]+)/i)
  if (!m) return []
  return [
    ...new Set(
      m[1]
        .split(/,|\bhoặc\b|\bvà\b|\//)
        .map((p) => p.trim().replace(/^[-–\s]+/, ""))
        .filter((p) => p.length >= 2 && p.length <= 40 && !p.toLowerCase().includes("liên quan"))
        .map((p) => p[0].toUpperCase() + p.slice(1)),
    ),
  ].slice(0, 6)
}

const join = (lines: string[] = []) => lines.map((l) => (BULLET.test(l) ? l : `- ${l}`)).join("\n")

/** Bản nháp đầy đủ các trường; vocabulary = kỹ năng của thư viện (tên + tên gọi khác). */
export function parseJdText(text: string, vocabulary: JdSkill[]): JdDraft {
  const content = text.replace(/\r\n/g, "\n").trim()
  const sections = splitSections(content)
  const labels = labeled(content)
  const [guessTitle, guessCompany] = titleAndCompany(content)
  const title = labels.title ?? guessTitle
  const requirementLines = [...(sections.requirements ?? [])]
  if (sections.preferred?.length) requirementLines.push("Ưu tiên:", ...sections.preferred)
  if (sections.additional?.length) requirementLines.push("Điểm cộng:", ...sections.additional)
  const requirements = requirementLines.map((l) => (l.endsWith(":") || BULLET.test(l) ? l : `- ${l}`)).join("\n")
  const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) ?? ""
  const intro = (sections.intro ?? []).filter((l) => !(title && l === firstLine) && !HEADING_LINE.test(l) && l.length > 30)
  let description = [...intro, join(sections.description)].filter(Boolean).join("\n")
  if (!description && !requirements) description = content

  const hasRequirements = Boolean(sections.requirements?.length)
  const order: [Section, JdSkill["importance"]][] = [
    ["requirements", "required"],
    ["preferred", "preferred"],
    ["additional", "additional"],
    ["description", "preferred"],
    ["intro", "additional"],
  ]
  const skills: JdSkill[] = []
  for (const skill of vocabulary) {
    const terms = [skill.name, ...(skill.aliases ?? [])].map(fold)
    for (const [section, importance] of order) {
      const body = fold((sections[section] ?? []).join("\n"))
      if (body && terms.some((t) => body.includes(t))) {
        skills.push({ name: skill.name, importance: hasRequirements ? importance : "required", aliases: skill.aliases ?? [] })
        break
      }
    }
  }
  const dl = (labels.deadline ?? "").match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  const salary = labels.salary?.match(/\d[\d.,]*\s*(?:-|–|~|đến)\s*\d[\d.,]*\s*(?:triệu|tr\b|usd|\$)|th[oỏ]a thu[aậ]n|cạnh tranh/i)
  return {
    title,
    company: labels.company ?? guessCompany,
    level: firstOf(`${title ?? ""}`, LEVEL_RULES) ?? firstOf(content, LEVEL_RULES),
    industry: null,
    employment_type: firstOf(labels.employment_type ?? "", EMPLOYMENT_RULES) ?? firstOf(content, EMPLOYMENT_RULES),
    work_mode: firstOf(content, WORK_MODE_RULES),
    location: labels.location ? labels.location.split(/\s*[·•|]\s*/)[0] : null,
    salary: salary ? salary[0] : null,
    deadline: dl ? `${dl[3]}-${dl[2].padStart(2, "0")}-${dl[1].padStart(2, "0")}` : null,
    experience: firstOf(labels.experience ?? requirements, EXPERIENCE_RULES),
    majors: majorsOf(requirements),
    description: description || null,
    requirements: requirements || null,
    benefits: join(sections.benefits) || null,
    how_to_apply: join(sections.how_to_apply) || null,
    skills,
    skills_source: hasRequirements ? "sections" : "dictionary",
    used_ai: false,
    word_count: content.split(/\s+/).filter(Boolean).length,
  }
}
