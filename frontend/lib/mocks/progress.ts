// Dữ liệu minh hoạ lịch sử luyện tập của Minh Anh. Khớp với mockRecentInterviews, mockInterviewReport và mockCvVersions.

import type { AnalysisStatus, InterviewRow } from "@/lib/types"

const now = new Date()
/** Lùi từ thời điểm hiện tại, không bao giờ rơi vào tương lai. */
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString()

// ---------- Thang 0–5 cho Tổng quan / Lịch sử của SV ----------

const library = (id: string, title: string, company: string) => ({ id, title, company, source: "library" as const })
const BA = library("jd-ba-intern", "Business Analyst Intern", "Công ty Công nghệ A")
const PO = library("jd-po-assistant", "Product Owner Assistant", "Ngân hàng C")
const DA = library("jd-da-intern", "Data Analyst Intern", "Công ty Thương mại điện tử B")

/**
 * Các buổi đã hoàn thành trước phiên mock, mới nhất trước. Điểm tổng = trung bình 4 tiêu chí.
 * Buổi 50 ngày trước chỉ hiện khi chọn "90 ngày" hoặc "Toàn bộ quá trình".
 */
export const mockInterviewRows: InterviewRow[] = [
  {
    id: "iv-005",
    jd: BA,
    completed_at: ago(0, 1),
    duration_seconds: 16 * 60,
    overall_score: 3.6,
    label: "fair",
    star: { situation: 4.19, task: 3.81, action: 3.6, result: 2.8 },
    timed_out_count: 0,
  },
  {
    id: "iv-004",
    jd: BA,
    completed_at: ago(3, 2),
    duration_seconds: 18 * 60,
    overall_score: 3.4,
    label: "fair",
    star: { situation: 4, task: 3.6, action: 3.4, result: 2.6 },
    timed_out_count: 0,
  },
  {
    id: "iv-003",
    jd: BA,
    completed_at: ago(7, 3),
    duration_seconds: 19 * 60,
    overall_score: 3.1,
    label: "fair",
    star: { situation: 3.8, task: 3.2, action: 3, result: 2.4 },
    timed_out_count: 1,
  },
  {
    id: "iv-002",
    jd: PO,
    completed_at: ago(12, 1),
    duration_seconds: 15 * 60,
    overall_score: 2.7,
    label: "basic",
    star: { situation: 3.2, task: 2.8, action: 2.6, result: 2.2 },
    timed_out_count: 1,
  },
  {
    id: "iv-001",
    jd: BA,
    completed_at: ago(14),
    duration_seconds: 20 * 60,
    overall_score: 2.9,
    label: "basic",
    star: { situation: 3.5, task: 3, action: 2.8, result: 2.3 },
    timed_out_count: 0,
  },
  {
    id: "iv-000",
    jd: DA,
    completed_at: ago(50),
    duration_seconds: 12 * 60,
    overall_score: 2.4,
    label: "basic",
    star: { situation: 3, task: 2.5, action: 2.3, result: 1.8 },
    timed_out_count: 2,
  },
]

/** Các lượt phân tích trước phiên mock, ngoài mockGapAnalysis (ga-001: CV v1.1 với JD Business Analyst Intern). */
export const mockAnalysisSeeds: {
  id: string
  cv_version_id: string
  jd_id: string
  status: AnalysisStatus
  match_score: number | null
  created_at: string
}[] = [
  { id: "ga-000", cv_version_id: "cv-v1", jd_id: BA.id, status: "completed", match_score: 58.3, created_at: ago(10) },
  { id: "ga-po", cv_version_id: "cv-v1", jd_id: PO.id, status: "completed", match_score: 62, created_at: ago(13) },
  { id: "ga-da", cv_version_id: "cv-v1", jd_id: DA.id, status: "failed", match_score: null, created_at: ago(51) },
]
