// Quy tắc mật khẩu dùng chung cho form đổi mật khẩu (và đăng ký sau này).
// Backend cần kiểm tra lại cùng các quy tắc này.

export const PASSWORD_MIN_LENGTH = 8

export interface PasswordRule {
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { label: "Có cả chữ và số", test: (p) => /\p{L}/u.test(p) && /\d/.test(p) },
  { label: "Không chứa khoảng trắng", test: (p) => p.length > 0 && !/\s/.test(p) },
]

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
