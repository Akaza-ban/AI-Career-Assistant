// Các trang Cố vấn ở chế độ mock: cùng quy tắc với src/services/advisor.py và cùng nhóm SV giả định với
// src/db/demo_cohort.py (tên người, trường là giả định).

import { mockInterviewQuestionBank, mockJdLibrary, mockStarGuidance } from "@/lib/mocks/data"
import { cvProgress, interviewProgress, STAR_WINDOW, starAverage, weakest } from "@/lib/mocks/student-progress"
import type {
  AdvisorGap,
  AdvisorNote,
  AdvisorOverview,
  AdvisorReviewInfo,
  AdvisorStudentDetail,
  AdvisorStudentProgress,
  AnalysisRow,
  AssignedStudent,
  CohortStar,
  CvVersion,
  InterviewJdRef,
  InterviewLabel,
  InterviewReport,
  InterviewRow,
  JobDescription,
  MatchStatus,
  RequirementImportance,
  StarCriterion,
  StarScores,
  StarSummary,
  StudentFlag,
  StudentStatus,
  StudentTrend,
  WeeklyScore,
} from "@/lib/types"

// ---------- Quy tắc (giống backend) ----------

/** Chênh lệch ≥ +0,3 là tiến bộ rõ, ≤ −0,3 là giảm (PRD mục 5.1). */
const TREND_THRESHOLD = 0.3
const INACTIVE_DAYS = 14
const MAX_SUGGESTIONS = 4
const CRITERIA: StarCriterion[] = ["situation", "task", "action", "result"]
const CRITERION_LABELS: Record<StarCriterion, string> = {
  situation: "Bối cảnh",
  task: "Nhiệm vụ",
  action: "Hành động",
  result: "Kết quả",
}
const LABEL_TEXT: Record<InterviewLabel, string> = { weak: "Cần luyện thêm", basic: "Đạt cơ bản", fair: "Khá", good: "Tốt" }

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
const round2 = (n: number) => Math.round(n * 100) / 100
const time = (iso: string) => new Date(iso).getTime()
export const labelOf = (score: number): InterviewLabel =>
  score >= 4 ? "good" : score >= 3 ? "fair" : score >= 2 ? "basic" : "weak"
const matchLabelOf = (score: number | null) =>
  score === null ? null : score >= 75 ? ("high" as const) : score >= 50 ? ("medium" as const) : ("low" as const)

export interface AnalysisSource {
  row: AnalysisRow
  requirements: { skill: string; importance: RequirementImportance; status: MatchStatus }[]
}

/** Dữ liệu một SV: phía SV (Minh Anh) lấy từ trạng thái mock của SV, SV giả định lấy từ COHORT. */
export interface StudentSource {
  profile: Pick<AssignedStudent, "id" | "full_name" | "subtitle" | "email" | "phone" | "avatar_url">
  /** Mới nhất trước. */
  cvs: CvVersion[]
  /** Lượt phân tích đã hoàn tất, mới nhất trước. */
  analyses: AnalysisSource[]
  /** Buổi đã hoàn thành, mới nhất trước. */
  sessions: InterviewRow[]
  /** Mã tài liệu đang chia sẻ. */
  shared: Set<string>
  /** Nhận xét của cố vấn theo mã buổi. */
  reviews: Record<string, AdvisorReviewInfo>
}

/** Các buổi ở vị trí đang luyện (vị trí của buổi gần nhất), cũ → mới. */
function focusOf(src: StudentSource): InterviewRow[] {
  const latest = src.sessions[0]
  return latest ? src.sessions.filter((s) => s.jd.id === latest.jd.id).reverse() : []
}

/** US-ADV-02: 2 vòng liên tiếp không tăng (buổi N ≤ N−1 ≤ N−2). */
function flagOf(focus: InterviewRow[]): StudentFlag | null {
  if (focus.length < 3) return null
  const [a, b, c] = focus.slice(-3)
  if (!(c.overall_score <= b.overall_score && b.overall_score <= a.overall_score)) return null
  const n = focus.length
  return { jd: c.jd, rounds: [n - 2, n - 1, n], scores: [a.overall_score, b.overall_score, c.overall_score], flagged_at: c.completed_at }
}

