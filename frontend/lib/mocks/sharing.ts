// Dữ liệu minh hoạ cho màn "Chia sẻ với Cố vấn" và "Cài đặt & Quyền riêng tư". Khớp dữ liệu demo ở backend (src/db/seed.py).

import type { AdvisorContact, StudentSettings } from "@/lib/types"

const now = new Date()
const at = (days: number, hour: number, minute = 0) => {
  const d = new Date(now.getTime() - days * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const mockAdvisorContact: AdvisorContact = {
  id: "cv-007",
  full_name: "ThS. Trần Hoàng Nam",
  title: "Cố vấn nghề nghiệp Khoa Hệ thống thông tin",
  email: "nam.th@university.edu.vn",
  office: "Phòng A2.305",
  office_hours: "Thứ 3 & Thứ 5 (14:00 – 16:30)",
  avatar_url: null,
}

/**
 * Tài liệu Minh Anh đang chia sẻ lúc đầu (không có trong danh sách = riêng tư) và lần cố vấn xem gần nhất.
 * CV chia sẻ theo mã CV (family_id): cố vấn xem bản mới nhất và các bản trước.
 */
export const mockInitialShared: Record<string, { viewed_at: string | null }> = {
  "cv-ba-v10": { viewed_at: at(0, 10, 15) },
  "iv-005": { viewed_at: at(1, 15, 30) },
  "iv-004": { viewed_at: at(2, 9, 0) },
}

/** Nhận xét của cố vấn cho báo cáo của Minh Anh lúc đầu, theo mã buổi phỏng vấn. */
export const mockInitialReviews: Record<string, { comment: string; days: number; seen: boolean }> = {
  "iv-005": {
    comment:
      "Thầy đánh giá cao cách em trả lời câu về xung đột yêu cầu. Hãy nhấn mạnh thêm kết quả đo được ở phần Kết quả nhé.",
    days: 1,
    seen: false,
  },
  "iv-004": {
    comment: "Cấu trúc STAR ở câu hỏi làm việc nhóm rất rõ ràng. Buổi sau hãy nói rõ phần việc của riêng em.",
    days: 2,
    seen: true,
  },
}

export const mockSettings: StudentSettings = {
  email: "minhanh.k21@student.university.edu.vn",
  student_code: "21125430",
  faculty: "Khoa Kinh doanh Quốc tế",
  password_updated_at: at(60, 20, 0),
  consent_accepted_at: at(21, 14, 20),
  storage: { used_bytes: 0, limit_bytes: 50 * 1024 * 1024, allocated_by: "Trung tâm Hướng nghiệp của trường" },
  privacy: { anonymous_contribution: false },
  notifications: { advisor_comment: true, report_ready: true, weekly_reminder: false, email: true },
}
