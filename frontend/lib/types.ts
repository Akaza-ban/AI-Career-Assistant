// Hợp đồng dữ liệu frontend ↔ backend (bản nháp do frontend đề xuất).
// Tên field dùng snake_case để khớp trực tiếp với Pydantic schema ở src/models/schemas.py.
// Khi backend chốt schema, sửa file này cho khớp; các trang chỉ phụ thuộc vào đây và lib/api.ts.

export type Role = "student" | "advisor"

export type ISODateString = string

// ---------- Người dùng & hạn mức ----------

export interface UserProfile {
  id: string
  role: Role
  full_name: string
  /** Ví dụ "KDQT - K2021" */
  subtitle: string
  avatar_url: string | null
}

/** Hạn mức phỏng vấn có chấm điểm trong tuần (NFR: 3 vòng/SV/vị trí/tuần). */
export interface InterviewQuota {
  used: number
  limit: number
  resets_at: ISODateString
}

// ---------- CV (US-SV-01) ----------

export type CvFileType = "pdf" | "docx"
export type CvStatus = "processing" | "ready" | "failed"

export interface CvVersion {
  id: string
  /** Tăng dần, không ghi đè bản cũ. */
  version: number
  label: string
  file_name: string
  file_type: CvFileType
  size_bytes: number
  page_count: number | null
  uploaded_at: ISODateString
  status: CvStatus
  /** Lý do khi status = "failed", ví dụ file scan không có lớp văn bản (US-SV-01 AC2). */
  error_message: string | null
  target_title: string | null
  ats_score: number | null
  /** Ghi chú ngắn cạnh điểm ATS, ví dụ "Khớp 11/14 từ khoá", "Thiếu chỉ số định lượng". */
  ats_note: string | null
  /** "upload": SV tự tải lên; "optimized": tạo ra khi áp dụng gợi ý (US-SV-03). */
  origin: "upload" | "optimized"
  /** Lần phân tích gần nhất của phiên bản này; dùng cho nút "Tối ưu". */
  latest_analysis_id: string | null
  is_active: boolean
  is_draft: boolean
}

// ---------- JD (US-SV-02) ----------

export type JobLevel = "intern" | "fresher" | "junior"

export interface JobDescription {
  id: string
  title: string
  company: string | null
  industry: string | null
  level: JobLevel
  skills: string[]
  /** Toàn văn JD; thư viện có thể trả null ở danh sách và chỉ trả đầy đủ khi xem chi tiết. */
  content: string | null
  source: "library" | "pasted"
}

/** Ngưỡng JD tối thiểu khi dán text (US-SV-02 AC2). */
export const JD_MIN_WORDS = 50

export interface CreateGapAnalysisRequest {
  cv_version_id: string
  /** Chọn từ thư viện... */
  jd_id?: string
  /** ...hoặc dán nội dung (≥ JD_MIN_WORDS từ). */
  jd_text?: string
  jd_title?: string
  jd_company?: string
}

// ---------- Phân tích khoảng cách (US-SV-02, US-SV-05) ----------

/**
 * matched  → "Đạt yêu cầu" (xanh)
 * weak     → "Mức độ yếu" (vàng) — khoảng cách trình bày, có gợi ý diễn đạt lại
 * missing  → "Thiếu trong CV" (đỏ) — khoảng cách năng lực, không tự sửa bằng câu chữ
 * unclear  → "Cần SV xem xét thủ công" (xám) — không đủ tin cậy để phân loại (US-SV-05 AC3)
 */
export type SkillStatus = "matched" | "weak" | "missing" | "unclear"

/** Đoạn trích từ CV làm bằng chứng cho một đánh giá. */
export interface EvidenceSpan {
  text: string
  line_start: number
  line_end: number
}

export interface SkillAssessment {
  skill: string
  /** Mô tả ngắn từ JD, ví dụ "Bắt buộc · Mức độ cơ bản". */
  requirement_note: string | null
  status: SkillStatus
  /** null khi không tìm thấy bằng chứng trong CV. */
  evidence_span: EvidenceSpan | null
  /** Nhận xét / đề xuất ngắn của AI cho kỹ năng này. */
  advice: string | null
}

export type SuggestionStatus = "pending" | "accepted" | "edited" | "rejected"

export type SuggestionKind = "rephrase" | "star_quantify" | "ats_keyword"

