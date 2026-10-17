import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/format"
import type { AdminComment, AdminPeriod, AdvisorAccountStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

export const PERIODS: { value: `${AdminPeriod}`; label: string }[] = [
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "90", label: "90 ngày qua" },
]

/** Loại hoạt động được đánh giá CSAT (Feedback.activity ở backend). */
export const ACTIVITY_LABEL: Record<string, string> = {
  gap_analysis: "Phân tích CV",
  optimizer: "Trình tối ưu CV",
  interview: "Phỏng vấn thử",
}

const number = (n: number, digits = 0) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits })

/** 18 → "+18%", -7.8 → "−7,8%". */
export const formatChange = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${number(Math.abs(n), 1)}%`

export const formatCount = (n: number) => number(n)

/** "56%" (làm tròn), 0 khi tổng = 0. */
export const percentOf = (part: number, total: number) => (total > 0 ? `${number((part / total) * 100)}%` : "0%")

const STATUS: Record<AdvisorAccountStatus, { label: string; variant: "good" | "warn" | "neutral" }> = {
  active: { label: "Đang hoạt động", variant: "good" },
  password_pending: { label: "Chưa đổi mật khẩu tạm", variant: "warn" },
  disabled: { label: "Tạm khoá", variant: "neutral" },
}

export function AdvisorStatusBadge({ status }: { status: AdvisorAccountStatus }) {
  return (
    <Badge variant={STATUS[status].variant}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS[status].label}
    </Badge>
  )
}

// Không có 0/O, 1/I/l để đọc qua điện thoại không nhầm
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Mật khẩu tạm dạng "Careerv-7Q4M2": đủ quy tắc mật khẩu (≥ 8 ký tự, có chữ và số, không khoảng trắng). */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length])
  if (!chars.some((c) => /\d/.test(c))) chars[1] = String(2 + (bytes[1] % 8))
  return `Careerv-${chars.join("")}`
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} / 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= value ? "fill-gold text-gold" : "text-line-strong")} aria-hidden />
      ))}
    </span>
  )
}

/** Một nhận xét: số sao, tính năng, thời gian và nội dung (không kèm tên sinh viên). */
export function CommentItem({ comment: c }: { comment: AdminComment }) {
  return (
    <li className="border-b border-line py-4">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
        <Stars value={c.value} />
        <span>
          {(c.activity && ACTIVITY_LABEL[c.activity]) ?? "Đánh giá"} · {formatRelativeTime(c.created_at).toLowerCase()}
        </span>
      </div>
      {c.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <span key={t.reason} className="inline-flex h-6 items-center rounded-full bg-warn-soft px-2.5 text-xs font-medium text-warn">
              {t.label}
            </span>
          ))}
        </div>
      )}
      {c.comment && <p className="mt-2 text-[15px] leading-6 text-ink">“{c.comment}”</p>}
    </li>
  )
}
