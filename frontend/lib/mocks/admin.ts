// Dữ liệu mock của trang Quản trị (mô phỏng src/services/admin.py): các cố vấn, SV chưa phân công và số liệu
// toàn hệ thống. SV do cố vấn demo phụ trách lấy từ nhóm SV giả định ở lib/mocks/advisor.ts.

import { ApiError } from "@/lib/api-error"
import { REASON_LABELS } from "@/lib/feedback"
import { isStrongPassword } from "@/lib/password"
import type {
  AdminAdvisor,
  AdminComment,
  AdminCommentsPage,
  AdminCommentsQuery,
  AdminPeriod,
  AdminStats,
  AdminStudent,
  AssignAdvisorResponse,
  CreateAdvisorRequest,
  CsatActivity,
  UpdateAdvisorRequest,
  UserProfile,
} from "@/lib/types"

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

export const mockAdmin: UserProfile = {
  id: "qt-001",
  role: "admin",
  full_name: "Quản trị CareerV",
  subtitle: "Quản trị hệ thống",
  avatar_url: null,
}

export const DEMO_ADVISOR_ID = "cv-007"

interface StoredAdvisor extends Omit<AdminAdvisor, "student_count" | "pending_reviews" | "status"> {
  disabled: boolean
  /** Còn mật khẩu tạm: phải đổi ở lần đăng nhập tới. */
  mustChange: boolean
  /** Buổi chờ nhận xét (cố vấn demo: tính từ nhóm SV giả định). */
  pending: number
  /** null = dùng mật khẩu chung của tài khoản demo. */
  password: string | null
}

const advisors: StoredAdvisor[] = [
  {
    id: DEMO_ADVISOR_ID,
    full_name: "ThS. Trần Hoàng Nam",
    email: "nam.tran@careerx.vn",
    title: "Cố vấn hướng nghiệp",
    avatar_url: null,
    disabled: false,
    mustChange: false,
    last_active_at: ago(0.04),
    created_at: ago(220),
    pending: 0,
    password: null,
  },
  {
    id: "cv-008",
    full_name: "Lê Thu Hà",
    email: "ha.le@careerx.vn",
    title: "Cố vấn hướng nghiệp",
    avatar_url: null,
    disabled: false,
    mustChange: false,
    last_active_at: ago(1),
    created_at: ago(180),
    pending: 3,
    password: "careerx123",
  },
  {
    id: "cv-009",
    full_name: "Võ Minh Đức",
    email: "duc.vo@careerx.vn",
    title: "Cố vấn ngành CNTT",
    avatar_url: null,
    disabled: false,
    mustChange: false,
    last_active_at: ago(3),
    created_at: ago(150),
    pending: 1,
    password: "careerx123",
  },
  {
    id: "cv-010",
    full_name: "Phạm Quỳnh",
    email: "quynh.pham@careerx.vn",
    title: "Cố vấn ngành Kinh tế",
    avatar_url: null,
    disabled: false,
    mustChange: true,
    last_active_at: null,
    created_at: ago(2),
    pending: 0,
    password: "Careerx-5T8K1",
  },
  {
    id: "cv-011",
    full_name: "Đặng Khánh",
    email: "khanh.dang@careerx.vn",
    title: "Cố vấn hướng nghiệp",
    avatar_url: null,
    disabled: true,
    mustChange: false,
    last_active_at: ago(25),
    created_at: ago(300),
    pending: 0,
    password: "careerx123",
  },
]

interface StoredStudent extends Omit<AdminStudent, "advisor"> {
  advisor_id: string | null
}

// SV của các cố vấn khác và SV mới đăng ký đang chờ phân công
const OTHER_STUDENTS: [string, string, string, string | null, number, number | null][] = [
  ["sv-0171", "Hoàng Minh Thu", "hoangthu.ng@gmail.com", null, 0, 0],
  ["sv-0172", "Phan Văn Long", "longphan.dev@gmail.com", null, 1, 1],
  ["sv-0173", "Ngô Tường Vy", "vy.ngo@outlook.com", null, 2, 2],
  ["sv-0174", "Trịnh Minh Quân", "quan.trinh@gmail.com", null, 3, null],
  ["sv-0175", "Lý Thanh Mai", "mai.ly02@gmail.com", null, 4, 5],
  ["sv-0161", "Bùi Gia Bảo", "giabao.bui@gmail.com", "cv-008", 40, 1],
  ["sv-0162", "Đỗ Khánh Linh", "khanhlinh.do@gmail.com", "cv-008", 38, 4],
  ["sv-0163", "Vương Hải Đăng", "haidang.vuong@gmail.com", "cv-008", 33, 9],
  ["sv-0164", "Tạ Ngọc Hân", "ngochan.ta@outlook.com", "cv-009", 30, 2],
  ["sv-0165", "Mai Tuấn Kiệt", "tuankiet.mai@gmail.com", "cv-009", 26, 6],
  ["sv-0166", "Châu Bảo Ngọc", "baongoc.chau@gmail.com", "cv-009", 21, 12],
  ["sv-0167", "Kiều Anh Tú", "anhtu.kieu@gmail.com", "cv-010", 15, 3],
  ["sv-0168", "La Phương Thảo", "phuongthao.la@gmail.com", "cv-011", 60, 28],
]
const PHONES = ["0901 223 445", "0938 112 907", "0977 450 128", "0912 908 331", "0965 001 276", "0983 554 102"]

