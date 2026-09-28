// Dữ liệu minh hoạ cho màn "Lịch sử & Tiến bộ". Khớp với mockRecentInterviews và mockCvVersions.

import type { CvComparison, InterviewHistoryItem, ProgressMilestone, StarScore } from "@/lib/types"

const now = new Date()
const at = (days: number, hour: number, minute = 0) => {
  const d = new Date(now.getTime() - days * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const baJd = { id: "jd-ba-intern", title: "Business Analyst Intern", company: "Công ty Công nghệ A" }

/** Mới nhất trước. Buổi 50 ngày trước chỉ hiện khi chọn "90 ngày" hoặc "Toàn bộ quá trình". */
export const mockInterviewHistory: InterviewHistoryItem[] = [
  {
    id: "iv-005",
    completed_at: at(0, 9, 30),
    duration_seconds: 28 * 60,
    jd: baJd,
    round_title: "Vòng 1 & 2 (HR & Chuyên môn)",
    question_count: 8,
    total_score: 82,
    question_scores: [76, 80, 78, 84, 81, 85, 83, 88],
  },
  {
    id: "iv-004",
    completed_at: at(3, 20, 15),
    duration_seconds: 18 * 60,
    jd: baJd,
    round_title: "Vòng 1 (HR & Động lực)",
    question_count: 4,
    total_score: 88,
    question_scores: [82, 86, 90, 94],
  },
  {
    id: "iv-003",
    completed_at: at(7, 19, 40),
    duration_seconds: 22 * 60,
    jd: baJd,
    round_title: "Vòng 3 (Tình huống Agile)",
    question_count: 4,
    total_score: 74,
    question_scores: [75, 73, 74, 74],
  },
  {
    id: "iv-002",
    completed_at: at(12, 21, 5),
    duration_seconds: 15 * 60,
    jd: { id: "jd-po-assistant", title: "Product Owner Assistant", company: "Ngân hàng C" },
    round_title: "Vòng 1 (HR cơ bản)",
    question_count: 3,
    total_score: 68,
    question_scores: [64, 68, 72],
  },
  {
    id: "iv-001",
    completed_at: at(21, 14, 0),
    duration_seconds: 25 * 60,
    jd: baJd,
    round_title: "Vòng làm quen",
    question_count: 5,
    total_score: 61,
    question_scores: [66, 63, 60, 58, 58],
  },
  {
    id: "iv-000",
    completed_at: at(50, 10, 0),
    duration_seconds: 12 * 60,
    jd: { id: "jd-da-intern", title: "Data Analyst Intern", company: "Công ty Thương mại điện tử B" },
    round_title: "Vòng thử nghiệm",
    question_count: 3,
    total_score: 55,
    question_scores: [52, 56, 57],
  },
]

/** STAR của buổi đầu tiên trong từng khoảng; buổi gần nhất lấy từ mockInterviewReport. */
export const mockStarFirst: Record<"iv-001" | "iv-000", StarScore> = {
  "iv-001": { situation: 72, task: 64, action: 58, result: 48 },
  "iv-000": { situation: 66, task: 58, action: 52, result: 44 },
}

export const mockStarInsight =
  "Điểm Kết quả (Result) tăng rõ nhờ bạn đã bổ sung các con số đo lường cụ thể (KPI, % thời gian tiết kiệm) khi kể về đồ án."

export const mockCvComparison: CvComparison = {
  from: { id: "cv-v2", version: 2, file_name: "CV_NguyenMinhAnh_BA.pdf" },
  to: { id: "cv-v3", version: 3, file_name: "Business_Analyst_MinhAnh_v2.pdf" },
  jd_title: "Business Analyst Intern",
  analysis_id: "ga-001",
  ats_before: 76,
  ats_after: 85,
  match_before: 64,
  match_after: 78,
  keywords_before: 7,
  keywords_after: 13,
  keywords_added: ["User Story", "BPMN 2.0", "SQL", "UAT", "Agile/Scrum", "Stakeholder Mapping"],
}

export const mockMilestones: ProgressMilestone[] = [
  {
    id: "m-iv-005",
    kind: "interview",
    title: "Hoàn thành buổi phỏng vấn thứ 5",
    description: "Đạt 82/100 điểm STAR. Trả lời tốt câu hỏi xử lý xung đột yêu cầu (Scope Creep).",
    occurred_at: at(0, 9, 30),
  },
  {
    id: "m-export",
    kind: "cv_export",
    title: "Xuất CV phiên bản 3",
    description: "Độ khớp với JD Business Analyst Intern tăng từ 64% lên 78% sau khi áp dụng gợi ý.",
    occurred_at: at(1, 22, 10),
  },
  {
    id: "m-advisor",
    kind: "advisor_comment",
    title: "Cố vấn phản hồi",
    description: "ThS. Trần Hoàng Nam để lại 2 ghi chú cho câu hỏi tình huống số 2 và 4.",
    occurred_at: at(2, 16, 0),
  },
  {
    id: "m-start",
    kind: "start",
    title: "Khởi đầu hành trình",
    description: "Tải lên CV đầu tiên và hoàn thành buổi phỏng vấn làm quen (61/100).",
    occurred_at: at(21, 14, 0),
  },
  {
    id: "m-trial",
    kind: "interview",
    title: "Buổi thử nghiệm đầu tiên",
    description: "Làm quen với phòng phỏng vấn ở vị trí Data Analyst Intern (55/100).",
    occurred_at: at(50, 10, 0),
  },
]