export interface Suggestion {
  id: string
  kind: SuggestionKind
  skill: string
  /** Dòng trong CvDocument mà gợi ý này thay thế. */
  line_id: string
  original_text: string
  proposed_text: string
  /** Lý do AI đề xuất (hiển thị trên thẻ gợi ý). */
  rationale: string
  evidence_span: EvidenceSpan
  status: SuggestionStatus
  /** true khi AI cần SV bổ sung ngữ cảnh/chứng cứ trước khi gợi ý (US-SV-03 AC2). */
  needs_context: boolean
  context_question: string | null
}

// ---------- Nội dung CV (hiển thị ở Trình tối ưu và Xuất CV) ----------

export interface CvDocLine {
  id: string
  /** Số dòng trong CV gốc, khớp với EvidenceSpan.line_start. */
  line_no: number
  text: string
}

export interface CvDocEntry {
  id: string
  title: string | null
  /** Ví dụ "Đồ án môn Phân tích thiết kế hệ thống · 09/2023 – 12/2023" */
  meta: string | null
  lines: CvDocLine[]
}

export interface CvDocSection {
  id: string
  title: string
  entries: CvDocEntry[]
}

export interface CvDocument {
  full_name: string
  headline: string
  email: string
  phone: string | null
  location: string | null
  sections: CvDocSection[]
  skills: {
    confirmed: string[]
    /** Kỹ năng SV xác nhận đang học (không ghi là thành thạo). */
    developing: { name: string; note: string }[]
  }
}

// ---------- Trình tối ưu CV (US-SV-03) & Xuất CV ----------

/** Khoảng cách năng lực cần SV tự xác nhận; AI không tự thêm kỹ năng vào CV. */
export interface CapabilityCheck {
  id: string
  skill: string
  jd_requirement: string
  status: "pending" | "has_experience" | "no_experience"
  /** Ngữ cảnh SV cung cấp khi chọn "đã có kinh nghiệm". */
  context: string | null
}

export interface AtsCheck {
  label: string
  passed: boolean
}

export interface OptimizerSession {
  analysis_id: string
  jd: Pick<JobDescription, "id" | "title" | "company">
  /** Phiên bản CV mới nhất trong phiên tối ưu (tăng mỗi lần áp dụng gợi ý). */
  cv: CvVersion
  document: CvDocument
  suggestions: Suggestion[]
  capability_checks: CapabilityCheck[]
  ats_score: number | null
  ats_checks: AtsCheck[]
}

export interface CapabilityAnswerRequest {
  has_experience: boolean
  context?: string
  /**
   * Chỉ khi has_experience = false: SV tự ghi mình đang học kỹ năng này (ví dụ "Đang học chứng chỉ PL-300").
   * Khi có, kỹ năng được thêm vào mục "Kỹ năng đang phát triển", không bao giờ ghi là thành thạo.
   */
  learning_note?: string
}

export interface ExportCvRequest {
  format: "pdf" | "docx"
  /** SV đã tick cam kết liêm chính học thuật. */
  integrity_confirmed: true
}

export interface ExportCvResponse {
  /** null ở chế độ mock. */
  download_url: string | null
  confirmed_at: ISODateString
}

export interface GapAnalysis {
  id: string
  /** Dùng cho FeedbackWidget. */
  response_id: string
  cv_version_id: string
  cv_file_name: string
  jd: Pick<JobDescription, "id" | "title" | "company" | "level">
  created_at: ISODateString
  /** Độ khớp tổng thể 0–100, backend tính. */
  match_score: number
  ats_score: number | null
  matched_skills: SkillAssessment[]
  weak_skills: SkillAssessment[]
  missing_skills: SkillAssessment[]
  unclear_skills: SkillAssessment[]
  suggestions: Suggestion[]
  summary: string | null
  /** Nhận xét ngắn về định dạng CV với trình đọc ATS, ví dụ "Bố cục 1 cột, không có bảng phức tạp". */
  ats_feedback: string | null
  /** Việc nên làm tiếp theo, hiển thị ở thẻ "Lời khuyên từ Cố vấn AI". */
  next_steps: { title: string; description: string }[]
}

export interface SuggestionDecisionRequest {
  decision: "accept" | "edit" | "reject"
  /** Bắt buộc khi decision = "edit". */
  edited_text?: string
}

export interface SuggestionDecisionResponse {
  suggestion: Suggestion
  /** Có khi chấp nhận/sửa tạo ra version CV mới (US-SV-03 AC1). */
  new_cv_version: CvVersion | null
}

// ---------- Phỏng vấn thử (US-SV-04) ----------