const students: StoredStudent[] = OTHER_STUDENTS.map(([id, full_name, email, advisor_id, created, active], i) => ({
  id,
  full_name,
  email,
  phone: PHONES[i % PHONES.length],
  avatar_url: null,
  advisor_id,
  created_at: ago(created + 0.2),
  last_active_at: active === null ? null : ago(active),
}))

/** Nhóm SV giả định của cố vấn demo, thêm vào danh sách ở lần gọi đầu (giữ phân công đã đổi ở các lần sau). */
export interface CohortProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  last_active_at: string | null
}

function sync(cohort: CohortProfile[]) {
  cohort.forEach((p, i) => {
    if (students.some((s) => s.id === p.id)) return
    students.push({ ...p, advisor_id: DEMO_ADVISOR_ID, created_at: ago(120 - i * 6) })
  })
}

function advisorOut(a: StoredAdvisor): AdminAdvisor {
  return {
    id: a.id,
    full_name: a.full_name,
    email: a.email,
    title: a.title,
    avatar_url: a.avatar_url,
    student_count: students.filter((s) => s.advisor_id === a.id).length,
    pending_reviews: a.pending,
    status: a.disabled ? "disabled" : a.mustChange ? "password_pending" : "active",
    last_active_at: a.last_active_at,
    created_at: a.created_at,
  }
}

function findAdvisor(id: string): StoredAdvisor {
  const advisor = advisors.find((a) => a.id === id)
  if (!advisor) throw new ApiError(404, "Không tìm thấy cố vấn.", "advisor_not_found")
  return advisor
}

const normalize = (email: string) => email.trim().toLowerCase()

function checkEmailFree(email: string, id?: string) {
  const value = normalize(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new ApiError(422, "Email chưa đúng định dạng.", "invalid_email")
  const taken = advisors.some((a) => a.email === value && a.id !== id) || students.some((s) => s.email === value)
  if (taken || value === "minhanh.nguyen@gmail.com" || value === "admin@careerx.vn") {
    throw new ApiError(409, "Email này đã có tài khoản.", "email_taken")
  }
  return value
}

function checkPassword(password: string) {
  if (!isStrongPassword(password)) {
    throw new ApiError(422, "Mật khẩu cần ít nhất 8 ký tự, có cả chữ và số, không có khoảng trắng.", "weak_password")
  }
}

const cleanName = (name: string) => name.split(/\s+/).filter(Boolean).join(" ")

// ---------- Tài khoản cố vấn (dùng cho đăng nhập mock) ----------

export function mockAdvisorAccount(email: string): StoredAdvisor | undefined {
  return advisors.find((a) => a.email === normalize(email))
}

/** Đổi mật khẩu tạm → mật khẩu mới; trả về false nếu mật khẩu tạm không đúng. */
export function setAdvisorPassword(email: string, current: string, next: string, demoPassword: string): boolean {
  const advisor = mockAdvisorAccount(email)
  if (!advisor || (advisor.password ?? demoPassword) !== current) return false
  advisor.password = next
  advisor.mustChange = false
  return true
}

export function advisorProfile(a: StoredAdvisor): UserProfile {
  return { id: a.id, role: "advisor", full_name: a.full_name, subtitle: a.title, avatar_url: a.avatar_url }
}

// ---------- API ----------

export function listAdvisors(cohort: CohortProfile[], demoPending: number): AdminAdvisor[] {
  sync(cohort)
  advisors[0].pending = demoPending
  return [...advisors].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")).map(advisorOut)
}

export function createAdvisor(body: CreateAdvisorRequest): AdminAdvisor {
  const full_name = cleanName(body.full_name)
  if (full_name.length < 2) throw new ApiError(422, "Hãy nhập họ và tên (2–120 ký tự).", "invalid_full_name")
  const email = checkEmailFree(body.email)
  const title = cleanName(body.title)
  if (!title) throw new ApiError(422, "Hãy nhập chức danh (tối đa 120 ký tự).", "invalid_title")
  checkPassword(body.temporary_password)
  const advisor: StoredAdvisor = {
    id: `cv-${Date.now().toString(36)}`,
    full_name,
    email,
    title,
    avatar_url: null,
    disabled: false,
    mustChange: true,
    last_active_at: null,
    created_at: new Date().toISOString(),
    pending: 0,
    password: body.temporary_password,
  }
  advisors.push(advisor)
  return advisorOut(advisor)
}

export function updateAdvisor(id: string, body: UpdateAdvisorRequest): AdminAdvisor {
  const advisor = findAdvisor(id)
  if (body.full_name !== undefined) advisor.full_name = cleanName(body.full_name)
  if (body.email !== undefined) advisor.email = checkEmailFree(body.email, id)
  if (body.title !== undefined) advisor.title = cleanName(body.title)
  if (body.disabled !== undefined) advisor.disabled = body.disabled
  return advisorOut(advisor)
}

export function resetAdvisorPassword(id: string, temporaryPassword: string): AdminAdvisor {
  const advisor = findAdvisor(id)
  checkPassword(temporaryPassword)
  advisor.password = temporaryPassword
  advisor.mustChange = true
  return advisorOut(advisor)
}

export function listStudents(cohort: CohortProfile[]): AdminStudent[] {
  sync(cohort)
  return [...students]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ advisor_id, ...rest }) => {
      const advisor = advisors.find((a) => a.id === advisor_id)
      return {
        ...rest,
        advisor: advisor ? { id: advisor.id, full_name: advisor.full_name, disabled: advisor.disabled } : null,
      }
    })
}

