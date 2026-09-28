// Lớp gọi API duy nhất của frontend. Mọi trang chỉ import từ đây.
// USE_MOCK = true → trả dữ liệu từ lib/mocks; false → gọi backend FastAPI tại /api/v1/...
// Danh sách endpoint bên dưới là đề xuất của frontend, cần backend xác nhận.

import { ApiError } from "@/lib/api-error"
import { API_BASE_URL, USE_MOCK } from "@/lib/config"
import { mockApi } from "@/lib/mocks/handlers"
import type {
  AdvisorInterviewItem,
  AdvisorNote,
  AdvisorNoteRequest,
  AdvisorOverview,
  AdvisorStudentDetail,
  CohortProgress,
  CohortProgressQuery,
  ReviewInterviewRequest,
  ApiErrorBody,
  CapabilityAnswerRequest,
  ChangePasswordRequest,
  ChangePasswordResponse,
  ExportCvRequest,
  ExportCvResponse,
  OptimizerSession,
  Suggestion,
  AppNotification,
  AssignedStudent,
  CreateGapAnalysisRequest,
  CreateInterviewRequest,
  CvVersion,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackStatus,
  GapAnalysis,
  InterviewQuota,
  InterviewReport,
  InterviewRoundOption,
  InterviewSession,
  InterviewSummary,
  JobDescription,
  ProgressRange,
  Role,
  SharedItem,
  SharingOverview,
  StudentOverview,
  StudentProgress,
  StudentSettings,
  UpdateSettingsRequest,
  UpdateSharingRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SuggestionDecisionRequest,
  SuggestionDecisionResponse,
  UserProfile,
} from "@/lib/types"

export { ApiError }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    credentials: "include",
  })
  if (!res.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = (await res.json()) as ApiErrorBody
    } catch {
      // Body không phải JSON; dùng thông báo mặc định bên dưới.
    }
    throw new ApiError(res.status, body?.detail ?? `Yêu cầu thất bại (${res.status}).`, body?.code)
  }
  // 204 No Content (ví dụ DELETE) không có body.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) })