function trendOf(delta: number | null): StudentTrend {
  if (delta === null) return "insufficient"
  if (delta >= TREND_THRESHOLD) return "improving"
  if (delta <= -TREND_THRESHOLD) return "declining"
  return "stable"
}

/** Chia sẻ CV tính theo cả CV (family_id): mọi phiên bản của CV đã chia sẻ đều xem được. */
export function cvShared(src: StudentSource, cvVersionId: string): boolean {
  const cv = src.cvs.find((c) => c.id === cvVersionId)
  return cv !== undefined && src.shared.has(cv.family_id)
}

function missingRequired(src: StudentSource): string[] {
  const latest = src.analyses[0]
  if (!latest || !cvShared(src, latest.row.cv_version_id)) return []
  return latest.requirements.filter((r) => r.status === "missing" && r.importance === "required").map((r) => r.skill)
}

export function summarize(src: StudentSource): AssignedStudent {
  const focus = focusOf(src)
  const first = focus[0]?.overall_score ?? null
  const latest = focus.at(-1)?.overall_score ?? null
  const delta = focus.length >= 2 ? round2(latest! - first!) : null
  const target = src.sessions[0]?.jd ?? src.analyses[0]?.row.jd ?? null
  const moments = [
    ...src.cvs.map((c) => c.uploaded_at),
    ...src.analyses.map((a) => a.row.created_at),
    ...src.sessions.map((s) => s.completed_at),
  ].sort((a, b) => time(b) - time(a))
  // Mỗi CV tính một tài liệu dù có nhiều phiên bản
  const items = [...new Set(src.cvs.map((c) => c.family_id)), ...src.sessions.map((s) => s.id)]
  return {
    ...src.profile,
    target,
    interview_count: src.sessions.length,
    focus_session_count: focus.length,
    first_score: first,
    latest_score: latest,
    score_delta: delta,
    trend: trendOf(delta),
    flag: flagOf(focus),
    latest_match: src.analyses[0]?.row.match_score ?? null,
    missing_required: missingRequired(src),
    last_active_at: moments[0] ?? null,
    shared_items: items.filter((id) => src.shared.has(id)).length,
    total_items: items.length,
    pending_reviews: src.sessions.filter((s) => src.shared.has(s.id) && !src.reviews[s.id]).length,
  }
}

/** "3,4/5 (Khá) · Mạnh nhất: Bối cảnh 4 · Yếu nhất: Kết quả 2,6 · 1 câu hết giờ" */
export function sessionSummary(row: InterviewRow): string {
  const best = CRITERIA.reduce((b, c) => (row.star[c] > row.star[b] ? c : b))
  const worst = weakest(row.star)
  const parts = [
    `${fmt(row.overall_score)}/5 (${LABEL_TEXT[labelOf(row.overall_score)]})`,
    `Mạnh nhất: ${CRITERION_LABELS[best]} ${fmt(row.star[best])}`,
    `Yếu nhất: ${CRITERION_LABELS[worst]} ${fmt(row.star[worst])}`,
  ]
  if (row.timed_out_count) parts.push(`${row.timed_out_count} câu hết giờ`)
  return parts.join(" · ")
}

function starOf(src: StudentSource): StarSummary | null {
  const window = src.sessions.slice(0, STAR_WINDOW)
  if (window.length === 0) return null
  const average = starAverage(window)
  return { average, weakest: weakest(average), session_count: window.length }
}

function insightOf(star: StarSummary | null): string | null {
  if (!star) return null
  const weak = star.weakest
  return `${CRITERION_LABELS[weak]} là tiêu chí thấp nhất (${fmt(star.average[weak])}/5) trong ${star.session_count} buổi gần nhất. Hướng dẫn cho SV: ${mockStarGuidance[weak]}`
}