export interface InterviewRoundOption {
  id: string
  title: string
  description: string
  minutes: number
  question_count: number
  focus_jd: boolean
}

export type InterviewDifficulty = "gentle" | "realistic" | "stress"
export type InterviewMode = "text" | "voice"

export interface CreateInterviewRequest {
  jd_id: string
  cv_version_id: string
  level: JobLevel
  round_ids: string[]
  difficulty: InterviewDifficulty
  mode: InterviewMode
  question_count: number
}

export interface InterviewQuestion {
  id: string
  index: number
  text: string
  /** Kỹ năng/mục JD mà câu hỏi dựa trên. */
  based_on: string | null
}

export type InterviewStatus = "in_progress" | "completed" | "abandoned"

export interface InterviewSession {
  id: string
  jd: Pick<JobDescription, "id" | "title" | "company">
  level: JobLevel
  difficulty: InterviewDifficulty
  round_title: string
  status: InterviewStatus
  started_at: ISODateString
  time_limit_seconds_per_question: number | null
  questions: InterviewQuestion[]
  current_index: number
}

export interface SubmitAnswerRequest {
  question_id: string
  text: string
}

/** Kết quả guardrail đầu vào (B2): câu trả lời bị từ chối thì không tính lượt. */
export type SubmitAnswerResponse =
  | {
      allowed: true
      response_id: string
      /** Nhận xét ngắn ngay sau câu trả lời (có thể null). */
      feedback: string | null
      next_question: InterviewQuestion | null
    }
  | {
      allowed: false
      /** Câu thông báo hiển thị trực tiếp cho SV. */
      reason: string
    }

export interface StarScore {
  situation: number
  task: number
  action: number
  result: number
}

export interface QuestionEvaluation {
  question_id: string
  index: number
  skill: string
  question: string
  answer_excerpt: string
  answer_seconds: number | null
  score: number
  /** Nhãn ngắn cho câu điểm thấp, ví dụ "Thiếu yếu tố Hành động (Action)". */
  gap_label: string | null
  strengths: string[]
  improvements: string[]
  /** Chẩn đoán STAR và câu trả lời mẫu, có ở câu điểm thấp. */
  diagnosis: string | null
  sample_answer: string | null
}

export interface InterviewReport {
  id: string
  response_id: string
  session_id: string
  jd: Pick<JobDescription, "id" | "title" | "company">
  round_title: string
  completed_at: ISODateString
  duration_seconds: number
  total_score: number
  star: StarScore
  /** Nhận xét ngắn cho từng tiêu chí STAR. */
  star_notes: Partial<Record<keyof StarScore, string>>
  summary: string
  questions: QuestionEvaluation[]
  advisor_review: AdvisorReview | null
}

/** Một buổi phỏng vấn đã chấm, dùng cho danh sách "Điểm các buổi gần nhất". */
export interface InterviewSummary {
  id: string
  title: string
  completed_at: ISODateString
  total_score: number
  /** Ví dụ "A: 85 • R: 72" hoặc "Cần bổ sung chỉ số định lượng". */
  note: string | null
}

export interface AdvisorReview {
  advisor_name: string
  score: number | null
  comment: string
  reviewed_at: ISODateString
}

// ---------- Phản hồi (B3, US-SV-06) ----------

export type FeedbackRequest =
  | {
      response_id: string
      kind: "thumb"
      /** 1 = hữu ích, -1 = chưa hữu ích */
      value: 1 | -1
      comment?: string
    }
  | {
      response_id: string
      kind: "csat"
      /** 1–5 sao */
      value: 1 | 2 | 3 | 4 | 5
      activity: "gap_analysis" | "interview"
      comment?: string
    }

export interface FeedbackResponse {
  id: string
  /** Đã có phản hồi trước đó cho cùng response_id (US-SV-06 AC3). */
  already_submitted: boolean
  /** Giá trị đang được lưu (giá trị cũ nếu already_submitted = true). */
  value: number
}

/** Phản hồi đã gửi cho một response_id; value = null nếu chưa gửi. */
export interface FeedbackStatus {
  kind: "thumb" | "csat"
  value: number | null
}

// ---------- Tổng quan & tiến bộ ----------

export interface ActivityItem {
  id: string
  kind: "interview" | "cv_optimized" | "advisor_comment" | "gap_analysis"
  title: string
  description: string
  occurred_at: ISODateString
}