export function assign(studentIds: string[], advisorId: string): AssignAdvisorResponse {
  const advisor = findAdvisor(advisorId)
  if (advisor.disabled) throw new ApiError(409, "Cố vấn này đang bị tạm khoá.", "advisor_disabled")
  const picked = [...new Set(studentIds)].map((id) => {
    const student = students.find((s) => s.id === id)
    if (!student) throw new ApiError(404, "Không tìm thấy sinh viên.", "student_not_found")
    return student
  })
  const changed = picked.filter((s) => s.advisor_id !== advisorId)
  for (const s of changed) s.advisor_id = advisorId
  return { assigned: changed.length, unchanged: picked.length - changed.length }
}

// Lượt dùng theo tuần (7 tuần, cũ → mới) và số liệu theo kỳ
const WEEKLY = [
  [27, 18],
  [34, 22],
  [31, 25],
  [41, 30],
  [38, 33],
  [51, 37],
  [47, 41],
]
const PERIOD: Record<AdminPeriod, { analyses: number; analyses_change: number; interviews: number; interviews_change: number; optimized: number; csat: number[] }> = {
  7: { analyses: 47, analyses_change: -7.8, interviews: 41, interviews_change: 10.8, optimized: 14, csat: [0, 1, 2, 9, 16] },
  30: { analyses: 312, analyses_change: 18, interviews: 205, interviews_change: 11, optimized: 88, csat: [4, 7, 17, 58, 100] },
  90: { analyses: 806, analyses_change: 42.5, interviews: 512, interviews_change: 35.1, optimized: 201, csat: [11, 19, 44, 150, 247] },
}
// Mới nhất trước: (số sao, hoạt động, nhận xét hoặc null, số ngày trước, lý do khi 1–3 sao)
const COMMENTS: [number, CsatActivity, string | null, number, string[]][] = [
  [5, "interview", "Câu hỏi sát với vị trí, phần gợi ý cải thiện Kết quả rất dễ làm theo.", 0.08, []],
  [3, "optimizer", "Một vài câu viết lại nghe hơi máy móc, mình phải sửa lại.", 0.2, ["unnatural"]],
  [4, "gap_analysis", "Chỉ ra đúng kỹ năng còn thiếu, mong có thêm ví dụ câu viết lại.", 1, []],
  [2, "gap_analysis", "Phần kỹ năng bắt buộc chưa nhắc tới Jira dù JD có ghi.", 2, ["off_target", "generic"]],
  [1, "interview", null, 3, ["too_short", "technical"]],
  [5, "optimizer", "Thích việc tự điền số liệu, CV mới đọc rõ ràng hơn hẳn.", 3, []],
  [3, "interview", "Câu tình huống cần nghĩ lâu hơn 2 phút.", 6, ["too_short"]],
  [4, "interview", "Phần chấm STAR dễ hiểu, nhưng thời gian mỗi câu hơi ngắn.", 11, []],
  [5, "gap_analysis", "Biết rõ CV đang thiếu gì so với JD, đỡ phải đoán.", 19, []],
  [2, "optimizer", null, 27, ["generic"]],
  [4, "gap_analysis", "Gợi ý viết lại câu kinh nghiệm rất sát, mong có thêm mẫu cho ngành kinh tế.", 41, []],
  [5, "interview", "Luyện 3 buổi thấy tự tin hơn hẳn khi đi phỏng vấn thật.", 64, []],
]