function suggestionsOf(src: StudentSource, row: AssignedStudent, star: StarSummary | null, now: number): string[] {
  const result: string[] = []
  if (row.flag) {
    result.push(
      `Điểm vị trí ${row.flag.jd.title} không tăng qua các buổi ${row.flag.rounds.join(", ")} (${row.flag.scores.map(fmt).join(" → ")}): xem lại buổi gần nhất cùng SV.`,
    )
  } else if (row.trend === "declining" && row.target && row.score_delta !== null) {
    result.push(`Điểm vị trí ${row.target.title} giảm ${fmt(Math.abs(row.score_delta))} so với buổi đầu: tìm hiểu nguyên nhân.`)
  }
  if (row.pending_reviews) result.push(`Còn ${row.pending_reviews} báo cáo SV đã chia sẻ đang chờ bạn nhận xét.`)
  if (row.last_active_at) {
    const days = Math.floor((now - time(row.last_active_at)) / 86_400_000)
    if (days >= INACTIVE_DAYS) result.push(`SV chưa có hoạt động ${days} ngày: hỏi về kế hoạch luyện tập tuần tới.`)
  }
  if (src.sessions.length === 0) result.push("SV chưa luyện phỏng vấn: gợi ý chọn vị trí đã phân tích và làm buổi đầu tiên.")
  if (row.missing_required.length) {
    result.push(
      `CV còn thiếu kỹ năng bắt buộc cho vị trí ${src.analyses[0].row.jd.title}: ${row.missing_required.join(", ")}. Trao đổi kế hoạch học, hoặc bổ sung bằng chứng nếu SV đã có.`,
    )
  }
  if (star) {
    result.push(
      `Luyện tiêu chí ${CRITERION_LABELS[star.weakest]} (${fmt(star.average[star.weakest])}/5): chọn một câu trả lời để cùng SV viết lại theo STAR.`,
    )
  }
  if (row.shared_items === 0 && row.total_items > 0) {
    result.push("SV chưa chia sẻ tài liệu nào: có thể đề nghị SV bật chia sẻ báo cáo cần góp ý.")
  }
  return result.slice(0, MAX_SUGGESTIONS)
}

export function progressOf(src: StudentSource, now = Date.now()): AdvisorStudentProgress {
  const star = starOf(src)
  return {
    interview_progress: interviewProgress(src.sessions),
    cv_progress: cvProgress(
      src.analyses.map((a) => a.row),
      src.cvs,
    ),
    star,
    insight: insightOf(star),
    suggestions: suggestionsOf(src, summarize(src), star, now),
  }
}

function gapOf(src: StudentSource): AdvisorGap | null {
  const latest = src.analyses[0]
  if (!latest) return null
  const shared = cvShared(src, latest.row.cv_version_id)
  const skills = (status: MatchStatus) => (shared ? latest.requirements.filter((r) => r.status === status).map((r) => r.skill) : [])
  return {
    analysis_id: latest.row.id,
    created_at: latest.row.created_at,
    cv_version_id: latest.row.cv_version_id,
    cv_label: latest.row.cv_label,
    jd: latest.row.jd,
    match_score: latest.row.match_score,
    match_label: latest.row.match_label,
    shared,
    matched: skills("matched"),
    partial: skills("partial"),
    missing: skills("missing"),
  }
}

function jobDescription(ref: InterviewJdRef): JobDescription {
  return (
    mockJdLibrary.find((j) => j.id === ref.id) ?? {
      ...ref,
      industry: null,
      level: null,
      skills: [],
      content: "",
    }
  )
}

export function detailOf(src: StudentSource, notes: AdvisorNote[], now = Date.now()): AdvisorStudentDetail {
  const targetRef = src.analyses[0]?.row.jd ?? src.sessions[0]?.jd ?? null
  return {
    student: summarize(src),
    cvs: src.cvs.map((cv) => ({ ...cv, shared: cvShared(src, cv.id) })),
    target_jd: targetRef ? jobDescription(targetRef) : null,
    latest_gap: gapOf(src),
    interviews: src.sessions.map((s) => ({
      ...s,
      shared: src.shared.has(s.id),
      summary: sessionSummary(s),
      review: src.reviews[s.id] ?? null,
    })),
    notes: [...notes].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || time(b.updated_at) - time(a.updated_at),
    ),
    ...progressOf(src, now),
  }
}

