// Lớp gọi API duy nhất của frontend. Mọi trang chỉ import từ đây.
// Mỗi hàm thuộc một nhóm (ApiGroup): nhóm có trong NEXT_PUBLIC_LIVE_APIS gọi backend FastAPI
// tại /api/v1/..., các nhóm còn lại trả dữ liệu từ lib/mocks.
// Endpoint của nhóm chưa nối là đề xuất của frontend, sẽ chốt khi nối từng luồng.

import { ApiError } from "@/lib/api-error"
import { API_BASE_URL, isLive, type ApiGroup } from "@/lib/config"
import { mockApi } from "@/lib/mocks/handlers"
import { clearAuthMode, getAuthMode } from "@/lib/session"
import type {
  AdvisorInterviewReport,
  AdvisorNote,
  AdvisorNoteRequest,
  AdvisorNoteUpdate,
  AdvisorOverview,
  AdvisorReviewInfo,
  AdvisorStudentDetail,
  AdvisorStudentProgress,
  ApiErrorBody,
  AppNotification,
  AssignedStudent,
  CapabilityAnswerRequest,
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RegisterRequest,
  ChatMessage,
  ChangePasswordResponse,
  CompareJdsRequest,
  CompareJdsResponse,
  Conversation,
  ConversationSummary,
  CreateGapAnalysisRequest,
  CreateInterviewRequest,
  CreatePastedJdRequest,
  CvVersion,
  ExportCvRequest,
  ExportCvResponse,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackStatus,
  GapAnalysis,
  InterviewQuota,
  InterviewReport,
  InterviewSession,
  InterviewSummary,
  JobDescription,
  OptimizerSession,
  ProgressRange,
  RecommendJdsRequest,
  RecommendJdsResponse,
  ReviewInterviewRequest,
  Role,
  SavedJd,
  SharedItem,
  SharingOverview,
  StudentOverview,
  StudentProgress,
  StudentSettings,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SuggestionDecisionRequest,
  UpdateProfileRequest,
  UpdateSettingsRequest,
  UpdateSharingRequest,
  UserProfile,
} from "@/lib/types"

export { ApiError }


/** Gửi request tới backend; lỗi mạng hoặc HTTP được đổi thành ApiError với thông báo hiển thị được. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const isForm = init?.body instanceof FormData
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
      credentials: "include",
    })
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.", "network_error")
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> | null = null
    try {
      body = (await res.json()) as Partial<ApiErrorBody>
    } catch {
      // Body không phải JSON; dùng thông báo mặc định bên dưới.
    }
    const detail = typeof body?.detail === "string" ? body.detail : `Yêu cầu thất bại (${res.status}).`
    // Phiên đăng nhập hết hạn: về trang Đăng nhập (trừ chính các request của trang tài khoản)
    if (res.status === 401 && getAuthMode() && !path.startsWith("/auth/") && typeof window !== "undefined") {
      clearAuthMode()
      window.location.assign("/login?expired=1")
    }
    throw new ApiError(res.status, detail, body?.code)
  }
  return res
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init)
  // 204 No Content (ví dụ DELETE) không có body.
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) })

const advisorStudentPath = (studentId: string) => `/advisor/students/${encodeURIComponent(studentId)}`
const conversationPath = (studentId: string) => `/conversations/${encodeURIComponent(studentId)}`
const optimizerPath = (analysisId: string) => `/gap-analysis/${encodeURIComponent(analysisId)}/optimizer`

/** Gọi backend khi nhóm đã bật trong NEXT_PUBLIC_LIVE_APIS, ngược lại dùng mock. */
function via<T>(group: ApiGroup, mock: () => Promise<T>, live: () => Promise<T>): Promise<T> {
  return isLive(group) ? live() : mock()
}

