// Nhãn và tiện ích cho cấu trúc chung của JD (giống src/services/jd_parser.py).

import type { EmploymentType, ExperienceLevel, JdFields, JobLevel, WorkMode } from "@/lib/types"

export const JD_INDUSTRIES = [
  "Công nghệ & phần mềm",
  "Thương mại điện tử",
  "Fintech & ngân hàng",
  "Tài chính – đầu tư",
  "Kế toán – kiểm toán",
  "Truyền thông số",
  "Marketing & bán hàng",
  "Logistics & chuỗi cung ứng",
  "Nhân sự",
  "Giáo dục",
  "Sản xuất",
  "Khác",
] as const

export const LEVEL_LABEL: Record<JobLevel, string> = { intern: "Thực tập", fresher: "Fresher", junior: "Junior" }
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  internship: "Thực tập",
}
export const WORK_MODE_LABEL: Record<WorkMode, string> = { onsite: "Tại văn phòng", remote: "Từ xa", hybrid: "Kết hợp" }
export const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = {
  none: "Không yêu cầu",
  under_1: "Dưới 1 năm",
  "1_2": "1 – 2 năm",
  "2_plus": "Từ 2 năm",
}

export const options = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }))

/** "2026-10-30" → "30/10/2026" */
export const formatYmd = (ymd: string) => ymd.split("-").reverse().join("/")

/** "30/10/2026" → "2026-10-30"; sai định dạng → null. */
export function parseDmy(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`
  return Number.isNaN(Date.parse(iso)) ? null : iso
}

/** Dải thông tin nhanh ở trang chi tiết: chỉ các trường có giá trị. */
export function jdFacts(jd: JdFields): { label: string; value: string }[] {
  const facts: [string, string | null | undefined][] = [
    ["Địa điểm", jd.location],
    ["Hình thức", jd.employment_type ? EMPLOYMENT_LABEL[jd.employment_type] : null],
    ["Nơi làm việc", jd.work_mode ? WORK_MODE_LABEL[jd.work_mode] : null],
    ["Mức lương", jd.salary],
    ["Kinh nghiệm", jd.experience ? EXPERIENCE_LABEL[jd.experience] : null],
    ["Hạn nộp", jd.deadline ? formatYmd(jd.deadline) : null],
  ]
  return facts.flatMap(([label, value]) => (value ? [{ label, value }] : []))
}

/** Các dòng của một mục: bỏ gạch đầu dòng; dòng kết thúc bằng ":" là tiêu đề nhỏ (ví dụ "Ưu tiên:"). */
export function sectionLines(text: string | null | undefined): { text: string; bullet: boolean; heading: boolean }[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const bullet = /^[-–•*+]\s+/.test(l)
      const clean = l.replace(/^[-–•*+]\s+/, "")
      return { text: clean, bullet, heading: !bullet && clean.endsWith(":") && clean.length <= 40 }
    })
}

/** Số trường không bắt buộc (với sinh viên) đã có giá trị, cho dòng tóm tắt "Thông tin thêm". */
export const OPTIONAL_FIELDS = [
  "company",
  "industry",
  "employment_type",
  "work_mode",
  "location",
  "salary",
  "experience",
  "deadline",
  "majors",
  "benefits",
] as const satisfies readonly (keyof JdFields)[]