// ---------- Báo cáo phỏng vấn tổng hợp cho SV giả định ----------

const ANSWERS = [
  "Trong đồ án môn học gần nhất, nhóm em làm sản phẩm sát với công việc {role}. Em phụ trách phần chính của nhóm, tự lên kế hoạch, chia việc và báo cáo tiến độ hằng tuần. Cuối kỳ nhóm bàn giao đúng hạn.",
  "Có lần dữ liệu đầu vào của nhóm bị sai định dạng ngay trước buổi bảo vệ. Em rà lại từng bước, tìm ra nguyên nhân và cùng bạn sửa lại quy trình kiểm tra. Nhóm vẫn kịp trình bày.",
  "Trong nhóm có bạn muốn làm thêm nhiều chức năng trong khi thời gian ít. Em đề xuất cả nhóm liệt kê công sức và giá trị từng chức năng rồi bỏ phiếu. Nhóm thống nhất tập trung vào phần quan trọng nhất.",
  "Khi cần dùng một công cụ mới cho vị trí {role}, em học theo tài liệu chính thức và làm lại các ví dụ mẫu, sau đó nhờ anh chị khoá trên góp ý. Sau một tuần em dùng được cho phần việc của mình.",
]
const TURN_OFFSETS = [0.2, -0.1, 0.1, -0.2]

/** Báo cáo đủ 4 câu dựng từ điểm của buổi (dùng khi không có báo cáo gốc trong phiên mock). */
export function syntheticReport(row: InterviewRow, cvFileName: string): InterviewReport {
  const worst = weakest(row.star)
  const turns = mockInterviewQuestionBank.map((q, i) => {
    const star = Object.fromEntries(
      CRITERIA.map((c) => [c, Math.max(0, Math.min(5, round2(row.star[c] + TURN_OFFSETS[i])))]),
    ) as StarScores
    return {
      id: `${row.id}-t${i + 1}`,
      index: i + 1,
      theme: q.theme,
      question: q.template.replace("{role}", row.jd.title),
      answer: ANSWERS[i].replaceAll("{role}", row.jd.title),
      timed_out: i >= mockInterviewQuestionBank.length - row.timed_out_count,
      star,
      score: round2(CRITERIA.reduce((sum, c) => sum + star[c], 0) / CRITERIA.length),
      feedback: `Câu trả lời có cấu trúc khá rõ. Gợi ý: ${mockStarGuidance[worst][0].toLowerCase()}${mockStarGuidance[worst].slice(1)}`,
    }
  })
  const ranked = [...CRITERIA].sort((a, b) => row.star[a] - row.star[b])
  return {
    id: row.id,
    response_id: row.id,
    jd: row.jd,
    cv_file_name: cvFileName,
    created_at: new Date(time(row.completed_at) - row.duration_seconds * 1000).toISOString(),
    completed_at: row.completed_at,
    duration_seconds: row.duration_seconds,
    overall_score: row.overall_score,
    label: row.label,
    star: row.star,
    weakest: ranked[0],
    turns,
    timed_out_count: row.timed_out_count,
    guidance: [mockStarGuidance[ranked[0]], mockStarGuidance[ranked[1]]],
    comparison: null,
    advisor_review: null,
  }
}

// ---------- 8 SV giả định (khớp src/db/demo_cohort.py) ----------

interface CohortSpec {
  id: string
  full_name: string
  email: string
  phone: string
  jd: string
  weak: StarCriterion
  /** (số ngày trước, kỹ năng thiếu, kỹ năng chỉ liệt kê) */
  versions: [number, string[], string[]][]
  /** (số ngày trước, điểm tổng, số câu hết giờ) */
  sessions: [number, number, number][]
  share: "all" | "latest" | "cv" | "none"
  /** (buổi thứ mấy, SV đã xem?, nội dung) */
  review: [number, boolean, string] | null
  note: [string, AdvisorNote["tags"], boolean] | null
}

