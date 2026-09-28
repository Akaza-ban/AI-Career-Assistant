// Dữ liệu minh hoạ phía cố vấn. Cờ "Cần chú ý" và delta được tính từ dãy điểm theo đúng rule PRD,
// không đặt cứng, để kiểm tra được US-ADV-01 AC2 và US-ADV-02 AC1/AC3.

import type {
  ActivityItem,
  AdvisorInterviewItem,
  AdvisorNote,
  AssignedStudent,
  CvVersion,
  JobDescription,
  StarScore,
} from "@/lib/types"

const now = Date.now()
const daysAgo = (d: number, hour = 10) => {
  const date = new Date(now - d * 86_400_000)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export interface StudentSeed {
  id: string
  full_name: string
  student_code: string
  email: string
  major: string
  major_short: string
  cohort: string
  target_title: string | null
  target_company: string | null
  /** Điểm các vòng theo thứ tự thời gian. */
  scores: number[]
  last_active_days: number
  latest_ats: number | null
  capability_gaps: string[]
  /** Chia sẻ / tổng tài liệu; 0 = chưa chia sẻ gì. */
  shared_items: number
  total_items: number
  pending_reviews: number
}

export const studentSeeds: StudentSeed[] = [
  {
    id: "sv-0142",
    full_name: "Nguyễn Minh Anh",
    student_code: "21125430",
    email: "minhanh.k21@student.university.edu.vn",
    major: "Kinh doanh quốc tế",
    major_short: "KDQT",
    cohort: "K2021",
    target_title: "Business Analyst Intern",
    target_company: "Công ty Công nghệ A",
    scores: [61, 68, 74, 88, 82],
    last_active_days: 0,
    latest_ats: 85,
    capability_gaps: ["Tableau / Power BI"],
    shared_items: 4,
    total_items: 9,
    pending_reviews: 1,
  },
  {
    id: "sv-0157",
    full_name: "Lê Quang Huy",
    student_code: "21127045",
    email: "huy.lq21@student.university.edu.vn",
    major: "Hệ thống thông tin",
    major_short: "HTTT",
    cohort: "K2021",
    target_title: "Data Analyst Intern",
    target_company: "Công ty Thương mại điện tử B",
    scores: [70, 68, 66],
    last_active_days: 1,
    latest_ats: 71,
    capability_gaps: ["Python", "A/B Testing"],
    shared_items: 5,
    total_items: 5,
    pending_reviews: 0,
  },
  {
    id: "sv-0163",
    full_name: "Phạm Thu Trang",
    student_code: "21123318",
    email: "trang.pt21@student.university.edu.vn",
    major: "Quản trị kinh doanh",
    major_short: "QTKD",
    cohort: "K2021",
    target_title: "Product Owner Assistant",
    target_company: "Ngân hàng C",
    scores: [64],
    last_active_days: 4,
    latest_ats: 62,
    capability_gaps: [],
    shared_items: 2,
    total_items: 2,
    pending_reviews: 0,
  },
  {
    id: "sv-0171",
    full_name: "Lê Thu Hà",
    student_code: "21127012",
    email: "ha.lt21@student.university.edu.vn",
    major: "Hệ thống thông tin",
    major_short: "HTTT",
    cohort: "K2021",
    target_title: "Data Analyst Intern",
    target_company: "Công ty Viễn thông D",
    scores: [55, 52, 48],
    last_active_days: 2,
    latest_ats: 64,
    capability_gaps: ["SQL nâng cao", "Power BI"],
    shared_items: 4,
    total_items: 5,
    pending_reviews: 1,
  },
  {
    id: "sv-0175",
    full_name: "Phạm Quang Huy",
    student_code: "20125089",
    email: "huy.pq20@student.university.edu.vn",
    major: "Kinh doanh quốc tế",
    major_short: "KDQT",
    cohort: "K2020",
    target_title: "Product Owner Intern",
    target_company: "Ví điện tử E",
    scores: [66, 72, 79],
    last_active_days: 3,
    latest_ats: 80,
    capability_gaps: [],
    shared_items: 3,
    total_items: 4,
    pending_reviews: 0,
  },
  {
    id: "sv-0180",
    full_name: "Võ Ngọc Lan",
    student_code: "21124110",
    email: "lan.vn21@student.university.edu.vn",
    major: "Marketing",
    major_short: "MKT",
    cohort: "K2021",
    target_title: "Marketing Analyst Fresher",
    target_company: "Sàn thương mại F",
    scores: [58, 65, 71, 79],
    last_active_days: 1,
    latest_ats: 78,
    capability_gaps: ["Google Analytics 4"],
    shared_items: 5,
    total_items: 6,
    pending_reviews: 1,
  },
  {
    id: "sv-0184",
    full_name: "Đặng Minh Khoa",
    student_code: "20120112",
    email: "khoa.dm20@student.university.edu.vn",
    major: "Hệ thống thông tin",
    major_short: "HTTT",
    cohort: "K2020",
    target_title: null,
    target_company: null,
    scores: [60, 63],
    last_active_days: 14,
    latest_ats: null,
    capability_gaps: [],
    shared_items: 2,
    total_items: 3,
    pending_reviews: 0,
  },
  {
    id: "sv-0188",
    full_name: "Trần Bảo Châu",
    student_code: "21125990",
    email: "chau.tb21@student.university.edu.vn",
    major: "Kinh doanh quốc tế",
    major_short: "KDQT",
    cohort: "K2021",
    target_title: null,
    target_company: null,
    scores: [67, 70],
    last_active_days: 6,
    latest_ats: null,
    capability_gaps: [],
    shared_items: 0,
    total_items: 3,
    pending_reviews: 0,
  },
  {
    id: "sv-0192",
    full_name: "Trần Văn Hưng",
    student_code: "21120389",
    email: "hung.tv21@student.university.edu.vn",
    major: "Hệ thống thông tin",
    major_short: "HTTT",
    cohort: "K2021",
    target_title: "Backend Developer Intern",
    target_company: "Công ty Phần mềm G",
    scores: [55, 62, 70, 78],
    last_active_days: 0,
    latest_ats: 76,
    capability_gaps: ["Docker"],
    shared_items: 6,
    total_items: 6,
    pending_reviews: 1,
  },
  {
    id: "sv-0195",
    full_name: "Lê Phương Thảo",
    student_code: "21120512",
    email: "thao.lp21@student.university.edu.vn",
    major: "Marketing",
    major_short: "MKT",
    cohort: "K2021",
    target_title: "Content Marketing Intern",
    target_company: "Công ty Truyền thông D",
    scores: [58, 66, 72, 79],
    last_active_days: 2,
    latest_ats: 81,
    capability_gaps: [],
    shared_items: 4,
    total_items: 5,
    pending_reviews: 0,
  },
  {
    id: "sv-0199",
    full_name: "Huỳnh Quốc Bảo",
    student_code: "20120445",
    email: "bao.hq20@student.university.edu.vn",
    major: "Kinh doanh quốc tế",
    major_short: "KDQT",
    cohort: "K2020",
    target_title: "Business Analyst Intern",
    target_company: "Công ty Công nghệ A",
    scores: [62, 70, 75, 80],
    last_active_days: 5,
    latest_ats: 83,
    capability_gaps: [],
    shared_items: 5,
    total_items: 7,
    pending_reviews: 0,
  },
  {
    id: "sv-0203",
    full_name: "Nguyễn Văn Dũng",
    student_code: "20120530",
    email: "dung.nv20@student.university.edu.vn",
    major: "Marketing",
    major_short: "MKT",
    cohort: "K2020",
    target_title: "Marketing Analyst Fresher",
    target_company: "Sàn thương mại F",
    scores: [70, 70, 69],
    last_active_days: 3,
    latest_ats: 69,
    capability_gaps: ["Đo lường KPI chiến dịch"],
    shared_items: 3,
    total_items: 4,
    pending_reviews: 0,
  },
]

/** Khoảng cách giữa các vòng (ngày) khi sinh lịch sử phỏng vấn giả lập. */
const ROUND_GAP_DAYS = 4

export function roundDate(seed: StudentSeed, index: number): string {
  const fromLast = seed.scores.length - 1 - index
  return daysAgo(seed.last_active_days + fromLast * ROUND_GAP_DAYS, 9 + (index % 8))
}

/** US-ADV-02 AC1/AC3: gắn cờ khi 2 vòng liên tiếp không tăng; cần ≥ 3 vòng để so sánh. */
export function flagInfo(scores: number[]): { flagged: boolean; rounds: number[] | null } {
  const n = scores.length
  if (n < 3) return { flagged: false, rounds: null }
  const flagged = scores[n - 1] <= scores[n - 2] && scores[n - 2] <= scores[n - 3]
  return { flagged, rounds: flagged ? [n - 2, n - 1, n] : null }
}

export function syntheticStar(latest: number): StarScore {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  return { situation: clamp(latest + 6), task: clamp(latest + 1), action: clamp(latest - 1), result: clamp(latest - 8) }
}

/** Chuyển seed thành AssignedStudent. SV chưa chia sẻ gì thì ẩn toàn bộ số liệu. */
export function toAssignedStudent(seed: StudentSeed, override?: Partial<AssignedStudent>): AssignedStudent {
  const hidden = seed.shared_items === 0
  const scores = hidden ? [] : seed.scores
  const flag = flagInfo(scores)
  const latest = scores.at(-1) ?? null
  return {
    id: seed.id,
    full_name: seed.full_name,
    subtitle: `${seed.major_short} - ${seed.cohort}`,
    student_code: seed.student_code,
    email: seed.email,
    major: seed.major,
    cohort: seed.cohort,
    avatar_url: null,
    target_title: hidden ? null : seed.target_title,
    target_company: hidden ? null : seed.target_company,
    first_score: scores[0] ?? null,
    latest_score: latest,
    score_delta: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null,
    interview_count: scores.length,
    flagged: flag.flagged,
    flagged_at: flag.flagged ? roundDate(seed, scores.length - 1) : null,
    flag_rounds: flag.rounds,
    capability_gaps: hidden ? [] : seed.capability_gaps,
    last_active_at: daysAgo(seed.last_active_days, 9),
    latest_ats: hidden ? null : seed.latest_ats,
    star_average: latest !== null ? syntheticStar(latest) : null,
    shared_items: seed.shared_items,
    total_items: seed.total_items,
    pending_reviews: seed.pending_reviews,
    ...override,
  }
}

const ROUND_TITLES = [
  "Vòng làm quen",
  "Vòng 1 (HR cơ bản)",
  "Vòng 2 (Chuyên môn)",
  "Vòng 3 (Tình huống)",
  "Vòng 1 & 2 (HR & Chuyên môn)",
]

/** Lịch sử phỏng vấn giả lập cho SV (trừ Minh Anh, dùng dữ liệu thật của phía SV). */
export function syntheticInterviews(seed: StudentSeed, jd: Pick<JobDescription, "id" | "title" | "company">): AdvisorInterviewItem[] {
  const sharedCount = Math.min(seed.scores.length, Math.max(1, seed.shared_items - 1))
  return seed.scores
    .map((score, i): AdvisorInterviewItem => {
      const shared = i >= seed.scores.length - sharedCount
      const reviewed = shared && i < seed.scores.length - seed.pending_reviews - 1
      return {
        id: `${seed.id}-iv-${i + 1}`,
        completed_at: roundDate(seed, i),
        duration_seconds: (14 + ((i * 5) % 12)) * 60,
        jd,
        round_title: ROUND_TITLES[i % ROUND_TITLES.length],
        question_count: 4,
        total_score: score,
        question_scores: [score - 4, score + 2, score - 1, score + 3].map((v) => Math.max(0, Math.min(100, v))),
        shared,
        summary: shared
          ? score >= 75
            ? "Trả lời có cấu trúc STAR rõ ràng; phần Kết quả đã có số liệu cụ thể."
            : "Nêu được bối cảnh nhưng phần Hành động và Kết quả còn chung chung, thiếu số liệu đo lường."
          : null,
        review: reviewed
          ? {
              advisor_name: "ThS. Trần Hoàng Nam",
              score: null,
              comment: "Cấu trúc trả lời ổn. Buổi sau hãy nêu rõ vai trò của em và kết quả đo được.",
              reviewed_at: roundDate(seed, i + 1 < seed.scores.length ? i + 1 : i),
            }
          : null,
        review_seen_at: reviewed ? roundDate(seed, i) : null,
      }
    })
    .reverse()
}

export function syntheticCv(seed: StudentSeed): CvVersion {
  return {
    id: `${seed.id}-cv-1`,
    version: 1,
    label: "v1.0",
    file_name: `CV_${seed.full_name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/\s+/g, "")}.pdf`,
    file_type: "pdf",
    size_bytes: 920_000,
    page_count: 1,
    uploaded_at: daysAgo(seed.last_active_days + 6),
    status: "ready",
    error_message: null,
    target_title: seed.target_title,
    ats_score: seed.latest_ats,
    ats_note: null,
    origin: "upload",
    latest_analysis_id: null,
    is_active: true,
    is_draft: false,
  }
}

export function syntheticActivity(seed: StudentSeed): ActivityItem[] {
  if (seed.shared_items === 0) return []
  const n = seed.scores.length
  return [
    {
      id: `${seed.id}-a1`,
      kind: "interview" as const,
      title: `Hoàn thành buổi phỏng vấn thứ ${n}`,
      description: `Điểm STAR ${seed.scores[n - 1]}/100.`,
      occurred_at: roundDate(seed, n - 1),
    },
    ...(seed.latest_ats !== null
      ? [
          {
            id: `${seed.id}-a2`,
            kind: "cv_optimized" as const,
            title: "Cập nhật CV",
            description: `Điểm ATS hiện tại ${seed.latest_ats}/100.`,
            occurred_at: daysAgo(seed.last_active_days + 5),
          },
        ]
      : []),
  ]
}

/** Ghi chú nội bộ mẫu cho Minh Anh (Figma: frame "Hồ sơ sinh viên - Ghi chú & CV"). */
export const seedNotes: Record<string, AdvisorNote[]> = {
  "sv-0142": [
    {
      id: "note-1",
      author_name: "ThS. Trần Hoàng Nam",
      body: "Minh Anh tiếp thu rất nhanh ở câu hỏi xử lý xung đột trong bài tập Sprint. Tuy nhiên phần Result vẫn còn ước lượng cảm tính, cần nhắc em đối chiếu số liệu thật từ đề tài môn học.",
      tags: ["technical"],
      pinned: true,
      created_at: daysAgo(1, 15),
      updated_at: daysAgo(1, 15),
    },
    {
      id: "note-2",
      author_name: "ThS. Trần Hoàng Nam",
      body: "Đã xem bản CV v3. Phần phân tích nghiệp vụ và từ khoá SQL/BPMN cải thiện rõ. Khuyên em tập trung luyện vòng chuyên môn với case study.",
      tags: ["technical", "soft_skill"],
      pinned: false,
      created_at: daysAgo(6, 10),
      updated_at: daysAgo(6, 10),
    },
    {
      id: "note-3",
      author_name: "ThS. Trần Hoàng Nam",
      body: "Buổi làm quen (61 điểm) cho thấy em còn rụt rè khi trình bày bối cảnh dự án. Xếp vào nhóm theo dõi sát lộ trình STAR.",
      tags: ["behavior", "watch"],
      pinned: false,
      created_at: daysAgo(21, 14),
      updated_at: daysAgo(21, 14),
    },
  ],
}

export const seedSuggestions: Record<string, string[]> = {
  "sv-0142": [
    "Yêu cầu Minh Anh bổ sung số liệu đo lường (thời gian, tỷ lệ) cho đồ án môn học trong phần Result.",
    "Đối chiếu lại yêu cầu Tableau / Power BI trong JD: đây là khoảng cách năng lực, không sửa được bằng câu chữ.",
    "Đề xuất luyện thêm một vòng Chuyên môn với AI trước buổi tư vấn tiếp theo.",
  ],
}

export const DEFAULT_SUGGESTIONS = [
  "Xem lại buổi phỏng vấn gần nhất và chọn một câu để cùng sinh viên viết lại theo STAR.",
  "Hỏi sinh viên về kế hoạch luyện tập trong tuần tới.",
]

/** Điểm trung bình theo tuần (5 tuần gần nhất), điểm cuối = trung bình hiện tại. */
export function weeklyScores(current: number): { label: string; value: number }[] {
  const offsets = [-15, -12, -7, -3, 0]
  return offsets.map((o, i) => ({ label: i === offsets.length - 1 ? "Tuần này" : `Tuần ${i + 1}`, value: Math.round(current + o) }))
}

export const recentFeedbackSeed = [
  {
    id: "rf-1",
    student_id: "sv-0142",
    student_name: "Nguyễn Minh Anh",
    excerpt: "Thầy đánh giá cao cách em trả lời câu 4 về xung đột yêu cầu…",
    sent_at: daysAgo(1, 15),
    seen_at: daysAgo(0, 10),
  },
  {
    id: "rf-2",
    student_id: "sv-0180",
    student_name: "Võ Ngọc Lan",
    excerpt: "Cần lượng hoá thêm % tăng trưởng của chiến dịch ở câu 3…",
    sent_at: daysAgo(1, 9),
    seen_at: null,
  },
  {
    id: "rf-3",
    student_id: "sv-0171",
    student_name: "Lê Thu Hà",
    excerpt: "Thầy đã điều chỉnh điểm STAR câu 2 vì phần Kết quả chưa có số liệu…",
    sent_at: daysAgo(3, 16),
    seen_at: daysAgo(2, 8),
  },
]