const commentOut = ([value, activity, comment, d, tags]: (typeof COMMENTS)[number], i: number): AdminComment => ({
  id: `fb_mock_${i}`,
  value,
  activity,
  comment,
  tags: tags.map((reason) => ({ reason, label: REASON_LABELS[reason] ?? reason })),
  created_at: ago(d),
})

/** Lý do chưa hài lòng trong kỳ (số liệu mẫu lớn hơn số nhận xét mẫu ở trên). */
const REASON_COUNTS: [string, CsatActivity[], number][] = [
  ["off_target", ["gap_analysis"], 11],
  ["generic", ["gap_analysis", "optimizer"], 9],
  ["too_short", ["interview"], 7],
  ["unnatural", ["optimizer"], 5],
  ["unfair_score", ["interview"], 4],
]

export function listComments(query: AdminCommentsQuery): AdminCommentsPage {
  const rows = COMMENTS.map(commentOut).filter((_, i) => {
    const [value, activity, , d, tags] = COMMENTS[i]
    return (
      (!query.days || d <= query.days) &&
      (!query.stars || value === query.stars) &&
      (!query.activity || activity === query.activity) &&
      (!query.reason || tags.includes(query.reason))
    )
  })
  const offset = query.offset ?? 0
  return { total: rows.length, items: rows.slice(offset, offset + (query.limit ?? 20)) }
}

function mondayOf(weeksAgo: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function stats(days: AdminPeriod, cohort: CohortProfile[]): AdminStats {
  sync(cohort)
  const p = PERIOD[days]
  const total = students.length
  const unassigned = students.filter((s) => !s.advisor_id).length
  const since = Date.now() - days * DAY
  const active = students.filter((s) => s.last_active_at && new Date(s.last_active_at).getTime() >= since).length
  const createdBy = (weeksAgo: number) =>
    students.filter((s) => new Date(s.created_at).getTime() <= Date.now() - weeksAgo * 7 * DAY).length
  const count = p.csat.reduce((sum, n) => sum + n, 0)
  return {
    days,
    users: {
      student_count: total,
      new_students_week: students.filter((s) => new Date(s.created_at).getTime() >= Date.now() - 7 * DAY).length,
      student_series: [6, 5, 4, 3, 2, 1, 0].map(createdBy),
      active_count: active,
      active_series: [0.55, 0.6, 0.66, 0.72, 0.8, 0.9, 1].map((r) => Math.round(active * r)),
      advisor_count: advisors.filter((a) => !a.disabled).length,
      assigned_count: total - unassigned,
      unassigned_count: unassigned,
    },
    usage: {
      weekly: WEEKLY.map(([analyses, interviews], i) => ({ week_start: mondayOf(6 - i), analyses, interviews })),
      analyses: p.analyses,
      analyses_change: p.analyses_change,
      interviews: p.interviews,
      interviews_change: p.interviews_change,
      optimized_cvs: p.optimized,
    },
    satisfaction: {
      csat: count ? Math.round((p.csat.reduce((sum, n, i) => sum + n * (i + 1), 0) / count) * 100) / 100 : null,
      count,
      target: 4,
      distribution: { "1": p.csat[0], "2": p.csat[1], "3": p.csat[2], "4": p.csat[3], "5": p.csat[4] },
      low_count: p.csat[0] + p.csat[1] + p.csat[2],
      reasons: REASON_COUNTS.map(([reason, activities, n]) => ({
        reason,
        label: REASON_LABELS[reason],
        activities,
        count: Math.max(1, Math.round((n * days) / 30)),
      })),
      helpful: [
        { activity: "gap_suggestion", label: "Gợi ý sửa CV", likes: Math.round(338 * (days / 30)), total: Math.round(412 * (days / 30)) },
        { activity: "interview_turn", label: "Nhận xét từng câu phỏng vấn", likes: Math.round(219 * (days / 30)), total: Math.round(288 * (days / 30)) },
        { activity: "job_recommendation", label: "Gợi ý vị trí", likes: Math.round(98 * (days / 30)), total: Math.round(153 * (days / 30)) },
        { activity: "jd_compare", label: "So sánh nhiều vị trí", likes: Math.round(29 * (days / 30)), total: Math.round(41 * (days / 30)) },
      ],
    },
    recent_comments: COMMENTS.map(commentOut).slice(0, 4),
  }
}