const COHORT: CohortSpec[] = [
  {
    id: "sv-0151",
    full_name: "Lê Quang Huy",
    email: "huy.lq@gmail.com",
    phone: "0903 214 587",
    jd: "jd-be-intern",
    weak: "result",
    versions: [
      [40, ["Docker", "Redis", "Unit test", "Linux"], ["Git"]],
      [20, ["Redis", "Unit test"], ["Linux"]],
    ],
    sessions: [
      [38, 2.6, 0],
      [27, 3.0, 0],
      [15, 3.5, 0],
      [4, 3.9, 0],
    ],
    share: "all",
    review: [4, true, "Em trình bày bối cảnh và nhiệm vụ rất rõ. Buổi tới thử nêu thêm kết quả đo được, ví dụ thời gian phản hồi API."],
    note: ["Tiến bộ đều qua 4 buổi. Có thể giới thiệu thực tập backend.", ["technical"], false],
  },
  {
    id: "sv-0152",
    full_name: "Phạm Thu Trang",
    email: "trang.pt@gmail.com",
    phone: "0987 552 130",
    jd: "jd-ba-intern",
    weak: "action",
    versions: [[33, ["BPMN", "Jira", "Figma"], ["Agile/Scrum"]]],
    sessions: [
      [30, 3.2, 0],
      [20, 3.1, 0],
      [9, 2.9, 1],
      [2, 2.9, 1],
    ],
    share: "latest",
    review: null,
    note: ["Điểm không tăng mấy buổi gần đây, có câu hết giờ. Hẹn gặp trực tiếp.", ["watch"], true],
  },
  {
    id: "sv-0153",
    full_name: "Lê Thu Hà",
    email: "ha.lt@gmail.com",
    phone: "0916 408 772",
    jd: "jd-xnk-fresher",
    weak: "task",
    versions: [[48, ["Incoterms", "Thủ tục hải quan"], ["Thanh toán quốc tế"]]],
    sessions: [
      [45, 2.8, 0],
      [30, 3.1, 0],
    ],
    share: "cv",
    review: null,
    note: null,
  },
  {
    id: "sv-0154",
    full_name: "Phạm Quang Huy",
    email: "huy.pq@gmail.com",
    phone: "0935 117 264",
    jd: "jd-fe-junior",
    weak: "result",
    versions: [[22, ["TypeScript", "Next.js", "Unit test"], ["Tailwind CSS"]]],
    sessions: [
      [20, 3.1, 0],
      [12, 3.4, 0],
      [5, 3.3, 0],
    ],
    share: "none",
    review: null,
    note: null,
  },
  {
    id: "sv-0155",
    full_name: "Võ Ngọc Lan",
    email: "lan.vn@gmail.com",
    phone: "0978 630 415",
    jd: "jd-mkt-analyst",
    weak: "action",
    versions: [[10, ["A/B Testing", "Quảng cáo trả phí", "SQL", "SEO"], ["Báo cáo hiệu quả chiến dịch"]]],
    sessions: [[6, 2.7, 1]],
    share: "all",
    review: null,
    note: null,
  },
  {
    id: "sv-0156",
    full_name: "Đặng Minh Khoa",
    email: "khoa.dm@gmail.com",
    phone: "0908 742 091",
    jd: "jd-fa-fresher",
    weak: "result",
    versions: [[8, ["Định giá doanh nghiệp", "Mô hình tài chính", "CFA"], []]],
    sessions: [],
    share: "cv",
    review: null,
    note: null,
  },
  {
    id: "sv-0157",
    full_name: "Trần Bảo Châu",
    email: "chau.tb@gmail.com",
    phone: "0941 285 336",
    jd: "jd-da-intern",
    weak: "situation",
    versions: [[18, ["Tableau", "Google Analytics"], ["Thống kê"]]],
    sessions: [
      [16, 3.6, 0],
      [3, 3.1, 0],
    ],
    share: "all",
    review: [1, true, "Câu trả lời về dashboard Power BI rất cụ thể. Giữ cách kể có số liệu như vậy."],
    note: null,
  },
  {
    id: "sv-0158",
    full_name: "Trần Văn Hưng",
    email: "hung.tv@gmail.com",
    phone: "0962 019 548",
    jd: "jd-po-assistant",
    weak: "task",
    versions: [[30, ["Kiến thức ngân hàng số"], ["Phân tích dữ liệu"]]],
    sessions: [
      [28, 4.0, 0],
      [18, 4.1, 0],
      [7, 4.2, 0],
    ],
    share: "latest",
    review: [3, false, "Rất tốt. Thử luyện thêm câu hỏi về xử lý xung đột ưu tiên giữa các bên liên quan."],
    note: ["Hồ sơ tốt, có thể giới thiệu vị trí PO Assistant.", ["soft_skill"], false],
  },
]

