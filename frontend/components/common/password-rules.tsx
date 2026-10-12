import { Check } from "lucide-react"

import { PASSWORD_RULES } from "@/lib/password"
import { cn } from "@/lib/utils"

/**
 * Danh sách điều kiện mật khẩu, mỗi dòng tick xanh khi đạt (dùng ở Đăng ký, Đặt mật khẩu mới, Đổi mật khẩu).
 * `showErrors`: sau khi bấm gửi, điều kiện chưa đạt chuyển màu đỏ.
 */
export function PasswordRuleList({
  password,
  id,
  showErrors = false,
  className,
}: {
  password: string
  id?: string
  showErrors?: boolean
  className?: string
}) {
  return (
    <ul id={id} className={cn("grid gap-1.5 text-sm", className)} aria-label="Mật khẩu cần có">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password)
        return (
          <li
            key={rule.label}
            className={cn("flex items-center gap-2", ok ? "text-good" : showErrors ? "text-bad" : "text-ink-3")}
          >
            <Check className={cn("size-3.5 shrink-0", !ok && "opacity-40")} strokeWidth={2.25} aria-hidden />
            {rule.label}
            <span className="sr-only">{ok ? "(đã đạt)" : "(chưa đạt)"}</span>
          </li>
        )
      })}
    </ul>
  )
}
