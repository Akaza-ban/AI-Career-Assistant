// Tách toàn văn JD trong thư viện thành các mục để hiển thị. Thư viện chưa có trường riêng cho mô tả / yêu cầu /
// quyền lợi (DESIGN.md mục 12) nên dựa vào tiêu đề dạng "Mô tả công việc:" ở đầu mỗi đoạn.

export type JdSectionKind = "overview" | "description" | "required" | "preferred" | "additional" | "benefits" | "other"

export interface JdSection {
  kind: JdSectionKind
  /** Tiêu đề gốc trong JD; null với đoạn mở đầu. */
  title: string | null
  paragraphs: string[]
  bullets: string[]
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()

function kindOf(title: string): JdSectionKind {
  const t = fold(title)
  if (t.includes("mo ta")) return "description"
  if (t.includes("quyen loi") || t.includes("phuc loi")) return "benefits"
  if (t.includes("uu tien")) return "preferred"
  if (t.includes("diem cong") || t.includes("cong them")) return "additional"
  if (t.includes("bat buoc") || t.includes("yeu cau")) return "required"
  return "other"
}

const HEADING = /^([^:.\-•][^:.]{1,40}):\s*(.*)$/
const BULLET = /^[-•*]\s+/

export function parseJdContent(content: string): JdSection[] {
  const sections: JdSection[] = []
  for (const block of content.split(/\n\s*\n/)) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    const heading = lines[0].match(HEADING)
    let section: JdSection
    let body: string[]
    if (heading) {
      section = { kind: kindOf(heading[1]), title: heading[1].trim(), paragraphs: [], bullets: [] }
      body = [heading[2], ...lines.slice(1)].filter(Boolean)
      sections.push(section)
    } else if (sections.length === 0) {
      section = { kind: "overview", title: null, paragraphs: [], bullets: [] }
      body = lines
      sections.push(section)
    } else {
      section = sections[sections.length - 1]
      body = lines
    }
    for (const line of body) {
      if (BULLET.test(line)) section.bullets.push(line.replace(BULLET, ""))
      else section.paragraphs.push(line)
    }
  }
  return sections
}
