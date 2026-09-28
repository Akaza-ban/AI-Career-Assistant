// Cấu hình đọc từ biến môi trường NEXT_PUBLIC_* (xem frontend/.env.example).

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// Mặc định dùng mock cho tới khi backend có endpoint thật. Đặt "false" để gọi API.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false"

// Kịch bản dữ liệu mock để xem các trạng thái rỗng: "default" | "new_student".
export const MOCK_SCENARIO = process.env.NEXT_PUBLIC_MOCK_SCENARIO ?? "default"