export const api = {
  // ---- Người dùng ----
  getMe: (role: Role): Promise<UserProfile> => (USE_MOCK ? mockApi.getMe(role) : request("/me")),
  getQuota: (): Promise<InterviewQuota> => (USE_MOCK ? mockApi.getQuota() : request("/interviews/quota")),
  getOverview: (): Promise<StudentOverview> => (USE_MOCK ? mockApi.getOverview() : request("/students/me/overview")),
  getProgress: (range: ProgressRange): Promise<StudentProgress> =>
    USE_MOCK ? mockApi.getProgress(range) : request(`/students/me/progress?range=${range}`),

  // ---- Thông báo ----
  listNotifications: (role: Role): Promise<AppNotification[]> =>
    USE_MOCK ? mockApi.listNotifications(role) : request("/notifications"),
  markAllNotificationsRead: (role: Role): Promise<void> =>
    USE_MOCK ? mockApi.markAllNotificationsRead(role) : request("/notifications/read-all", { method: "POST" }),

  // ---- CV ----
  listCvVersions: (): Promise<CvVersion[]> => (USE_MOCK ? mockApi.listCvVersions() : request("/cv")),
  uploadCv: (file: File): Promise<CvVersion> => {
    if (USE_MOCK) return mockApi.uploadCv(file)
    const form = new FormData()
    form.append("file", file)
    return request("/cv/upload", { method: "POST", body: form })
  },
  setActiveCv: (id: string): Promise<CvVersion> =>
    USE_MOCK ? mockApi.setActiveCv(id) : request(`/cv/${encodeURIComponent(id)}/activate`, { method: "POST" }),

  // ---- JD & phân tích khoảng cách ----
  listJdLibrary: (): Promise<JobDescription[]> => (USE_MOCK ? mockApi.listJdLibrary() : request("/jd/library")),
  createGapAnalysis: (body: CreateGapAnalysisRequest): Promise<GapAnalysis> =>
    USE_MOCK ? mockApi.createGapAnalysis(body) : request("/gap-analysis", json(body)),
  getGapAnalysis: (id: string): Promise<GapAnalysis> =>
    USE_MOCK ? mockApi.getGapAnalysis(id) : request(`/gap-analysis/${encodeURIComponent(id)}`),

  // ---- Trình tối ưu CV & Xuất CV (US-SV-03) ----
  getOptimizerSession: (analysisId: string): Promise<OptimizerSession> =>
    USE_MOCK
      ? mockApi.getOptimizerSession(analysisId)
      : request(`/gap-analysis/${encodeURIComponent(analysisId)}/optimizer`),
  decideSuggestion: (id: string, body: SuggestionDecisionRequest): Promise<SuggestionDecisionResponse> =>
    USE_MOCK ? mockApi.decideSuggestion(id, body) : request(`/suggestions/${encodeURIComponent(id)}/decision`, json(body)),
  provideSuggestionContext: (id: string, answer: string): Promise<Suggestion> =>
    USE_MOCK
      ? mockApi.provideSuggestionContext(id, answer)
      : request(`/suggestions/${encodeURIComponent(id)}/context`, json({ answer })),
  answerCapabilityCheck: (id: string, body: CapabilityAnswerRequest): Promise<OptimizerSession> =>
    USE_MOCK
      ? mockApi.answerCapabilityCheck(id, body)
      : request(`/capability-checks/${encodeURIComponent(id)}/answer`, json(body)),
  exportCv: (cvId: string, body: ExportCvRequest): Promise<ExportCvResponse> =>
    USE_MOCK ? mockApi.exportCv(cvId, body) : request(`/cv/${encodeURIComponent(cvId)}/export`, json(body)),

  // ---- Phỏng vấn ----
  listInterviewRounds: (): Promise<InterviewRoundOption[]> =>
    USE_MOCK ? mockApi.listInterviewRounds() : request("/interviews/rounds"),
  createInterview: (body: CreateInterviewRequest): Promise<InterviewSession> =>
    USE_MOCK ? mockApi.createInterview(body) : request("/mock-interview/start", json(body)),
  getInterview: (id: string): Promise<InterviewSession> =>
    USE_MOCK ? mockApi.getInterview(id) : request(`/mock-interview/${encodeURIComponent(id)}`),
  submitAnswer: (sessionId: string, body: SubmitAnswerRequest): Promise<SubmitAnswerResponse> =>
    USE_MOCK
      ? mockApi.submitAnswer(sessionId, body)
      : request(`/mock-interview/${encodeURIComponent(sessionId)}/answers`, json(body)),
  finishInterview: (sessionId: string): Promise<InterviewReport> =>
    USE_MOCK
      ? mockApi.finishInterview(sessionId)
      : request(`/mock-interview/${encodeURIComponent(sessionId)}/finish`, { method: "POST" }),
  listRecentInterviews: (): Promise<InterviewSummary[]> =>
    USE_MOCK ? mockApi.listRecentInterviews() : request("/mock-interview/recent"),
  getInterviewReport: (sessionId: string): Promise<InterviewReport> =>
    USE_MOCK
      ? mockApi.getInterviewReport(sessionId)
      : request(`/mock-interview/${encodeURIComponent(sessionId)}/report`),

  // ---- Phản hồi (B3) ----
  sendFeedback: (body: FeedbackRequest): Promise<FeedbackResponse> =>
    USE_MOCK ? mockApi.sendFeedback(body) : request("/feedback", json(body)),
  getFeedback: (responseId: string, kind: "thumb" | "csat"): Promise<FeedbackStatus> =>
    USE_MOCK
      ? mockApi.getFeedback(responseId, kind)
      : request(`/feedback?response_id=${encodeURIComponent(responseId)}&kind=${kind}`),

  // ---- Chia sẻ với Cố vấn ----
  getSharing: (): Promise<SharingOverview> => (USE_MOCK ? mockApi.getSharing() : request("/students/me/sharing")),
  updateSharing: (body: UpdateSharingRequest): Promise<SharedItem[]> =>
    USE_MOCK ? mockApi.updateSharing(body) : request("/students/me/sharing", { ...json(body), method: "PATCH" }),
  markAdvisorFeedbackRead: (id: string): Promise<void> =>
    USE_MOCK ? mockApi.markAdvisorFeedbackRead(id) : request(`/advisor-feedback/${encodeURIComponent(id)}/read`, { method: "POST" }),

  // ---- Cài đặt & Quyền riêng tư ----
  getSettings: (): Promise<StudentSettings> => (USE_MOCK ? mockApi.getSettings() : request("/students/me/settings")),
  updateSettings: (body: UpdateSettingsRequest): Promise<StudentSettings> =>
    USE_MOCK ? mockApi.updateSettings(body) : request("/students/me/settings", { ...json(body), method: "PATCH" }),
  /** Lỗi 400 code "wrong_password" khi mật khẩu hiện tại không đúng. */
  changePassword: (body: ChangePasswordRequest): Promise<ChangePasswordResponse> =>
    USE_MOCK ? mockApi.changePassword(body) : request("/auth/change-password", json(body)),
  /** Link tải file gốc của một phiên bản CV; null ở chế độ mock (không có file thật). */
  cvDownloadUrl: (id: string): string | null => (USE_MOCK ? null : `${API_BASE_URL}/api/v1/cv/${encodeURIComponent(id)}/file`),
  deleteCv: (id: string): Promise<void> =>
    USE_MOCK ? mockApi.deleteCv(id) : request(`/cv/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Các thao tác dữ liệu (feature flag dataActions). */
  withdrawConsent: (): Promise<StudentSettings> =>
    USE_MOCK ? mockApi.withdrawConsent() : request("/students/me/consent/withdraw", { method: "POST" }),
  requestDataExport: (): Promise<{ download_url: string | null }> =>
    USE_MOCK ? mockApi.requestDataExport() : request("/students/me/data-export", { method: "POST" }),
  deleteAllData: (): Promise<void> =>
    USE_MOCK ? mockApi.deleteAllData() : request("/students/me/data", { method: "DELETE" }),

  // ---- Cố vấn (RBAC: backend chỉ trả SV được phân công, lỗi 403 "forbidden" nếu không) ----
  getAdvisorOverview: (): Promise<AdvisorOverview> =>
    USE_MOCK ? mockApi.getAdvisorOverview() : request("/advisor/overview"),
  listAssignedStudents: (): Promise<AssignedStudent[]> =>
    USE_MOCK ? mockApi.listAssignedStudents() : request("/advisor/students"),
  getAdvisorStudent: (id: string): Promise<AdvisorStudentDetail> =>
    USE_MOCK ? mockApi.getAdvisorStudent(id) : request(`/advisor/students/${encodeURIComponent(id)}`),
  reviewInterview: (studentId: string, sessionId: string, body: ReviewInterviewRequest): Promise<AdvisorInterviewItem> =>
    USE_MOCK
      ? mockApi.reviewInterview(studentId, sessionId, body)
      : request(`/advisor/students/${encodeURIComponent(studentId)}/interviews/${encodeURIComponent(sessionId)}/review`, json(body)),
  createAdvisorNote: (studentId: string, body: AdvisorNoteRequest): Promise<AdvisorNote> =>
    USE_MOCK
      ? mockApi.createAdvisorNote(studentId, body)
      : request(`/advisor/students/${encodeURIComponent(studentId)}/notes`, json(body)),
  updateAdvisorNote: (
    studentId: string,
    noteId: string,
    body: Partial<AdvisorNoteRequest> & { pinned?: boolean },
  ): Promise<AdvisorNote> =>
    USE_MOCK
      ? mockApi.updateAdvisorNote(studentId, noteId, body)
      : request(`/advisor/students/${encodeURIComponent(studentId)}/notes/${encodeURIComponent(noteId)}`, {
          ...json(body),
          method: "PATCH",
        }),
  deleteAdvisorNote: (studentId: string, noteId: string): Promise<void> =>
    USE_MOCK
      ? mockApi.deleteAdvisorNote(studentId, noteId)
      : request(`/advisor/students/${encodeURIComponent(studentId)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" }),
  getCohortProgress: (query: CohortProgressQuery): Promise<CohortProgress> =>
    USE_MOCK
      ? mockApi.getCohortProgress(query)
      : request(`/advisor/progress?${new URLSearchParams({ range: query.range, cohort: query.cohort, major: query.major })}`),
}