const WEIGHTS: Record<RequirementImportance, number> = { required: 3, preferred: 2, additional: 1 }
const MATCH: Record<MatchStatus, number> = { matched: 1, partial: 0.5, missing: 0 }

function starOffsets(weak: StarCriterion): Record<StarCriterion, number> {
  const others = CRITERIA.filter((c) => c !== weak)
  return { [weak]: -0.5, [others[0]]: 0.3, [others[1]]: 0.1, [others[2]]: 0.1 } as Record<StarCriterion, number>
}

export interface CohortStudent extends StudentSource {
  notes: AdvisorNote[]
}

/** Dựng dữ liệu các SV giả định, thời gian tính lùi từ lúc gọi. */
export function buildCohort(now = Date.now()): CohortStudent[] {
  const ago = (days: number, hours = 0) => new Date(now - days * 86_400_000 - hours * 3_600_000).toISOString()
  return COHORT.map((spec) => {
    const jdFull = mockJdLibrary.find((j) => j.id === spec.jd)!
    const jd: InterviewJdRef = { id: jdFull.id, title: jdFull.title, company: jdFull.company, source: "library" }
    const key = spec.id.slice(3)
    const analyses: AnalysisSource[] = []
    const cvs: CvVersion[] = spec.versions.map(([days, missing, partial], i) => {
      const requirements = jdFull.skills.map((s) => ({
        skill: s.name,
        importance: s.importance,
        status: (missing.includes(s.name) ? "missing" : partial.includes(s.name) ? "partial" : "matched") as MatchStatus,
      }))
      const total = requirements.reduce((sum, r) => sum + WEIGHTS[r.importance], 0)
      const score = round2((requirements.reduce((sum, r) => sum + WEIGHTS[r.importance] * MATCH[r.status], 0) / total) * 100)
      const cvId = `cv_${key}_${i + 1}`
      const analyzed = ago(days, 2)
      analyses.unshift({
        row: {
          id: `ga_${key}_${i + 1}`,
          jd,
          cv_version_id: cvId,
          cv_label: `v1.${i}`,
          cv_file_name: `CV_${spec.full_name.split(" ").at(-1)}_v${i + 1}.docx`,
          status: "completed",
          current_step: null,
          match_score: score,
          match_label: matchLabelOf(score),
          created_at: analyzed,
          completed_at: analyzed,
        },
        requirements,
      })
      // Mọi phiên bản thuộc cùng một CV: bản tải lên v1.0, các lần tối ưu v1.1, v1.2...
      return {
        id: cvId,
        version: i + 1,
        label: `v1.${i}`,
        family_id: `cv_${key}_1`,
        version_count: spec.versions.length,
        file_name: `CV_${spec.full_name.split(" ").at(-1)}_v${i + 1}.docx`,
        file_type: "docx",
        size_bytes: 24_000,
        page_count: null,
        uploaded_at: ago(days, 3),
        status: "ready",
        error_message: null,
        target_title: jd.title,
        match_score: Math.round(score),
        origin: i === 0 ? "upload" : "optimized",
        latest_analysis_id: `ga_${key}_${i + 1}`,
        source_analysis_id: i > 0 ? `ga_${key}_${i}` : null,
        source_jd_title: i > 0 ? jd.title : null,
        restored_from_label: null,
        is_active: i === spec.versions.length - 1,
        is_draft: false,
      }
    })
    cvs.reverse()

    const offsets = starOffsets(spec.weak)
    const sessions: InterviewRow[] = spec.sessions
      .map(([days, score, timedOut]) => ({
        id: `iv_${key}_${days}`,
        jd,
        completed_at: ago(days, 2),
        duration_seconds: 18 * 60,
        overall_score: score,
        label: labelOf(score),
        star: Object.fromEntries(CRITERIA.map((c) => [c, round2(score + offsets[c])])) as StarScores,
        timed_out_count: timedOut,
      }))
      .reverse()

    const chronological = [...sessions].reverse()
    const shared = new Set<string>()
    // CV chia sẻ theo mã CV: cố vấn xem bản mới nhất và các bản trước
    if (spec.share !== "none") shared.add(cvs[0].family_id)
    if (spec.share === "all") sessions.forEach((s) => shared.add(s.id))
    if (spec.share === "latest") chronological.slice(-2).forEach((s) => shared.add(s.id))

    const reviews: Record<string, AdvisorReviewInfo> = {}
    if (spec.review) {
      const [number, seen, comment] = spec.review
      const session = chronological[number - 1]
      const reviewed = new Date(Math.min(time(session.completed_at) + 86_400_000, now)).toISOString()
      reviews[session.id] = {
        id: `rv_${session.id}`,
        comment,
        created_at: reviewed,
        updated_at: reviewed,
        seen_at: seen ? new Date(time(reviewed) + 5 * 3_600_000).toISOString() : null,
      }
    }
    const notes: AdvisorNote[] = spec.note
      ? [{ id: `nt_${key}`, body: spec.note[0], tags: spec.note[1], pinned: spec.note[2], created_at: ago(2), updated_at: ago(2) }]
      : []

    return {
      profile: {
        id: spec.id,
        full_name: spec.full_name,
        subtitle: spec.email,
        email: spec.email,
        phone: spec.phone,
        avatar_url: null,
      },
      cvs,
      analyses,
      sessions,
      shared,
      reviews,
      notes,
    }
  })
}

