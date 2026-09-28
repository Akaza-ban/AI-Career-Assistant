// Cài đặt mock cho từng hàm trong lib/api.ts. Trả về cùng kiểu với API thật.

import {
  mockAdvisor,
  mockAdvisorNotifications,
  mockStudentNotifications,
  mockCvVersions,
  mockGapAnalysis,
  mockInterviewReport,
  mockInterviewSession,
  mockJdLibrary,
  mockOverview,
  mockOverviewNewStudent,
  mockQuota,
  mockRecentInterviews,
  mockRoundOptions,
  mockStudent,
} from "@/lib/mocks/data"
import {
  DEFAULT_SUGGESTIONS,
  recentFeedbackSeed,
  seedNotes,
  seedSuggestions,
  studentSeeds,
  syntheticActivity,
  syntheticCv,
  syntheticInterviews,
  toAssignedStudent,
  weeklyScores,
  type StudentSeed,
} from "@/lib/mocks/advisor"
import { mockOptimizerSessionBase } from "@/lib/mocks/optimizer"
import {
  mockCvComparison,
  mockInterviewHistory,
  mockMilestones,
  mockStarFirst,
  mockStarInsight,
} from "@/lib/mocks/progress"
import {
  mockAccessLog,
  mockAdvisorContact,
  mockAdvisorFeedback,
  mockInitialShared,
  mockSettings,
  mockViewers,
} from "@/lib/mocks/sharing"
import type {
  AdvisorInterviewItem,
  AdvisorNote,
  AdvisorNoteRequest,
  AdvisorOverview,
  AdvisorReview,
  AdvisorStudentDetail,
  AssignedStudent,
  CohortProgress,
  CohortProgressQuery,
  JobDescription,
  ReviewInterviewRequest,
  StarScore,
  AppNotification,
  CapabilityAnswerRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ExportCvRequest,
  ExportCvResponse,
  OptimizerSession,
  Suggestion,
  CreateGapAnalysisRequest,
  CreateInterviewRequest,
  CvVersion,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackStatus,
  GapAnalysis,
  InterviewReport,
  InterviewSession,
  InterviewHistoryItem,
  InterviewSummary,
  ProgressMilestone,
  ProgressRange,
  Role,
  SharedItem,
  SharingOverview,
  StudentProgress,
  StudentSettings,
  UpdateSettingsRequest,
  UpdateSharingRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SuggestionDecisionRequest,
  SuggestionDecisionResponse,
} from "@/lib/types"
import { JD_MIN_WORDS } from "@/lib/types"
import { ApiError } from "@/lib/api-error"
import { MOCK_SCENARIO } from "@/lib/config"

const delay = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = <T>(value: T): T => structuredClone(value)

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const submittedFeedback = new Map<string, number>()
let cvVersions = MOCK_SCENARIO === "new_student" ? [] : clone(mockCvVersions)
const quota = clone(mockQuota)
const notifications: Record<Role, AppNotification[]> = {
  student: clone(mockStudentNotifications),
  advisor: clone(mockAdvisorNotifications),
}

// ---- Phiên tối ưu CV (lưu trong bộ nhớ) ----

const sessions: Record<string, OptimizerSession> = {}
const interviews: Record<string, { session: InterviewSession; answered: Set<string> }> = {}
const reports: Record<string, InterviewReport> = {}
const analyses: Record<string, GapAnalysis> = { [mockGapAnalysis.id]: clone(mockGapAnalysis) }

const isNewStudent = MOCK_SCENARIO === "new_student"
let settings: StudentSettings = { ...clone(mockSettings), consent_accepted_at: isNewStudent ? new Date().toISOString() : mockSettings.consent_accepted_at }
/** Trạng thái chia sẻ theo id tài liệu; không có key = riêng tư. */
const shared = new Map(isNewStudent ? [] : Object.entries(clone(mockInitialShared)))
let advisorFeedback = isNewStudent ? [] : clone(mockAdvisorFeedback)
let accessLog = isNewStudent ? [] : clone(mockAccessLog)
/** Mật khẩu hiện tại ở chế độ mock (để thử luồng đổi mật khẩu). */
let mockPassword = "careerx123"

/** Danh sách tài liệu có thể chia sẻ: mọi phiên bản CV và mọi buổi phỏng vấn đã chấm. */
function sharableItems(): SharedItem[] {
  const toItem = (base: Omit<SharedItem, "shared" | "advisor_viewed_at" | "has_advisor_comment">): SharedItem => {
    const state = shared.get(base.id)
    return { ...base, shared: !!state, advisor_viewed_at: state?.viewed_at ?? null, has_advisor_comment: state?.comment ?? false }
  }
  const cvs = cvVersions.map((cv) =>
    toItem({
      id: cv.id,
      kind: "cv",
      title: cv.file_name,
      tag: cv.is_active ? "primary" : cv.is_draft ? "draft" : null,
      created_at: cv.uploaded_at,
      score: cv.ats_score,
    }),
  )
  const finished = Object.values(reports).map((r) => ({ id: r.session_id, round_title: r.round_title, completed_at: r.completed_at, total_score: r.total_score }))
  const history = isNewStudent ? [] : mockInterviewHistory
  const interviewItems = [...finished, ...history].map((iv) =>
    toItem({
      id: iv.id,
      kind: "interview_report",
      title: `Báo cáo ${iv.round_title}`,
      tag: null,
      created_at: iv.completed_at,
      score: iv.total_score,
    }),
  )
  return [...cvs, ...interviewItems]
}

