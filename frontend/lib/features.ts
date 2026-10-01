// Feature flag cho các chức năng ngoài phạm vi Gate 1.
// Mặc định tắt; bật bằng biến môi trường NEXT_PUBLIC_FEATURE_<TÊN>=true khi cần.

function flag(value: string | undefined): boolean {
  return value === "true"
}

export const features = {
  /** Chọn nhiều JD trong một lượt phân tích (PRD Gate 1 chỉ cho 1 vị trí). */
  multiJd: flag(process.env.NEXT_PUBLIC_FEATURE_MULTI_JD),
  /** Phỏng vấn bằng giọng nói: mic, sóng âm, giọng đọc AI. */
  voiceInterview: flag(process.env.NEXT_PUBLIC_FEATURE_VOICE_INTERVIEW),
  /** Tab "Dán link tin tuyển dụng" khi chọn JD. */
  jobUrlImport: flag(process.env.NEXT_PUBLIC_FEATURE_JOB_URL_IMPORT),
  /** Nút "Nhập từ Google Drive" khi tải CV. */
  driveImport: flag(process.env.NEXT_PUBLIC_FEATURE_DRIVE_IMPORT),
  /** Rút lại đồng ý, xoá hoặc tải xuống toàn bộ dữ liệu cá nhân (gọi API thật). */
  dataActions: flag(process.env.NEXT_PUBLIC_FEATURE_DATA_ACTIONS),
  /** Nhắn tin trực tiếp với cố vấn ("Trao đổi nhanh"). */
  advisorChat: flag(process.env.NEXT_PUBLIC_FEATURE_ADVISOR_CHAT),
  /** Nút "Xuất báo cáo (PDF)" ở màn Lịch sử & Tiến bộ. */
  progressPdf: flag(process.env.NEXT_PUBLIC_FEATURE_PROGRESS_PDF),
} as const

export type FeatureName = keyof typeof features