// ---------- Tổng quan cả nhóm (giống advisor.overview ở backend) ----------

// "Hoạt động" = có lượt phân tích hoặc buổi phỏng vấn hoàn thành trong 30 ngày; mục tiêu ≥ 60% (PRD mục 9).
// CSAT toàn hệ thống nằm ở trang Quản trị (lib/mocks/admin.ts).
const ACTIVE_DAYS = 30
const ACTIVE_TARGET = 60
const WEEKS = 8
const TOP_IMPROVERS = 5
const RECENT_REVIEWS = 5
const DAY = 86_400_000
const VN_OFFSET = 7 * 3_600_000

const mean = (values: number[]) => (values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null)

/** Thứ Hai 00:00 giờ Việt Nam của tuần chứa `now`. */
function weekStart(now: number): number {
  const local = new Date(now + VN_OFFSET)
  const monday = local.getUTCDate() - ((local.getUTCDay() + 6) % 7)
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), monday) - VN_OFFSET
}

/** Mỗi SV lấy điểm buổi gần nhất tính đến cuối tuần; bỏ các tuần chưa SV nào có điểm. */
function weeklyScores(sources: StudentSource[], now: number): WeeklyScore[] {
  const thisWeek = weekStart(now)
  const result: WeeklyScore[] = []
  for (let back = WEEKS - 1; back >= 0; back--) {
    const start = thisWeek - back * 7 * DAY
    const scores = sources.flatMap((src) => {
      const latest = src.sessions.find((s) => time(s.completed_at) < start + 7 * DAY)
      return latest ? [latest.overall_score] : []
    })
    if (scores.length) result.push({ week_start: new Date(start).toISOString(), average: mean(scores)!, student_count: scores.length })
  }
  return result
}