export interface StudentOverview {
  cv_version_count: number
  /** Thời điểm tải/tạo phiên bản CV gần nhất. */
  cv_latest_at: ISODateString | null
  interview_count: number
  /** Số ngày liên tiếp có luyện tập; 0 khi không có chuỗi. */
  streak_days: number
  latest_score: number | null
  /** latest_score − điểm vòng đầu; null khi chưa đủ 2 vòng. */
  score_delta: number | null
  target: Pick<JobDescription, "title" | "company"> | null
  current_match_score: number | null
  /** Điểm trung bình từng tiêu chí STAR (0–100); null khi chưa có buổi phỏng vấn nào. */
  star_average: StarScore | null
  /** Ghi chú ngắn cho tiêu chí còn yếu, ví dụ { result: "Bổ sung % chỉ số" }. */
  star_notes: Partial<Record<keyof StarScore, string>>
  recent_activity: ActivityItem[]
  advisor_tip: { advisor_name: string; text: string } | null
}

// ---------- Lịch sử & Tiến bộ ----------

export type ProgressRange = "30d" | "90d" | "all"

/** Một buổi phỏng vấn đã chấm trong nhật ký. */
export interface InterviewHistoryItem {
  /** id phiên phỏng vấn, dùng cho link báo cáo. */
  id: string
  completed_at: ISODateString
  duration_seconds: number
  jd: Pick<JobDescription, "id" | "title" | "company">
  round_title: string
  question_count: number
  total_score: number
  /** Điểm từng câu theo thứ tự, vẽ đường xu hướng trong buổi. */
  question_scores: number[]
}

type CvRef = Pick<CvVersion, "id" | "version" | "file_name">

/** So sánh bản CV đầu tiên và bản tối ưu gần nhất với cùng một JD. */
export interface CvComparison {
  from: CvRef
  to: CvRef
  jd_title: string
  /** Lần phân tích của bản mới nhất, dùng cho link "Xem chi tiết". */
  analysis_id: string | null
  ats_before: number
  ats_after: number
  match_before: number
  match_after: number
  keywords_before: number
  keywords_after: number
  /** Từ khoá chuyên môn được bổ sung (có bằng chứng trong CV). */
  keywords_added: string[]
}

export interface ProgressMilestone {
  id: string
  kind: "interview" | "advisor_comment" | "cv_export" | "start"
  title: string
  description: string
  occurred_at: ISODateString
}

export interface StudentProgress {
  range: ProgressRange
  updated_at: ISODateString
  /** Buổi chấm điểm đầu tiên trong khoảng thời gian; null khi chưa có buổi nào. */
  first_session: { score: number; completed_at: ISODateString } | null
  latest_score: number | null
  session_count: number
  streak_days: number
  /** Điểm tham chiếu vẽ trên biểu đồ (ví dụ mức cố vấn đặt cho vị trí mục tiêu); null nếu không có. */
  target_score: number | null
  target_label: string | null
  star_first: StarScore | null
  star_latest: StarScore | null
  /** Nhận xét ngắn của AI về thay đổi STAR giữa buổi đầu và buổi gần nhất. */
  star_insight: string | null
  cv_comparison: CvComparison | null
  milestones: ProgressMilestone[]
  /** Mới nhất trước. */
  interviews: InterviewHistoryItem[]
}

// ---------- Chia sẻ với Cố vấn ----------

export interface AdvisorContact {
  id: string
  full_name: string
  /** Ví dụ "Cố vấn Nghề nghiệp Khoa Hệ thống Thông tin Kinh tế & Quản lý" */
  title: string
  email: string
  office: string | null
  /** Ví dụ "Thứ 3 & Thứ 5 (14:00 – 16:30)" */
  office_hours: string | null
  avatar_url: string | null
}

export type SharedItemKind = "cv" | "interview_report"

/** Một tài liệu SV có thể bật/tắt chia sẻ. Mặc định mọi tài liệu là riêng tư. */
export interface SharedItem {
  /** id của CV version hoặc phiên phỏng vấn. */
  id: string
  kind: SharedItemKind
  title: string
  /** "primary": CV đang dùng; "draft": bản nháp. */
  tag: "primary" | "draft" | null
  created_at: ISODateString
  /** Điểm ATS (CV) hoặc điểm STAR (báo cáo phỏng vấn). */
  score: number | null
  shared: boolean
  /** Lần gần nhất cố vấn mở tài liệu; null nếu chưa xem. */
  advisor_viewed_at: ISODateString | null
  has_advisor_comment: boolean
}

