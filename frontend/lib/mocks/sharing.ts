// Dữ liệu minh hoạ cho màn "Chia sẻ với Cố vấn" và "Cài đặt & Quyền riêng tư".

import type { AccessLogEntry, AdvisorContact, AdvisorFeedback, DataViewer, StudentSettings } from "@/lib/types"

const now = new Date()
const at = (days: number, hour: number, minute = 0) => {
  const d = new Date(now.getTime() - days * 86_400_000)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const mockAdvisorContact: AdvisorContact = {
  id: "cv-007",
  full_name: "ThS. Trần Hoàng Nam",
  title: "Cố vấn nghề nghiệp Khoa Hệ thống Thông tin",
  email: "nam.th@university.edu.vn",
  office: "P.402 Nhà A",
  office_hours: "Thứ 3 & Thứ 5 (14:00 – 16:30)",
  avatar_url: null,
}

/** Trạng thái chia sẻ ban đầu. Tài liệu không có trong danh sách là riêng tư. */
export const mockInitialShared: Record<string, { viewed_at: string | null; comment: boolean }> = {
  "cv-v3": { viewed_at: at(0, 10, 15), comment: false },
  "cv-v2": { viewed_at: null, comment: true },
  "iv-005": { viewed_at: at(1, 15, 30), comment: true },
  "iv-004": { viewed_at: at(2, 9, 0), comment: false },
}

export const mockViewers: DataViewer[] = [
  {
    id: "cv-007",
    kind: "advisor",
    name: "ThS. Trần Hoàng Nam",
    description: "Cố vấn được phân công",
    permission: "Xem & nhận xét các tài liệu đang chia sẻ",
    last_viewed_at: at(0, 10, 15),
  },
  {
    id: "dept-httt",
    kind: "department",
    name: "Văn phòng Hướng nghiệp",
    description: "Khoa Hệ thống Thông tin",
    permission: "Chỉ số liệu tổng hợp, không kèm tên",
    last_viewed_at: at(2, 8, 30),
  },
]

export const mockAccessLog: AccessLogEntry[] = [
  { id: "log-1", actor: "ThS. Trần Hoàng Nam", action: "downloaded", target: "Business_Analyst_MinhAnh_v2.pdf", occurred_at: at(0, 10, 15) },
  { id: "log-2", actor: "ThS. Trần Hoàng Nam", action: "commented", target: "Báo cáo Vòng 1 & 2 (HR & Chuyên môn)", occurred_at: at(1, 15, 40) },
  { id: "log-3", actor: "ThS. Trần Hoàng Nam", action: "viewed", target: "Báo cáo Vòng 1 (HR & Động lực)", occurred_at: at(2, 9, 0) },
  { id: "log-4", actor: "ThS. Trần Hoàng Nam", action: "commented", target: "CV_NguyenMinhAnh_BA.pdf", occurred_at: at(6, 16, 20) },
]

export const mockAdvisorFeedback: AdvisorFeedback[] = [
  {
    id: "fb-1",
    advisor_name: "ThS. Trần Hoàng Nam",
    comment:
      "Thầy đánh giá cao cách em trả lời câu 4 về xung đột yêu cầu. Hãy nhấn mạnh thêm bài học rút ra ở phần Kết quả nhé.",
    created_at: at(1, 15, 40),
    read: false,
    target: { kind: "interview_report", id: "iv-005", label: "Mở báo cáo liên quan" },
  },
  {
    id: "fb-2",
    advisor_name: "ThS. Trần Hoàng Nam",
    comment: "CV v2 đã có số liệu định lượng rất thuyết phục ở dự án Cổng thông tin sinh viên.",
    created_at: at(6, 16, 20),
    read: true,
    target: { kind: "cv", id: "cv-v2", label: "Mở CV liên quan" },
  },
]

export const mockSettings: StudentSettings = {
  email: "minhanh.k21@student.university.edu.vn",
  student_code: "K214110142",
  faculty: "Khoa Kinh doanh Quốc tế",
  password_updated_at: at(60, 20, 0),
  consent_accepted_at: at(21, 14, 20),
  storage: { used_bytes: 0, limit_bytes: 50 * 1024 * 1024, allocated_by: "Trung tâm Hướng nghiệp của trường" },
  privacy: { advisor_access: true, anonymous_contribution: false },
  notifications: { advisor_comment: true, report_ready: true, weekly_reminder: false, email: true },
}