function currentSettings(): StudentSettings {
  const used = cvVersions.reduce((sum, cv) => sum + cv.size_bytes, 0)
  return clone({ ...settings, storage: { ...settings.storage, used_bytes: used } })
}

function ensureSession(analysisId: string): OptimizerSession {
  if (!sessions[analysisId]) {
    const analysis = analyses[analysisId] ?? mockGapAnalysis
    const cv = cvVersions.find((c) => c.id === analysis.cv_version_id) ?? cvVersions[0]
    if (!cv) throw new ApiError(404, "Chưa có CV để tối ưu. Hãy tải CV lên trước.")
    const base = clone(mockOptimizerSessionBase)
    sessions[analysisId] = {
      ...base,
      analysis_id: analysisId,
      jd: { id: analysis.jd.id, title: analysis.jd.title, company: analysis.jd.company },
      cv: clone(cv),
      ats_score: cv.ats_score ?? base.ats_score,
      // Mã gợi ý / mục kiểm tra riêng cho từng phiên để không lẫn giữa các lần phân tích.
      suggestions: base.suggestions.map((sg) => ({ ...sg, id: `${analysisId}-${sg.id}` })),
      capability_checks: base.capability_checks.map((c) => ({ ...c, id: `${analysisId}-${c.id}` })),
    }
  }
  return sessions[analysisId]
}

function findSessionBySuggestion(id: string): OptimizerSession {
  const session = Object.values(sessions).find((s) => s.suggestions.some((x) => x.id === id))
  if (!session) throw new ApiError(404, "Không tìm thấy gợi ý.")
  return session
}

/** Tạo phiên bản CV mới từ phiên bản hiện tại của phiên tối ưu (không ghi đè bản cũ). */
function bumpVersion(session: OptimizerSession): CvVersion {
  const version = Math.max(0, ...cvVersions.map((c) => c.version)) + 1
  const [major = "1", minor = "0"] = session.cv.label.replace(/^v/, "").split(".")
  const created: CvVersion = {
    ...clone(session.cv),
    id: `cv-v${version}`,
    version,
    label: `v${major}.${Number(minor) + 1}`,
    uploaded_at: new Date().toISOString(),
    origin: "optimized",
    latest_analysis_id: session.analysis_id,
    is_active: false,
    is_draft: false,
  }
  cvVersions.unshift(created)
  session.cv = created
  return created
}

// ---------- Trạng thái phía cố vấn ----------