function cohortStar(sources: StudentSource[]): CohortStar | null {
  const perStudent = sources.filter((s) => s.sessions.length).map((s) => starAverage(s.sessions.slice(0, STAR_WINDOW)))
  if (perStudent.length === 0) return null
  const average = Object.fromEntries(CRITERIA.map((c) => [c, mean(perStudent.map((p) => p[c]))!])) as StarScores
  const weak = weakest(average)
  return {
    average,
    weakest: weak,
    weakest_count: perStudent.filter((p) => weakest(p) === weak).length,
    student_count: perStudent.length,
  }
}

export function overviewOf(sources: StudentSource[], advisorName: string, now = Date.now()): AdvisorOverview {
  const rows = sources.map(summarize)
  const latest = rows.flatMap((r) => (r.latest_score !== null ? [r.latest_score] : []))
  const deltas = rows.flatMap((r) => (r.score_delta !== null ? [r.score_delta] : []))
  const practiced = (src: StudentSource) => [
    ...src.analyses.map((a) => a.row.completed_at ?? a.row.created_at),
    ...src.sessions.map((s) => s.completed_at),
  ]
  const star = cohortStar(sources)
  const statusCounts: Record<StudentStatus, number> = { flagged: 0, declining: 0, insufficient: 0, stable: 0, improving: 0 }
  rows.forEach((r) => statusCounts[r.flag ? "flagged" : r.trend]++)
  const reviews = sources.flatMap((src) =>
    src.sessions.flatMap((s) => {
      const review = src.reviews[s.id]
      return review
        ? [{ ...review, student_id: src.profile.id, student_name: src.profile.full_name, avatar_url: src.profile.avatar_url, session_id: s.id, jd: s.jd }]
        : []
    }),
  )
  return {
    advisor_name: advisorName,
    student_count: rows.length,
    sharing_count: rows.filter((r) => r.shared_items > 0).length,
    pending_reviews: rows.reduce((sum, r) => sum + r.pending_reviews, 0),
    active_count: sources.filter((src) => practiced(src).some((at) => time(at) >= now - ACTIVE_DAYS * DAY)).length,
    active_days: ACTIVE_DAYS,
    active_target: ACTIVE_TARGET,
    average_score: mean(latest),
    scored_count: latest.length,
    average_delta: mean(deltas),
    delta_count: deltas.length,
    weekly_scores: weeklyScores(sources, now),
    status_counts: statusCounts,
    star,
    insight: star
      ? `${CRITERION_LABELS[star.weakest]} là tiêu chí thấp nhất của nhóm (${fmt(star.average[star.weakest])}/5) và là tiêu chí yếu nhất của ${star.weakest_count}/${star.student_count} sinh viên. Hướng dẫn chung: ${mockStarGuidance[star.weakest]}`
      : null,
    flagged_students: rows.filter((r) => r.flag).sort((a, b) => time(b.flag!.flagged_at) - time(a.flag!.flagged_at)),
    top_improvers: rows
      .filter((r) => (r.score_delta ?? 0) > 0)
      .sort((a, b) => b.score_delta! - a.score_delta!)
      .slice(0, TOP_IMPROVERS),
    recent_reviews: reviews.sort((a, b) => time(b.updated_at) - time(a.updated_at)).slice(0, RECENT_REVIEWS),
    pending_sessions: sources
      .flatMap((src) =>
        src.sessions
          .filter((s) => src.shared.has(s.id) && !src.reviews[s.id])
          .map((s) => ({
            session_id: s.id,
            student_id: src.profile.id,
            student_name: src.profile.full_name,
            avatar_url: src.profile.avatar_url,
            jd: s.jd,
            completed_at: s.completed_at,
            overall_score: s.overall_score,
          })),
      )
      .sort((a, b) => time(a.completed_at) - time(b.completed_at))
      .slice(0, 10),
  }
}