/** Người/đơn vị đang có quyền xem dữ liệu của SV. */
export interface DataViewer {
  id: string
  kind: "advisor" | "department"
  name: string
  description: string
  /** Ví dụ "Xem & nhận xét", "Chỉ số liệu tổng hợp, ẩn danh". */
  permission: string
  last_viewed_at: ISODateString | null
}

export interface AccessLogEntry {
  id: string
  actor: string
  action: "viewed" | "downloaded" | "commented"
  target: string
  occurred_at: ISODateString
}

export interface AdvisorFeedback {
  id: string
  advisor_name: string
  comment: string
  created_at: ISODateString
  read: boolean
  target: { kind: SharedItemKind; id: string; label: string }
}

export interface SharingOverview {
  /** null khi SV chưa được phân công cố vấn. */
  advisor: AdvisorContact | null
  /** Công tắc tổng ở Cài đặt; false thì cố vấn không xem được gì dù từng mục đang bật. */
  advisor_access: boolean
  items: SharedItem[]
  viewers: DataViewer[]
  /** 30 ngày gần nhất, mới nhất trước. */
  access_log: AccessLogEntry[]
  feedback: AdvisorFeedback[]
}

export interface UpdateSharingRequest {
  item_ids: string[]
  shared: boolean
}

// ---------- Cài đặt & Quyền riêng tư ----------

export interface StudentSettings {
  email: string
  student_code: string
  faculty: string
  /** Lần đổi mật khẩu gần nhất; null nếu chưa đổi kể từ khi tạo tài khoản. */
  password_updated_at: ISODateString | null
  /** Thời điểm SV đồng ý điều khoản xử lý dữ liệu & cam kết liêm chính; null nếu đã rút lại. */
  consent_accepted_at: ISODateString | null
  storage: { used_bytes: number; limit_bytes: number; allocated_by: string }
  privacy: {
    /** Công tắc tổng cho phép cố vấn xem các tài liệu đang bật chia sẻ. */
    advisor_access: boolean
    /** Đóng góp dữ liệu đã ẩn danh để cải thiện chất lượng gợi ý. */
    anonymous_contribution: boolean
  }
  notifications: {
    advisor_comment: boolean
    report_ready: boolean
    weekly_reminder: boolean
    /** Gửi thêm qua email, ngoài chuông thông báo trong hệ thống. */
    email: boolean
  }
}

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  password_updated_at: ISODateString
}

export interface UpdateSettingsRequest {
  privacy?: Partial<StudentSettings["privacy"]>
  notifications?: Partial<StudentSettings["notifications"]>
}

// ---------- Cố vấn (US-ADV-01..03) ----------
// RBAC: mọi endpoint /advisor/* chỉ trả dữ liệu SV thuộc danh sách phân công của cố vấn đang đăng nhập
// (lỗi 403 "forbidden" nếu không), và chỉ những tài liệu SV đã bật chia sẻ.

export interface AssignedStudent {
  id: string
  full_name: string
  /** Ví dụ "KDQT - K2021" */
  subtitle: string
  student_code: string
  email: string
  major: string
  cohort: string
  avatar_url: string | null
  target_title: string | null
  target_company: string | null
  first_score: number | null
  latest_score: number | null
  /** null khi chưa đủ 2 vòng → hiển thị "Chưa đủ dữ liệu" (US-ADV-01 AC2). */
  score_delta: number | null
  interview_count: number
  /** Cờ "Cần chú ý" khi 2 vòng liên tiếp không tăng (US-ADV-02). */
  flagged: boolean
  flagged_at: ISODateString | null
  /** Số thứ tự các vòng liên quan tới cờ, ví dụ [3, 4, 5] (US-ADV-02 AC1). */
  flag_rounds: number[] | null
  capability_gaps: string[]
  last_active_at: ISODateString | null
  latest_ats: number | null
  /** Điểm STAR trung bình (0–100) trên các buổi đã chia sẻ. */
  star_average: StarScore | null
  /** Số tài liệu đang chia sẻ / tổng số tài liệu của SV. 0 = SV chưa chia sẻ gì. */
  shared_items: number
  total_items: number
  /** Số buổi phỏng vấn đã chia sẻ nhưng cố vấn chưa nhận xét. */
  pending_reviews: number
}

/** Nhận xét của cố vấn cho một buổi phỏng vấn (human-in-the-loop). */
export interface ReviewInterviewRequest {
  comment: string
  /** Điểm cố vấn chốt (0–100); bỏ trống = giữ điểm AI. */
  score?: number
}