const MINH_ANH = "sv-0142"
const advisorReviews: Record<string, AdvisorReview> = {
  [`${MINH_ANH}:iv-004`]: {
    advisor_name: "ThS. Trần Hoàng Nam",
    score: null,
    comment:
      "Thầy thấy em trả lời rất tự tin và chân thành về lý do chọn vị trí này. Cấu trúc STAR ở câu hỏi về làm việc nhóm rất rõ ràng. Nhìn chung đạt yêu cầu vòng 1.",
    reviewed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
}
const advisorNotes: Record<string, AdvisorNote[]> = clone(seedNotes)

/** Seed của Minh Anh lấy điểm và trạng thái chia sẻ từ dữ liệu phía SV để hai vai trò khớp nhau. */
function minhAnhSeed(): StudentSeed {
  const base = studentSeeds.find((s) => s.id === MINH_ANH)!
  const items = sharableItems()
  const visible = settings.privacy.advisor_access ? items.filter((i) => i.shared) : []
  const history = [...Object.values(reports).map((r) => ({ id: r.session_id, at: r.completed_at, score: r.total_score })), ...mockInterviewHistory.map((i) => ({ id: i.id, at: i.completed_at, score: i.total_score }))]
    .filter((i) => i.id !== "iv-000")
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const pending = visible.filter((i) => i.kind === "interview_report" && !advisorReviews[`${MINH_ANH}:${i.id}`]).length
  const activeCv = cvVersions.find((c) => c.is_active)
  return {
    ...base,
    scores: history.map((h) => h.score),
    shared_items: visible.length,
    total_items: items.length,
    pending_reviews: pending,
    latest_ats: activeCv?.ats_score ?? null,
  }
}

function advisorSeeds(): StudentSeed[] {
  return studentSeeds.map((s) => (s.id === MINH_ANH ? minhAnhSeed() : s))
}

function advisorStudents(): AssignedStudent[] {
  return advisorSeeds().map((seed) => {
    if (seed.id !== MINH_ANH) return toAssignedStudent(seed)
    const latestReport = Object.values(reports).at(-1) ?? mockInterviewReport
    return toAssignedStudent(seed, seed.shared_items > 0 ? { star_average: latestReport.star } : {})
  })
}

function advisorStudentDetail(id: string): AdvisorStudentDetail {
  const seed = advisorSeeds().find((s) => s.id === id)
  if (!seed) throw new ApiError(403, "Bạn không có quyền xem hồ sơ sinh viên này.", "forbidden")
  const student = advisorStudents().find((s) => s.id === id)!
  const hidden = seed.shared_items === 0
  const reviewOf = (sessionId: string, fallback: AdvisorReview | null) => advisorReviews[`${id}:${sessionId}`] ?? fallback

  if (id === MINH_ANH) {
    const visibleIds = new Set(hidden ? [] : sharableItems().filter((i) => i.shared).map((i) => i.id))
    const cvs = cvVersions.filter((c) => visibleIds.has(c.id))
    const interviews: AdvisorInterviewItem[] = [
      ...Object.values(reports).map((r) => ({
        id: r.session_id,
        completed_at: r.completed_at,
        duration_seconds: r.duration_seconds,
        jd: r.jd,
        round_title: r.round_title,
        question_count: r.questions.length,
        total_score: r.total_score,
        question_scores: r.questions.map((q) => q.score),
      })),
      ...mockInterviewHistory.filter((i) => i.id !== "iv-000"),
    ]
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .map((item) => {
        const isShared = visibleIds.has(item.id)
        const review = isShared ? reviewOf(item.id, null) : null
        return {
          ...item,
          shared: isShared,
          summary: isShared
            ? item.id === "iv-005"
              ? mockInterviewReport.summary
              : "Trả lời có cấu trúc STAR, nêu rõ vai trò cá nhân; phần Kết quả cần thêm số liệu cụ thể."
            : null,
          review,
          review_seen_at: review && item.id === "iv-004" ? new Date(Date.now() - 86_400_000).toISOString() : null,
        }
      })
    const analysis = analyses[mockGapAnalysis.id]
    const jd = mockJdLibrary.find((j) => j.id === "jd-ba-intern") ?? null
    return {
      student,
      cvs,
      hidden_cv_count: cvVersions.length - cvs.length,
      target_jd: hidden ? null : jd,
      latest_gap:
        cvs.length > 0 && analysis
          ? {
              analysis_id: analysis.id,
              created_at: analysis.created_at,
              match_score: analysis.match_score,
              matched: analysis.matched_skills.map((s) => s.skill),
              presentation_gaps: analysis.weak_skills.map((s) => s.skill),
              capability_gaps: analysis.missing_skills.map((s) => s.skill),
              unclear: analysis.unclear_skills.map((s) => s.skill),
            }
          : null,
      cv_comparison: visibleIds.has("cv-v2") && visibleIds.has("cv-v3") ? mockCvComparison : null,
      interviews,
      star_insight: hidden ? null : mockStarInsight,
      recent_activity: hidden ? [] : mockOverview.recent_activity,
      notes: advisorNotes[id] ?? [],
      session_suggestions: seedSuggestions[id] ?? DEFAULT_SUGGESTIONS,
    }
  }

  const jd: JobDescription | null =
    hidden || !seed.target_title
      ? null
      : (mockJdLibrary.find((j) => j.title === seed.target_title) ?? {
          id: `${id}-jd`,
          title: seed.target_title,
          company: seed.target_company,
          industry: null,
          level: "intern",
          skills: seed.capability_gaps,
          content: null,
          source: "pasted",
        })
  const jdRef = jd ? { id: jd.id, title: jd.title, company: seed.target_company } : { id: `${id}-free`, title: "Luyện tập tự do", company: null }
  const interviews = hidden
    ? []
    : syntheticInterviews(seed, jdRef).map((item) => ({ ...item, review: reviewOf(item.id, item.review) }))
  return {
    student,
    cvs: hidden ? [] : [syntheticCv(seed)],
    hidden_cv_count: hidden ? 1 : 0,
    target_jd: jd,
    latest_gap:
      jd && seed.latest_ats !== null
        ? {
            analysis_id: `${id}-ga`,
            created_at: syntheticCv(seed).uploaded_at,
            match_score: Math.max(40, seed.latest_ats - 6),
            matched: jd.skills.filter((s) => !seed.capability_gaps.includes(s)).slice(0, 4),
            presentation_gaps: ["Số liệu đo lường trong mục Dự án"],
            capability_gaps: seed.capability_gaps,
            unclear: [],
          }
        : null,
    cv_comparison: null,
    interviews,
    star_insight: hidden ? null : "Phần Kết quả (Result) là tiêu chí thấp nhất: câu trả lời thường dừng ở việc đã làm, chưa nêu số liệu đo được.",
    recent_activity: syntheticActivity(seed),
    notes: advisorNotes[id] ?? [],
    session_suggestions: seedSuggestions[id] ?? DEFAULT_SUGGESTIONS,
  }
}

export const mockApi = {
  async listNotifications(role: Role) {
    await delay(500)
    return clone(notifications[role])
  },

  async markAllNotificationsRead(role: Role) {
    await delay(200)
    notifications[role] = notifications[role].map((n) => ({ ...n, read: true }))
  },

  async getMe(role: Role) {
    await delay(150)
    return clone(role === "advisor" ? mockAdvisor : mockStudent)
  },

  async getQuota() {
    await delay(150)
    return clone(quota)
  },

  async getOverview() {
    await delay()
    return clone(MOCK_SCENARIO === "new_student" ? mockOverviewNewStudent : mockOverview)
  },

  async listCvVersions() {
    await delay()
    return clone(cvVersions)
  },

  // US-SV-01 AC3: sai định dạng hoặc > 10MB thì từ chối, không tạo bản ghi.
  async uploadCv(file: File): Promise<CvVersion> {
    await delay(900)
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext !== "pdf" && ext !== "docx") {
      throw new ApiError(415, "Chỉ hỗ trợ file PDF hoặc DOCX.", "unsupported_file_type")
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, "File vượt quá dung lượng cho phép (tối đa 10MB).", "file_too_large")
    }
    // US-SV-01 AC2: mô phỏng file scan không có lớp văn bản (tên file chứa "scan").
    if (/scan/i.test(file.name)) {
      throw new ApiError(
        422,
        "Không trích xuất được nội dung CV. Có vẻ đây là bản scan ảnh; hãy tải lại bản có lớp văn bản.",
        "cv_not_extractable",
      )
    }
    const version = Math.max(0, ...cvVersions.map((cv) => cv.version)) + 1
    const created: CvVersion = {
      id: `cv-v${version}`,
      version,
      label: `v${version}.0`,
      file_name: file.name,
      file_type: ext,
      size_bytes: file.size,
      page_count: null,
      uploaded_at: new Date().toISOString(),
      status: "ready",
      error_message: null,
      target_title: null,
      ats_score: null,
      ats_note: null,
      origin: "upload",
      latest_analysis_id: null,
      // CV đầu tiên tự động là phiên bản đang dùng.
      is_active: cvVersions.length === 0,
      is_draft: false,
    }
    cvVersions.unshift(created)
    return clone(created)
  },

  async setActiveCv(id: string): Promise<CvVersion> {
    await delay(300)
    if (!cvVersions.some((cv) => cv.id === id)) throw new ApiError(404, "Không tìm thấy phiên bản CV.")
    cvVersions = cvVersions.map((cv) => ({ ...cv, is_active: cv.id === id }))
    return clone(cvVersions.find((cv) => cv.id === id)!)
  },

  async listJdLibrary() {
    await delay()
    return clone(mockJdLibrary)
  },

  // US-SV-02 AC2: JD dán vào phải có ít nhất JD_MIN_WORDS từ.
  async createGapAnalysis(body: CreateGapAnalysisRequest): Promise<GapAnalysis> {
    await delay(1200)
    if (!body.jd_id) {
      const words = body.jd_text?.trim().split(/\s+/).filter(Boolean).length ?? 0
      if (words < JD_MIN_WORDS) {
        throw new ApiError(422, `Nội dung JD quá ngắn (${words} từ). Hãy bổ sung tối thiểu ${JD_MIN_WORDS} từ.`, "jd_too_short")
      }
    }
    const cv = cvVersions.find((c) => c.id === body.cv_version_id)
    if (!cv) throw new ApiError(404, "Không tìm thấy phiên bản CV đã chọn.")
    const libraryJd = body.jd_id ? mockJdLibrary.find((j) => j.id === body.jd_id) : undefined
    if (body.jd_id && !libraryJd) throw new ApiError(404, "Không tìm thấy JD trong thư viện.")
    const id = `ga-${Date.now().toString(36)}`
    // Kết quả gắn đúng cặp (phiên bản CV, JD) đã chọn (US-SV-02 AC1). Nội dung kỹ năng vẫn là dữ liệu mẫu.
    const analysis: GapAnalysis = {
      ...clone(mockGapAnalysis),
      id,
      response_id: `resp-${id}`,
      cv_version_id: cv.id,
      cv_file_name: cv.file_name,
      created_at: new Date().toISOString(),
      ats_score: cv.ats_score ?? mockGapAnalysis.ats_score,
      jd: libraryJd
        ? { id: libraryJd.id, title: libraryJd.title, company: libraryJd.company, level: libraryJd.level }
        : { id: `jd-${id}`, title: body.jd_title ?? "Vị trí tự nhập", company: body.jd_company ?? null, level: "intern" },
    }
    analyses[id] = analysis
    cv.latest_analysis_id = id
    return clone(analysis)
  },

  async getGapAnalysis(id: string): Promise<GapAnalysis> {
    await delay()
    // Sau khi tải lại trang, dữ liệu mock trong bộ nhớ bị xoá: trả về bản mẫu để trang vẫn hiển thị.
    return clone(analyses[id] ?? { ...mockGapAnalysis, id })
  },

  // ---- Trình tối ưu CV (US-SV-03) ----

  async getOptimizerSession(analysisId: string): Promise<OptimizerSession> {
    await delay()
    return clone(ensureSession(analysisId))
  },

  /** US-SV-03 AC1/AC3: chấp nhận/sửa tạo phiên bản CV mới; bỏ qua giữ nguyên CV. */
  async decideSuggestion(id: string, body: SuggestionDecisionRequest): Promise<SuggestionDecisionResponse> {
    await delay()
    const session = findSessionBySuggestion(id)
    const suggestion = session.suggestions.find((s) => s.id === id)!
    if (body.decision === "edit" && !body.edited_text?.trim()) {
      throw new ApiError(422, "Nội dung chỉnh sửa không được để trống.")
    }
    suggestion.status = body.decision === "accept" ? "accepted" : body.decision === "edit" ? "edited" : "rejected"
    if (body.decision === "edit") suggestion.proposed_text = body.edited_text!.trim()
    const newVersion = body.decision === "reject" ? null : bumpVersion(session)
    return { suggestion: clone(suggestion), new_cv_version: newVersion && clone(newVersion) }
  },

  /** US-SV-03 AC2: SV bổ sung ngữ cảnh thật, AI mới đưa ra gợi ý (mock: ghép ngữ cảnh vào câu gốc). */
  async provideSuggestionContext(id: string, answer: string): Promise<Suggestion> {
    await delay(900)
    if (!answer.trim()) throw new ApiError(422, "Hãy nhập ngữ cảnh trước khi gửi.")
    const session = findSessionBySuggestion(id)
    const suggestion = session.suggestions.find((s) => s.id === id)!
    suggestion.needs_context = false
    suggestion.proposed_text = `${suggestion.original_text.replace(/\.$/, "")} – ${answer.trim().replace(/\.$/, "")}.`
    return clone(suggestion)
  },

  async answerCapabilityCheck(id: string, body: CapabilityAnswerRequest): Promise<OptimizerSession> {
    await delay(500)
    const session = Object.values(sessions).find((s) => s.capability_checks.some((c) => c.id === id))
    if (!session) throw new ApiError(404, "Không tìm thấy mục kiểm tra.")
    const check = session.capability_checks.find((c) => c.id === id)!
    check.status = body.has_experience ? "has_experience" : "no_experience"
    check.context = body.has_experience ? (body.context?.trim() ?? null) : null
    if (!body.has_experience && body.learning_note?.trim()) {
      session.document.skills.developing = [
        ...session.document.skills.developing.filter((d) => d.name !== check.skill),
        { name: check.skill, note: body.learning_note.trim() },
      ]
      bumpVersion(session)
    }
    return clone(session)
  },

  async exportCv(cvId: string, body: ExportCvRequest): Promise<ExportCvResponse> {
    await delay(800)
    if (!body.integrity_confirmed) throw new ApiError(422, "Cần xác nhận cam kết liêm chính trước khi xuất CV.")
    if (!cvVersions.some((cv) => cv.id === cvId)) throw new ApiError(404, "Không tìm thấy phiên bản CV.")
    return { download_url: null, confirmed_at: new Date().toISOString() }
  },

  async listInterviewRounds() {
    await delay(200)
    return clone(mockRoundOptions)
  },

  // US-SV-04 AC3: hết lượt trong tuần thì chặn. Mỗi vòng có chấm điểm dùng 1 lượt.
  async createInterview(body: CreateInterviewRequest): Promise<InterviewSession> {
    await delay(700)
    const rounds = mockRoundOptions.filter((r) => body.round_ids.includes(r.id))
    if (rounds.length === 0) throw new ApiError(422, "Hãy chọn ít nhất một vòng phỏng vấn.")
    if (quota.used + rounds.length > quota.limit) {
      throw new ApiError(
        429,
        "Bạn đã dùng hết lượt phỏng vấn có chấm điểm tuần này. Hãy liên hệ cố vấn để xin thêm lượt.",
        "quota_exceeded",
      )
    }
    const jd = mockJdLibrary.find((j) => j.id === body.jd_id)
    if (!jd) throw new ApiError(404, "Không tìm thấy vị trí ứng tuyển.")
    quota.used += rounds.length
    const id = `iv-${Date.now().toString(36)}`
    const session: InterviewSession = {
      ...clone(mockInterviewSession),
      id,
      jd: { id: jd.id, title: jd.title, company: jd.company },
      level: body.level,
      difficulty: body.difficulty,
      round_title: rounds.map((r) => r.title.split(":")[0]).join(" & ") + (rounds.length === 1 ? `: ${rounds[0].title.split(": ")[1]}` : ""),
      started_at: new Date().toISOString(),
    }
    interviews[id] = { session, answered: new Set() }
    return clone(session)
  },

  async getInterview(id: string): Promise<InterviewSession> {
    await delay()
    const stored = interviews[id]
    if (stored) return clone(stored.session)
    // Sau khi tải lại trang: dùng phiên mẫu để trang vẫn hiển thị.
    interviews[id] = { session: { ...clone(mockInterviewSession), id }, answered: new Set() }
    return clone(interviews[id].session)
  },

  // Guardrail đầu vào (B2), mô phỏng đơn giản phía mock.
  async submitAnswer(sessionId: string, body: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    await delay(900)
    const text = body.text.trim()
    const words = text.split(/\s+/).filter(Boolean).length
    if (/(bỏ qua|ignore).{0,20}(hướng dẫn|instruction)|system prompt|đóng vai/i.test(text)) {
      return {
        allowed: false,
        reason: "Câu trả lời có nội dung yêu cầu thay đổi cách AI hoạt động. Hãy trả lời trực tiếp câu hỏi phỏng vấn nhé.",
      }
    }
    if (words < 8) {
      return {
        allowed: false,
        reason: "Câu trả lời hơi ngắn để chấm theo STAR. Hãy kể thêm bối cảnh, việc bạn đã làm và kết quả đạt được.",
      }
    }
    const stored = interviews[sessionId] ?? { session: { ...clone(mockInterviewSession), id: sessionId }, answered: new Set<string>() }
    interviews[sessionId] = stored
    stored.answered.add(body.question_id)
    const questions = stored.session.questions
    const index = questions.findIndex((q) => q.id === body.question_id)
    const hasResult = /(kết quả|giảm|tăng|%|đúng hạn|hoàn thành)/i.test(text)
    return {
      allowed: true,
      response_id: `resp-${sessionId}-${body.question_id}`,
      feedback: hasResult
        ? "Cảm ơn bạn. Câu trả lời đã có bối cảnh và kết quả, mình chuyển sang câu tiếp theo nhé."
        : "Cảm ơn bạn. Gợi ý nhỏ: lần sau hãy nêu thêm kết quả đo được (Result). Mình chuyển sang câu tiếp theo nhé.",
      next_question: index >= 0 && index + 1 < questions.length ? clone(questions[index + 1]) : null,
    }
  },

  /** US-SV-04 AC1/AC2: chỉ chấm điểm khi đã trả lời đủ mọi câu hỏi của vòng. */
  async finishInterview(sessionId: string): Promise<InterviewReport> {
    await delay(1500)
    const stored = interviews[sessionId]
    const total = stored?.session.questions.length ?? mockInterviewSession.questions.length
    const answered = stored?.answered.size ?? 0
    if (answered < total) {
      throw new ApiError(422, `Bạn cần trả lời đủ ${total} câu hỏi (đã trả lời ${answered}) trước khi nộp để chấm điểm.`, "incomplete")
    }
    stored.session.status = "completed"
    const report: InterviewReport = {
      ...clone(mockInterviewReport),
      id: `rp-${sessionId}`,
      response_id: `resp-rp-${sessionId}`,
      session_id: sessionId,
      jd: stored.session.jd,
      round_title: stored.session.round_title,
      completed_at: new Date().toISOString(),
      duration_seconds: Math.max(60, Math.round((Date.now() - new Date(stored.session.started_at).getTime()) / 1000)),
      advisor_review: null,
    }
    reports[sessionId] = report
    return clone(report)
  },

  async getInterviewReport(sessionId: string): Promise<InterviewReport> {
    await delay()
    return clone(reports[sessionId] ?? { ...mockInterviewReport, session_id: sessionId })
  },

  async getProgress(range: ProgressRange): Promise<StudentProgress> {
    await delay(500)
    const updatedAt = new Date().toISOString()
    if (MOCK_SCENARIO === "new_student") {
      return {
        range,
        updated_at: updatedAt,
        first_session: null,
        latest_score: null,
        session_count: 0,
        streak_days: 0,
        target_score: null,
        target_label: null,
        star_first: null,
        star_latest: null,
        star_insight: null,
        cv_comparison: null,
        milestones: [],
        interviews: [],
      }
    }
    // Các buổi vừa hoàn thành trong phiên mock được đưa lên đầu nhật ký.
    const finished: InterviewHistoryItem[] = Object.values(reports).map((r) => ({
      id: r.session_id,
      completed_at: r.completed_at,
      duration_seconds: r.duration_seconds,
      jd: r.jd,
      round_title: r.round_title,
      question_count: r.questions.length,
      total_score: r.total_score,
      question_scores: r.questions.map((q) => q.score),
    }))
    const finishedMilestones: ProgressMilestone[] = finished.map((item) => ({
      id: `m-${item.id}`,
      kind: "interview",
      title: "Hoàn thành buổi phỏng vấn mới",
      description: `Đạt ${item.total_score}/100 điểm STAR ở ${item.round_title}.`,
      occurred_at: item.completed_at,
    }))
    const days = range === "30d" ? 30 : range === "90d" ? 90 : Infinity
    const since = Date.now() - days * 86_400_000
    const inRange = (iso: string) => new Date(iso).getTime() >= since
    const byNewest = (a: { completed_at?: string; occurred_at?: string }, b: typeof a) =>
      new Date(b.completed_at ?? b.occurred_at ?? 0).getTime() - new Date(a.completed_at ?? a.occurred_at ?? 0).getTime()

    const interviews = [...finished, ...mockInterviewHistory].filter((i) => inRange(i.completed_at)).sort(byNewest)
    const oldest = interviews.at(-1)
    const latestReport = Object.values(reports).sort(byNewest)[0] ?? mockInterviewReport
    return clone({
      range,
      updated_at: updatedAt,
      first_session: oldest ? { score: oldest.total_score, completed_at: oldest.completed_at } : null,
      latest_score: interviews[0]?.total_score ?? null,
      session_count: interviews.length,
      streak_days: mockOverview.streak_days,
      target_score: 75,
      target_label: "Mục tiêu cố vấn đặt",
      star_first: oldest ? (mockStarFirst[oldest.id as keyof typeof mockStarFirst] ?? null) : null,
      star_latest: interviews.length > 1 ? latestReport.star : null,
      star_insight: interviews.length > 1 ? mockStarInsight : null,
      cv_comparison: mockCvComparison,
      milestones: [...finishedMilestones, ...mockMilestones].filter((m) => inRange(m.occurred_at)).sort(byNewest),
      interviews,
    })
  },

  async getSharing(): Promise<SharingOverview> {
    await delay()
    return clone({
      advisor: mockAdvisorContact,
      advisor_access: settings.privacy.advisor_access,
      items: sharableItems(),
      viewers: settings.privacy.advisor_access ? mockViewers : mockViewers.filter((v) => v.kind !== "advisor"),
      access_log: accessLog,
      feedback: advisorFeedback,
    })
  },

  async updateSharing(body: UpdateSharingRequest): Promise<SharedItem[]> {
    await delay(300)
    const known = new Set(sharableItems().map((i) => i.id))
    for (const id of body.item_ids) {
      if (!known.has(id)) throw new ApiError(404, "Không tìm thấy tài liệu cần chia sẻ.")
      if (body.shared) {
        if (!shared.has(id)) shared.set(id, { viewed_at: null, comment: false })
      } else {
        shared.delete(id)
      }
    }
    return sharableItems()
  },

  async markAdvisorFeedbackRead(id: string): Promise<void> {
    await delay(150)
    advisorFeedback = advisorFeedback.map((f) => (f.id === id ? { ...f, read: true } : f))
  },

  async getSettings(): Promise<StudentSettings> {
    await delay()
    return currentSettings()
  },

  async updateSettings(body: UpdateSettingsRequest): Promise<StudentSettings> {
    await delay(300)
    settings = {
      ...settings,
      privacy: { ...settings.privacy, ...body.privacy },
      notifications: { ...settings.notifications, ...body.notifications },
    }
    return currentSettings()
  },

  async changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse> {
    await delay(700)
    if (body.current_password !== mockPassword) {
      throw new ApiError(400, "Mật khẩu hiện tại không đúng.", "wrong_password")
    }
    if (body.new_password === mockPassword) {
      throw new ApiError(422, "Mật khẩu mới phải khác mật khẩu hiện tại.", "same_password")
    }
    mockPassword = body.new_password
    settings = { ...settings, password_updated_at: new Date().toISOString() }
    return { password_updated_at: settings.password_updated_at! }
  },

  async deleteCv(id: string): Promise<void> {
    await delay(400)
    const cv = cvVersions.find((c) => c.id === id)
    if (!cv) throw new ApiError(404, "Không tìm thấy phiên bản CV.")
    if (cv.is_active && cvVersions.length > 1) {
      throw new ApiError(409, "Đây là CV đang dùng. Hãy chọn một phiên bản khác làm CV đang dùng trước khi xoá.", "cv_active")
    }
    cvVersions = cvVersions.filter((c) => c.id !== id)
    shared.delete(id)
  },

  async withdrawConsent(): Promise<StudentSettings> {
    await delay(500)
    settings = { ...settings, consent_accepted_at: null }
    return currentSettings()
  },

  async requestDataExport(): Promise<{ download_url: string | null }> {
    await delay(900)
    return { download_url: null }
  },

  async deleteAllData(): Promise<void> {
    await delay(900)
    cvVersions = []
    shared.clear()
    advisorFeedback = []
    accessLog = []
    for (const key of Object.keys(reports)) delete reports[key]
  },

  async listRecentInterviews(): Promise<InterviewSummary[]> {
    await delay(300)
    return MOCK_SCENARIO === "new_student" ? [] : clone(mockRecentInterviews)
  },

  // US-SV-06 AC3: không cho gửi trùng cho cùng một response_id; trả lại giá trị đã lưu.
  async sendFeedback(body: FeedbackRequest): Promise<FeedbackResponse> {
    await delay(300)
    const key = `${body.kind}:${body.response_id}`
    const existing = submittedFeedback.get(key)
    if (existing !== undefined) return { id: `fb-${key}`, already_submitted: true, value: existing }
    submittedFeedback.set(key, body.value)
    return { id: `fb-${key}`, already_submitted: false, value: body.value }
  },

  async getFeedback(responseId: string, kind: "thumb" | "csat"): Promise<FeedbackStatus> {
    await delay(150)
    return { kind, value: submittedFeedback.get(`${kind}:${responseId}`) ?? null }
  },

  // ---------- Cố vấn ----------

  async getAdvisorOverview(): Promise<AdvisorOverview> {
    await delay()
    const students = advisorStudents()
    const withScore = students.filter((s) => s.latest_score !== null)
    const withDelta = students.filter((s) => s.score_delta !== null)
    const avg = withScore.length ? withScore.reduce((sum, s) => sum + s.latest_score!, 0) / withScore.length : null
    const active = students.filter((s) => s.last_active_at && Date.now() - new Date(s.last_active_at).getTime() < 7 * 86_400_000)
    const band = (min: number, max: number) => withScore.filter((s) => s.latest_score! >= min && s.latest_score! <= max).length
    return clone({
      advisor_name: mockAdvisor.full_name,
      student_count: students.length,
      pending_reviews: students.reduce((sum, s) => sum + s.pending_reviews, 0),
      flagged_count: students.filter((s) => s.flagged).length,
      average_score: avg !== null ? Math.round(avg) : null,
      average_score_delta: withDelta.length
        ? Math.round(withDelta.reduce((sum, s) => sum + s.score_delta!, 0) / withDelta.length)
        : null,
      active_rate: Math.round((active.length / students.length) * 100),
      active_target: 60,
      weekly_scores: avg !== null ? weeklyScores(avg) : [],
      score_bands: [
        { label: "Cần hỗ trợ sát", min: 0, max: 49, count: band(0, 49) },
        { label: "Đang rèn luyện STAR", min: 50, max: 74, count: band(50, 74) },
        { label: "Trả lời vững", min: 75, max: 100, count: band(75, 100) },
      ],
      csat: 4.4,
      flagged_students: students.filter((s) => s.flagged),
      recent_feedback: recentFeedbackSeed,
    })
  },

  async listAssignedStudents(): Promise<AssignedStudent[]> {
    await delay()
    return clone(advisorStudents())
  },

  // US-ADV-01 AC3 / US-ADV-03: SV không thuộc danh sách phân công → 403, không trả dữ liệu nào.
  async getAdvisorStudent(id: string): Promise<AdvisorStudentDetail> {
    await delay()
    return clone(advisorStudentDetail(id))
  },

  async reviewInterview(studentId: string, sessionId: string, body: ReviewInterviewRequest): Promise<AdvisorInterviewItem> {
    await delay(600)
    const detail = advisorStudentDetail(studentId)
    const item = detail.interviews.find((i) => i.id === sessionId)
    if (!item || !item.shared) throw new ApiError(403, "Sinh viên chưa chia sẻ buổi phỏng vấn này.", "forbidden")
    if (!body.comment.trim()) throw new ApiError(422, "Hãy nhập nội dung nhận xét.")
    const review: AdvisorReview = {
      advisor_name: mockAdvisor.full_name,
      score: body.score ?? null,
      comment: body.comment.trim(),
      reviewed_at: new Date().toISOString(),
    }
    advisorReviews[`${studentId}:${sessionId}`] = review
    // Minh Anh dùng chung dữ liệu với phía SV: nhận xét hiện ở mục "Phản hồi từ cố vấn".
    if (studentId === MINH_ANH) {
      const state = shared.get(sessionId)
      if (state) shared.set(sessionId, { ...state, comment: true })
      advisorFeedback = [
        {
          id: `fb-${sessionId}-${Date.now()}`,
          advisor_name: review.advisor_name,
          comment: review.comment,
          created_at: review.reviewed_at,
          read: false,
          target: { kind: "interview_report", id: sessionId, label: "Mở báo cáo liên quan" },
        },
        ...advisorFeedback,
      ]
    }
    return clone({ ...item, review, review_seen_at: null })
  },

  async createAdvisorNote(studentId: string, body: AdvisorNoteRequest): Promise<AdvisorNote> {
    await delay(400)
    advisorStudentDetail(studentId)
    if (!body.body.trim()) throw new ApiError(422, "Ghi chú không được để trống.")
    const at = new Date().toISOString()
    const note: AdvisorNote = {
      id: `note-${Date.now().toString(36)}`,
      author_name: mockAdvisor.full_name,
      body: body.body.trim(),
      tags: body.tags,
      pinned: false,
      created_at: at,
      updated_at: at,
    }
    advisorNotes[studentId] = [note, ...(advisorNotes[studentId] ?? [])]
    return clone(note)
  },

  async updateAdvisorNote(studentId: string, noteId: string, body: Partial<AdvisorNoteRequest> & { pinned?: boolean }): Promise<AdvisorNote> {
    await delay(300)
    const notes = advisorNotes[studentId] ?? []
    const note = notes.find((n) => n.id === noteId)
    if (!note) throw new ApiError(404, "Không tìm thấy ghi chú.")
    const updated: AdvisorNote = {
      ...note,
      ...(body.body !== undefined ? { body: body.body.trim() } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.pinned !== undefined ? { pinned: body.pinned } : {}),
      updated_at: new Date().toISOString(),
    }
    advisorNotes[studentId] = notes.map((n) => (n.id === noteId ? updated : n))
    return clone(updated)
  },

  async deleteAdvisorNote(studentId: string, noteId: string): Promise<void> {
    await delay(300)
    advisorNotes[studentId] = (advisorNotes[studentId] ?? []).filter((n) => n.id !== noteId)
  },

  async getCohortProgress(query: CohortProgressQuery): Promise<CohortProgress> {
    await delay(500)
    const all = advisorStudents()
    const students = all.filter(
      (s) => (query.cohort === "all" || s.cohort === query.cohort) && (query.major === "all" || s.major === query.major),
    )
    const withScore = students.filter((s) => s.latest_score !== null)
    const avg = (list: number[]) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null)
    const latestAvg = avg(withScore.map((s) => s.latest_score!))
    const deltas = students.filter((s) => s.score_delta !== null)
    const starList = students.map((s) => s.star_average).filter((s): s is StarScore => s !== null)
    const starAvg: StarScore | null = starList.length
      ? {
          situation: avg(starList.map((s) => s.situation))!,
          task: avg(starList.map((s) => s.task))!,
          action: avg(starList.map((s) => s.action))!,
          result: avg(starList.map((s) => s.result))!,
        }
      : null
    const majors = [...new Set(students.map((s) => s.major))]
    const ats = students.filter((s) => s.latest_ats !== null)
    const inactive = (s: AssignedStudent) =>
      !s.last_active_at || Date.now() - new Date(s.last_active_at).getTime() > 10 * 86_400_000
    const needsSupport: CohortProgress["needs_support"] = []
    for (const s of students) {
      if (s.shared_items === 0) needsSupport.push({ student: s, issue: "Chưa chia sẻ dữ liệu", kind: "not_shared" })
      else if (s.flagged) needsSupport.push({ student: s, issue: `Vòng ${s.flag_rounds?.join(", ")} không tăng điểm`, kind: "flagged" })
      else if (inactive(s)) needsSupport.push({ student: s, issue: "Không hoạt động hơn 10 ngày", kind: "inactive" })
      else if (s.latest_score !== null && s.latest_score < 50) needsSupport.push({ student: s, issue: `Điểm gần nhất ${s.latest_score}/100`, kind: "low_score" })
    }
    return clone({
      student_count: students.length,
      active_count: students.filter((s) => !inactive(s)).length,
      active_target: 60,
      first_average: avg(withScore.map((s) => s.first_score!)),
      latest_average: latestAvg,
      csat: 4.4,
      csat_target: 4,
      ats_before: ats.length ? avg(ats.map((s) => s.latest_ats! - 9)) : null,
      ats_after: ats.length ? avg(ats.map((s) => s.latest_ats!)) : null,
      weekly_scores: latestAvg !== null ? weeklyScores(latestAvg).map((w, i, arr) => ({ ...w, label: query.range === "term" ? `Tháng ${i + 1}` : i === arr.length - 1 ? "Tuần này" : w.label })) : [],
      star_average: starAvg,
      star_weakest: starAvg
        ? {
            key: "result",
            note: "Nhiều sinh viên chưa nêu số liệu đo lường (KPI, tỷ lệ %, thời gian tiết kiệm) ở phần Kết quả. Nên ưu tiên hướng dẫn công thức Hành động + Công cụ + Số liệu.",
          }
        : null,
      by_major: majors
        .map((major) => {
          const group = students.filter((s) => s.major === major && s.latest_score !== null)
          return {
            major,
            student_count: students.filter((s) => s.major === major).length,
            average: avg(group.map((s) => s.latest_score!)) ?? 0,
            delta: avg(group.filter((s) => s.score_delta !== null).map((s) => s.score_delta!)) ?? 0,
          }
        })
        .sort((a, b) => b.average - a.average),
      distribution: {
        high: deltas.filter((s) => s.score_delta! >= 15).length,
        stable: deltas.filter((s) => s.score_delta! >= 5 && s.score_delta! < 15).length,
        low: deltas.filter((s) => s.score_delta! < 5).length,
        insufficient: students.length - deltas.length,
      },
      top_improvers: [...deltas].sort((a, b) => b.score_delta! - a.score_delta!).slice(0, 5),
      needs_support: needsSupport,
    })
  },
}
