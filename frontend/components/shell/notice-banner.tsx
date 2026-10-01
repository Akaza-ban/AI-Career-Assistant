import { ShieldCheck, type LucideIcon } from "lucide-react"

import { NoticeDismissButton } from "@/components/shell/notice-dismiss-button"
import type { Role } from "@/lib/types"

// Dải lưu ý ngay dưới topbar (Figma: "Bảo mật dữ liệu" cho cố vấn). SV không có dải này: câu "AI không đảm bảo
// trúng tuyển" (PRD mục 3, Minh bạch giới hạn) đã nằm ở trang Kết quả phân tích.
// Hiện mỗi lần mở web; bấm X thì ẩn đến hết phiên (xem lib/notice.ts và CSS [data-notice] trong globals.css).
const notices: Partial<Record<Role, { icon: LucideIcon; label: string; text: string }>> = {
  advisor: {
    icon: ShieldCheck,
    label: "Bảo mật dữ liệu:",
    text: "Bạn chỉ xem được nội dung sinh viên đã bật chia sẻ. Không sao chép hoặc chia sẻ ra ngoài hệ thống.",
  },
}

export function NoticeBanner({ role }: { role: Role }) {
  const notice = notices[role]
  if (!notice) return null
  const { icon: Icon, label, text } = notice
  return (
    <div data-notice={role} className="border-b border-line/60 bg-blue-soft/50 px-4 py-2.5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-2 text-xs leading-[18px] text-ink">
          <Icon className="mt-px size-4 shrink-0 text-blue" aria-hidden />
          <span>
            <strong className="font-semibold text-blue">{label}</strong> {text}
          </span>
        </p>
        <NoticeDismissButton role={role} />
      </div>
    </div>
  )
}