export interface AdvisorInterviewItem extends InterviewHistoryItem {
  shared: boolean
  /** Tóm tắt ngắn của AI về buổi phỏng vấn. */
  summary: string | null
  review: AdvisorReview | null
  /** Lúc SV mở xem nhận xét; null nếu chưa xem. */
  review_seen_at: ISODateString | null
}

export type AdvisorNoteTag = "behavior" | "soft_skill" | "technical" | "watch"

/** Ghi chú nội bộ: chỉ cố vấn thấy, SV không bao giờ thấy. */
export interface AdvisorNote {
  id: string
  author_name: string
  body: string
  tags: AdvisorNoteTag[]
  pinned: boolean
  created_at: ISODateString
  updated_at: ISODateString
}

export interface AdvisorNoteRequest {
  body: string
  tags: AdvisorNoteTag[]
}

/** Kết quả phân tích khoảng cách gần nhất, rút gọn cho cố vấn (US-ADV-03 AC1). */
export interface AdvisorGapSummary {
  analysis_id: string
  created_at: ISODateString
  match_score: number
  matched: string[]
  /** Khoảng cách trình bày (weak). */
  presentation_gaps: string[]
  /** Khoảng cách năng lực (missing). */
  capability_gaps: string[]
  unclear: string[]
}

export interface AdvisorStudentDetail {
  student: AssignedStudent
  /** Các phiên bản CV SV đã chia sẻ, mới nhất trước (US-ADV-03 AC2). */
  cvs: CvVersion[]
  /** Số phiên bản CV SV chưa chia sẻ. */
  hidden_cv_count: number
  /** null → "SV chưa chọn vị trí ứng tuyển" (US-ADV-03 AC3). */
  target_jd: JobDescription | null
  latest_gap: AdvisorGapSummary | null
  cv_comparison: CvComparison | null
  interviews: AdvisorInterviewItem[]
  /** Nhận xét ngắn của AI về tiêu chí STAR yếu nhất. */
  star_insight: string | null
  recent_activity: ActivityItem[]
  notes: AdvisorNote[]
  /** Gợi ý của AI cho buổi tư vấn tiếp theo. */
  session_suggestions: string[]
}

export interface ScoreBand {
  label: string
  min: number
  max: number
  count: number
}

export interface AdvisorOverview {
  advisor_name: string
  student_count: number
  pending_reviews: number
  flagged_count: number
  average_score: number | null
  average_score_delta: number | null
  /** Tỷ lệ SV có ít nhất 1 hoạt động trong 30 ngày (0–100). */
  active_rate: number
  active_target: number
  weekly_scores: { label: string; value: number }[]
  score_bands: ScoreBand[]
  csat: number | null
  flagged_students: AssignedStudent[]
  recent_feedback: {
    id: string
    student_id: string
    student_name: string
    excerpt: string
    sent_at: ISODateString
    seen_at: ISODateString | null
  }[]
}

export type CohortRange = "30d" | "90d" | "term"

export interface CohortProgressQuery {
  range: CohortRange
  cohort: string | "all"
  major: string | "all"
}

export interface CohortProgress {
  student_count: number
  active_count: number
  active_target: number
  first_average: number | null
  latest_average: number | null
  csat: number | null
  csat_target: number
  ats_before: number | null
  ats_after: number | null
  weekly_scores: { label: string; value: number }[]
  star_average: StarScore | null
  /** Tiêu chí yếu nhất và ghi chú ngắn. */
  star_weakest: { key: keyof StarScore; note: string } | null
  by_major: { major: string; student_count: number; average: number; delta: number }[]
  /** Tiến bộ nhiều (≥15), ổn định (5–14), cần can thiệp (<5 hoặc giảm), chưa đủ dữ liệu. */
  distribution: { high: number; stable: number; low: number; insufficient: number }
  top_improvers: AssignedStudent[]
  needs_support: { student: AssignedStudent; issue: string; kind: "flagged" | "inactive" | "low_score" | "not_shared" }[]
}

// ---------- Thông báo (chuông trên topbar) ----------

export type NotificationKind =
  | "advisor_comment"
  | "interview_report"
  | "gap_analysis"
  | "integrity_alert"
  | "student_activity"
  | "student_inactive"

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  created_at: ISODateString
  read: boolean
  /** Nút hành động (ví dụ "Xem báo cáo") dẫn tới trang liên quan. */
  action_label: string | null
  action_href: string | null
}

// ---------- Lỗi ----------

export interface ApiErrorBody {
  detail: string
  code?: string
}
