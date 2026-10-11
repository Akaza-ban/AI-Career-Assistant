// Cấu hình đọc từ biến môi trường NEXT_PUBLIC_* (xem frontend/.env.example).

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

/**
 * Nhóm API trong lib/api.ts. Mỗi nhóm được chuyển từ mock sang backend thật độc lập,
 * để nối từng luồng một mà các trang còn lại vẫn chạy bằng mock.
 */
export type ApiGroup =
  | "me"
  | "notifications"
  | "overview"
  | "cv"
  | "gap"
  | "optimizer"
  | "interview"
  | "feedback"
  | "sharing"
  | "settings"
  | "advisor"
  | "messages"
  | "auth"

// NEXT_PUBLIC_LIVE_APIS: danh sách nhóm gọi backend thật, cách nhau bởi dấu phẩy (ví dụ "me,cv"),
// hoặc "all" cho tất cả. Để trống = toàn bộ dùng mock.
const LIVE_APIS = new Set(
  (process.env.NEXT_PUBLIC_LIVE_APIS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
)

export const ALL_LIVE = LIVE_APIS.has("all")

export function isLive(group: ApiGroup): boolean {
  return ALL_LIVE || LIVE_APIS.has(group)
}

/**
 * Trình tối ưu CV mở được: khi còn mock toàn bộ, hoặc khi nhóm "optimizer" đã nối backend.
 * Phân tích thật mà trình tối ưu còn mock thì mock không mở được lượt phân tích thật → tạm khoá ("Sắp có").
 */
export const OPTIMIZER_AVAILABLE = isLive("optimizer") || !isLive("gap")

// Kịch bản dữ liệu mock để xem các trạng thái rỗng: "default" | "new_student".
export const MOCK_SCENARIO = process.env.NEXT_PUBLIC_MOCK_SCENARIO ?? "default"