export const api = {
  // ---- Tài khoản ----
  login: (body: LoginRequest): Promise<LoginResponse> =>
    via("auth", () => mockApi.login(body), () => request("/auth/login", json(body))),
  register: (body: RegisterRequest): Promise<LoginResponse> =>
    via("auth", () => mockApi.register(body), () => request("/auth/register", json(body))),
  /** Luôn trả thành công dù email có tồn tại hay không, để không lộ ai có tài khoản. */
  requestPasswordReset: (body: PasswordResetRequest): Promise<void> =>
    via("auth", () => mockApi.requestPasswordReset(body), () => request("/auth/password-reset", json(body))),
  confirmPasswordReset: (body: PasswordResetConfirmRequest): Promise<LoginResponse> =>
    via("auth", () => mockApi.confirmPasswordReset(body), () => request("/auth/password-reset/confirm", json(body))),
  /** Kết thúc phiên đăng nhập (cookie); không lỗi nếu phiên đã hết. */
  logout: (): Promise<void> => via("auth", async () => {}, () => request("/auth/logout", { method: "POST" })),

  // ---- Người dùng ----
  getMe: (role: Role): Promise<UserProfile> =>
    via("me", () => mockApi.getMe(role), () => request("/me")),
  getOverview: (): Promise<StudentOverview> =>
    via("overview", () => mockApi.getOverview(), () => request("/students/me/overview")),
  /** jdId = null: mọi vị trí. */
  getProgress: (range: ProgressRange, jdId: string | null): Promise<StudentProgress> =>
    via(
      "overview",
      () => mockApi.getProgress(range, jdId),
      () =>
        request(`/students/me/progress?${new URLSearchParams({ range, ...(jdId ? { jd_id: jdId } : {}) })}`),
    ),

  // ---- Thông báo ----
  listNotifications: (role: Role): Promise<AppNotification[]> =>
    via(
      "notifications",
      () => mockApi.listNotifications(role),
      () => request("/notifications"),
    ),
  markNotificationRead: (role: Role, id: string): Promise<void> =>
    via(
      "notifications",
      () => mockApi.markNotificationRead(role, id),
      () =>
        request(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }),
    ),
  markAllNotificationsRead: (role: Role): Promise<void> =>
    via(
      "notifications",
      () => mockApi.markAllNotificationsRead(role),
      () => request("/notifications/read-all", { method: "POST" }),
    ),

  // ---- Tin nhắn SV ↔ cố vấn phụ trách (hội thoại theo mã SV) ----
  listConversations: (role: Role): Promise<ConversationSummary[]> =>
    via("messages", () => mockApi.listConversations(role), () => request("/conversations")),
  getConversation: (role: Role, studentId: string): Promise<Conversation> =>
    via("messages", () => mockApi.getConversation(role, studentId), () => request(conversationPath(studentId))),
  sendMessage: (role: Role, studentId: string, body: string): Promise<ChatMessage> =>
    via(
      "messages",
      () => mockApi.sendMessage(role, studentId, body),
      () => request(`${conversationPath(studentId)}/messages`, json({ body })),
    ),
  /** Đánh dấu đã đọc các tin người kia gửi (người kia thấy "Đã xem"). */
  markConversationRead: (role: Role, studentId: string): Promise<void> =>
    via(
      "messages",
      () => mockApi.markConversationRead(role, studentId),
      () => request(`${conversationPath(studentId)}/read`, { method: "POST" }),
    ),
  getUnreadMessageCount: (role: Role): Promise<number> =>
    via(
      "messages",
      () => mockApi.getUnreadMessageCount(role),
      async () => (await request<{ count: number }>("/conversations/unread-count")).count,
    ),

  // ---- CV ----
  /** Mỗi CV một dòng: phiên bản mới nhất kèm số phiên bản. */
  listCvVersions: (): Promise<CvVersion[]> => via("cv", () => mockApi.listCvVersions(), () => request("/cv")),
  /** Lịch sử phiên bản của CV chứa phiên bản id (nhận cả mã CV), mới nhất trước. */
  listCvHistory: (id: string): Promise<CvVersion[]> =>
    via("cv", () => mockApi.listCvHistory(id), () => request(`/cv/${encodeURIComponent(id)}/versions`)),
  /** Khôi phục phiên bản id thành bản mới nhất của CV (số chính +1); không xoá bản nào. */
  restoreCv: (id: string): Promise<CvVersion> =>
    via("cv", () => mockApi.restoreCv(id), () => request(`/cv/${encodeURIComponent(id)}/restore`, { method: "POST" })),
  uploadCv: (file: File): Promise<CvVersion> =>
    via(
      "cv",
      () => mockApi.uploadCv(file),
      () => {
        const form = new FormData()
        form.append("file", file)
        return request("/cv/upload", { method: "POST", body: form })
      },
    ),
  setActiveCv: (id: string): Promise<CvVersion> =>
    via("cv", () => mockApi.setActiveCv(id), () => request(`/cv/${encodeURIComponent(id)}/activate`, { method: "POST" })),
  /** File gốc của một phiên bản CV; null ở chế độ mock (không có file thật). */
  getCvFile: (id: string): Promise<Blob | null> =>
    via("cv", async () => null, async () => (await send(`/cv/${encodeURIComponent(id)}/file`)).blob()),
  /** Văn bản đã trích từ CV, dùng xem nhanh file DOCX (và PDF khi không có file, ví dụ ở chế độ mock). */
  getCvText: (id: string): Promise<string | null> =>
    via(
      "cv",
      () => mockApi.getCvText(id),
      async () => (await request<{ text: string }>(`/cv/${encodeURIComponent(id)}/text`)).text,
    ),
  /** Xoá cả CV (mọi phiên bản) chứa phiên bản id. */
  deleteCv: (id: string): Promise<void> =>
    via("cv", () => mockApi.deleteCv(id), () => request(`/cv/${encodeURIComponent(id)}`, { method: "DELETE" })),

  // ---- JD & phân tích khoảng cách ----
  listJdLibrary: (): Promise<JobDescription[]> => via("gap", () => mockApi.listJdLibrary(), () => request("/jd/library")),
  /** Gợi ý vị trí theo CV (tối đa top_n), chấm theo quy tắc; advice do LLM viết cho vị trí #1 khi generate_advice. */
  recommendJds: (body: RecommendJdsRequest): Promise<RecommendJdsResponse> =>
    via("gap", () => mockApi.recommendJds(body), () => request("/jd/recommend", json(body))),
  listSavedJds: (): Promise<SavedJd[]> => via("gap", () => mockApi.listSavedJds(), () => request("/jd/saved")),
  saveJd: (jdId: string): Promise<SavedJd> =>
    via("gap", () => mockApi.saveJd(jdId), () => request(`/jd/${encodeURIComponent(jdId)}/saved`, { method: "PUT" })),
  unsaveJd: (jdId: string): Promise<void> =>
    via("gap", () => mockApi.unsaveJd(jdId), () => request(`/jd/${encodeURIComponent(jdId)}/saved`, { method: "DELETE" })),
  /** Vị trí SV chọn được: thư viện JD và các JD SV đã tự dán (GET /jd). */
  listMyJds: (): Promise<JobDescription[]> => via("gap", () => mockApi.listMyJds(), () => request("/jd")),
  /** Lưu JD tự dán để dùng lại (so sánh nhiều vị trí chỉ nhận jd_ids). */
  createPastedJd: (body: CreatePastedJdRequest): Promise<JobDescription> =>
    via("gap", () => mockApi.createPastedJd(body), () => request("/jd", json(body))),
  /** So sánh CV với 2–3 JD qua LLM; kết quả sắp theo match_score giảm dần. */
  compareJds: (body: CompareJdsRequest): Promise<CompareJdsResponse> =>
    via("gap", () => mockApi.compareJds(body), () => request("/jd/compare", json(body))),
  createGapAnalysis: (body: CreateGapAnalysisRequest): Promise<GapAnalysis> =>
    via("gap", () => mockApi.createGapAnalysis(body), () => request("/gap-analysis", json(body))),
  getGapAnalysis: (id: string): Promise<GapAnalysis> =>
    via("gap", () => mockApi.getGapAnalysis(id), () => request(`/gap-analysis/${encodeURIComponent(id)}`)),

  // ---- Trình tối ưu CV & Xuất CV (US-SV-03) ----
  getOptimizerSession: (analysisId: string): Promise<OptimizerSession> =>
    via(
      "optimizer",
      () => mockApi.getOptimizerSession(analysisId),
      () => request(optimizerPath(analysisId)),
    ),
  /** Quyết định nằm trong bản nháp, chưa tạo phiên bản CV mới; trả về trạng thái trình tối ưu sau khi lưu. */
  decideSuggestion: (analysisId: string, id: string, body: SuggestionDecisionRequest): Promise<OptimizerSession> =>
    via(
      "optimizer",
      () => mockApi.decideSuggestion(analysisId, id, body),
      () => request(`${optimizerPath(analysisId)}/suggestions/${encodeURIComponent(id)}`, json(body)),
    ),
  /** US-SV-03 AC2: mới có ở chế độ mock; backend chưa bao giờ trả gợi ý needs_context. */
  provideSuggestionContext: (analysisId: string, id: string, answer: string): Promise<OptimizerSession> =>
    via(
      "optimizer",
      () => mockApi.provideSuggestionContext(analysisId, id, answer),
      () => request(`${optimizerPath(analysisId)}/suggestions/${encodeURIComponent(id)}/context`, json({ answer })),
    ),
  answerCapabilityCheck: (analysisId: string, id: string, body: CapabilityAnswerRequest): Promise<OptimizerSession> =>
    via(
      "optimizer",
      () => mockApi.answerCapabilityCheck(analysisId, id, body),
      () => request(`${optimizerPath(analysisId)}/capability-checks/${encodeURIComponent(id)}`, json(body)),
    ),
  /** "Hoàn tất": tạo đúng một phiên bản CV mới từ bản nháp rồi khoá trình tối ưu. */
  finalizeOptimization: (analysisId: string): Promise<OptimizerSession> =>
    via(
      "optimizer",
      () => mockApi.finalizeOptimization(analysisId),
      () => request(`${optimizerPath(analysisId)}/finalize`, { method: "POST" }),
    ),
  /** Ghi nhận cam kết liêm chính cho một lần xuất CV (tải file / in / sao chép câu đã sửa). */
  exportCv: (cvId: string, body: ExportCvRequest): Promise<ExportCvResponse> =>
    via("optimizer", () => mockApi.exportCv(cvId, body), () => request(`/cv/${encodeURIComponent(cvId)}/export`, json(body))),

  // ---- Phỏng vấn (US-SV-04) ----
  /** Vị trí để luyện phỏng vấn: thư viện JD và các JD SV đã tự dán khi phân tích. */
  listInterviewJds: (): Promise<JobDescription[]> => via("interview", () => mockApi.listInterviewJds(), () => request("/jd")),
  getQuota: (jdId: string): Promise<InterviewQuota> =>
    via("interview", () => mockApi.getQuota(jdId), () => request(`/interviews/quota?jd_id=${encodeURIComponent(jdId)}`)),
  /** Lỗi 429 "quota_exceeded" khi đã hết 3 buổi của vị trí trong tuần. Buổi đang dở (nếu có) bị huỷ. */
  createInterview: (body: CreateInterviewRequest): Promise<InterviewSession> =>
    via("interview", () => mockApi.createInterview(body), () => request("/interviews", json(body))),
  /** Lỗi 410 "interview_expired" khi SV rời phòng quá lâu (buổi đã bị huỷ). */
  getInterview: (id: string): Promise<InterviewSession> =>
    via("interview", () => mockApi.getInterview(id), () => request(`/interviews/${encodeURIComponent(id)}`)),
  submitAnswer: (sessionId: string, body: SubmitAnswerRequest): Promise<SubmitAnswerResponse> =>
    via(
      "interview",
      () => mockApi.submitAnswer(sessionId, body),
      () => request(`/interviews/${encodeURIComponent(sessionId)}/answers`, json(body)),
    ),
  pauseInterview: (sessionId: string): Promise<InterviewSession> =>
    via(
      "interview",
      () => mockApi.pauseInterview(sessionId),
      () => request(`/interviews/${encodeURIComponent(sessionId)}/pause`, { method: "POST" }),
    ),
  resumeInterview: (sessionId: string): Promise<InterviewSession> =>
    via(
      "interview",
      () => mockApi.resumeInterview(sessionId),
      () => request(`/interviews/${encodeURIComponent(sessionId)}/resume`, { method: "POST" }),
    ),
  /** Kết thúc sớm: buổi bị xoá hẳn và không tính lượt. */
  abandonInterview: (sessionId: string): Promise<void> =>
    via(
      "interview",
      () => mockApi.abandonInterview(sessionId),
      () => request(`/interviews/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    ),
  listRecentInterviews: (): Promise<InterviewSummary[]> =>
    via("interview", () => mockApi.listRecentInterviews(), () => request("/interviews?limit=5")),
  getInterviewReport: (sessionId: string): Promise<InterviewReport> =>
    via(
      "interview",
      () => mockApi.getInterviewReport(sessionId),
      () => request(`/interviews/${encodeURIComponent(sessionId)}/report`),
    ),

  // ---- Phản hồi (B3) ----
  sendFeedback: (body: FeedbackRequest): Promise<FeedbackResponse> =>
    via("feedback", () => mockApi.sendFeedback(body), () => request("/feedback", json(body))),
  getFeedback: (responseId: string, kind: "thumb" | "csat"): Promise<FeedbackStatus> =>
    via(
      "feedback",
      () => mockApi.getFeedback(responseId, kind),
      () => request(`/feedback?response_id=${encodeURIComponent(responseId)}&kind=${kind}`),
    ),

  // ---- Chia sẻ với Cố vấn ----
  getSharing: (): Promise<SharingOverview> =>
    via("sharing", () => mockApi.getSharing(), () => request("/students/me/sharing")),
  updateSharing: (body: UpdateSharingRequest): Promise<SharedItem[]> =>
    via(
      "sharing",
      () => mockApi.updateSharing(body),
      () => request("/students/me/sharing", { ...json(body), method: "PATCH" }),
    ),
  markAdvisorFeedbackRead: (id: string): Promise<void> =>
    via(
      "sharing",
      () => mockApi.markAdvisorFeedbackRead(id),
      () => request(`/students/me/advisor-feedback/${encodeURIComponent(id)}/read`, { method: "POST" }),
    ),

  // ---- Cài đặt & Quyền riêng tư ----
  getSettings: (): Promise<StudentSettings> =>
    via("settings", () => mockApi.getSettings(), () => request("/students/me/settings")),
  updateSettings: (body: UpdateSettingsRequest): Promise<StudentSettings> =>
    via(
      "settings",
      () => mockApi.updateSettings(body),
      () => request("/students/me/settings", { ...json(body), method: "PATCH" }),
    ),
  /** Lỗi 422 "invalid_phone" / "invalid_date_of_birth" / "invalid_full_name" khi dữ liệu chưa đúng. */
  updateProfile: (body: UpdateProfileRequest): Promise<StudentSettings> =>
    via("settings", () => mockApi.updateProfile(body), () => request("/students/me/profile", { ...json(body), method: "PATCH" })),
  /** Lỗi 400 code "wrong_password" khi mật khẩu hiện tại không đúng. */
  changePassword: (body: ChangePasswordRequest): Promise<ChangePasswordResponse> =>
    via("settings", () => mockApi.changePassword(body), () => request("/auth/change-password", json(body))),
  /** Các thao tác dữ liệu (feature flag dataActions). */
  withdrawConsent: (): Promise<StudentSettings> =>
    via("settings", () => mockApi.withdrawConsent(), () => request("/students/me/consent/withdraw", { method: "POST" })),
  /** download_url là đường dẫn tuyệt đối tới file JSON (tải bằng cùng phiên đăng nhập); null ở chế độ mock. */
  requestDataExport: (): Promise<{ download_url: string | null }> =>
    via("settings", () => mockApi.requestDataExport(), async () => {
      const res = await request<{ download_url: string | null }>("/students/me/data-export", { method: "POST" })
      return { download_url: res.download_url && res.download_url.startsWith("/") ? `${API_BASE_URL}${res.download_url}` : res.download_url }
    }),
  /** File JSON toàn bộ dữ liệu của SV (tải qua cùng phiên / header demo); null ở chế độ mock. */
  downloadDataExport: (): Promise<Blob | null> =>
    via("settings", async () => null, async () => (await send("/students/me/data-export/download")).blob()),
  deleteAllData: (): Promise<void> =>
    via("settings", () => mockApi.deleteAllData(), () => request("/students/me/data", { method: "DELETE" })),

  // ---- Cố vấn (backend chỉ trả SV được phân công: 403 "forbidden"; nội dung chưa chia sẻ: 403 "not_shared") ----
  getAdvisorOverview: (): Promise<AdvisorOverview> =>
    via("advisor", () => mockApi.getAdvisorOverview(), () => request("/advisor/overview")),
  listAssignedStudents: (): Promise<AssignedStudent[]> =>
    via("advisor", () => mockApi.listAssignedStudents(), () => request("/advisor/students")),
  getAdvisorStudent: (id: string): Promise<AdvisorStudentDetail> =>
    via("advisor", () => mockApi.getAdvisorStudent(id), () => request(advisorStudentPath(id))),
  /** Dòng mở rộng ở danh sách SV phụ trách. */
  getAdvisorStudentProgress: (id: string): Promise<AdvisorStudentProgress> =>
    via("advisor", () => mockApi.getAdvisorStudentProgress(id), () => request(`${advisorStudentPath(id)}/progress`)),
  /** Báo cáo đầy đủ của buổi SV đã chia sẻ; SV thấy "Cố vấn đã xem". */
  getAdvisorInterviewReport: (studentId: string, sessionId: string): Promise<AdvisorInterviewReport> =>
    via(
      "advisor",
      () => mockApi.getAdvisorInterviewReport(studentId, sessionId),
      () => request(`${advisorStudentPath(studentId)}/interviews/${encodeURIComponent(sessionId)}`),
    ),
  /** Viết / sửa nhận xét (mỗi cố vấn một nhận xét cho mỗi buổi). Điểm AI giữ nguyên. */
  reviewInterview: (studentId: string, sessionId: string, body: ReviewInterviewRequest): Promise<AdvisorReviewInfo> =>
    via(
      "advisor",
      () => mockApi.reviewInterview(studentId, sessionId, body),
      () =>
        request(`${advisorStudentPath(studentId)}/interviews/${encodeURIComponent(sessionId)}/review`, {
          ...json(body),
          method: "PUT",
        }),
    ),
  /** Văn bản của phiên bản CV SV đã chia sẻ. */
  getAdvisorCvText: (studentId: string, cvId: string): Promise<string> =>
    via(
      "advisor",
      () => mockApi.getAdvisorCvText(studentId, cvId),
      async () => (await request<{ text: string }>(`${advisorStudentPath(studentId)}/cvs/${encodeURIComponent(cvId)}/text`)).text,
    ),
  /** File phiên bản CV SV đã chia sẻ; null ở chế độ mock. */
  getAdvisorCvFile: (studentId: string, cvId: string): Promise<Blob | null> =>
    via(
      "advisor",
      async () => null,
      async () => (await send(`${advisorStudentPath(studentId)}/cvs/${encodeURIComponent(cvId)}/file`)).blob(),
    ),
  createAdvisorNote: (studentId: string, body: AdvisorNoteRequest): Promise<AdvisorNote> =>
    via(
      "advisor",
      () => mockApi.createAdvisorNote(studentId, body),
      () => request(`${advisorStudentPath(studentId)}/notes`, json(body)),
    ),
  updateAdvisorNote: (studentId: string, noteId: string, body: AdvisorNoteUpdate): Promise<AdvisorNote> =>
    via(
      "advisor",
      () => mockApi.updateAdvisorNote(studentId, noteId, body),
      () =>
        request(`${advisorStudentPath(studentId)}/notes/${encodeURIComponent(noteId)}`, { ...json(body), method: "PATCH" }),
    ),
  deleteAdvisorNote: (studentId: string, noteId: string): Promise<void> =>
    via(
      "advisor",
      () => mockApi.deleteAdvisorNote(studentId, noteId),
      () => request(`${advisorStudentPath(studentId)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" }),
    ),
}
