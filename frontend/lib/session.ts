// Trạng thái đăng nhập phía trình duyệt. Phiên thật nằm trong cookie HttpOnly do backend đặt (JS không đọc được),
// nên ở đây chỉ ghi vai trò của tài khoản đang đăng nhập để chặn trang và chuyển đúng khu vực.
// Tài khoản demo cũng đăng nhập / đăng xuất như tài khoản thường.

import type { Role } from "@/lib/types"

export interface AuthMode {
  role: Role
  /** Đăng nhập bằng mật khẩu tạm: chỉ vào được trang Đặt mật khẩu mới cho tới khi đổi xong. */
  mustChangePassword?: boolean
}

const ROLES: readonly Role[] = ["student", "advisor", "admin"]

const KEY = "careerx.auth"

export function getAuthMode(): AuthMode | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { role?: unknown; mustChangePassword?: unknown }
    const role = ROLES.find((r) => r === parsed.role)
    if (!role) return null
    return parsed.mustChangePassword === true ? { role, mustChangePassword: true } : { role }
  } catch {
    return null
  }
}

export function setAuthMode(mode: AuthMode): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mode))
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn dùng được trong phiên này
  }
}

export function clearAuthMode(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // bỏ qua
  }
}

export const homeOf = (role: Role) => `/${role}`

/** Trang đích sau khi đăng nhập: mật khẩu tạm thì phải đặt mật khẩu mới trước. */
export const landingOf = (mode: AuthMode) => (mode.mustChangePassword ? "/change-password" : homeOf(mode.role))

/** Các tài khoản demo có sẵn (dữ liệu mẫu ở backend: src/db/seed.py; ở mock: lib/mocks/handlers.ts). */
export const DEMO_ACCOUNTS: { role: Role; title: string; text: string; email: string }[] = [
  { role: "student", title: "Sinh viên", text: "Tài khoản mới, chưa có CV hay buổi phỏng vấn nào", email: "minhanh.nguyen@gmail.com" },
  { role: "advisor", title: "Cố vấn", text: "Phụ trách sẵn một nhóm sinh viên mẫu", email: "nam.tran@careerx.vn" },
  { role: "admin", title: "Quản trị viên", text: "Thống kê hệ thống, tài khoản cố vấn, phân công", email: "admin@careerx.vn" },
]
export const DEMO_PASSWORD = "careerx123"
