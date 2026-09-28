import { Lightbulb, ShieldCheck } from "lucide-react"

import { NoticeDismissButton } from "@/components/shell/notice-dismiss-button"
import type { Role } from "@/lib/types"

// Dải lưu ý ngay dưới topbar (Figma: "Lưu ý liêm chính" cho SV, "Bảo mật dữ liệu" cho cố vấn).
// Hiện mỗi lần mở web; bấm X thì ẩn đến hết phiên (xem lib/notice.ts và CSS [data-notice] trong globals.css).
const notices = {
  student: {
    icon: Lightbulb,
    label: "Lưu ý liêm chính:",
    text: "AI chỉ gợi ý cách trình bày dựa trên kinh nghiệm thật của bạn. Bạn chịu trách nhiệm nội dung cuối cùng. AI không đảm bảo trúng tuyển.",
  },
  advisor: {
    icon: ShieldCheck,
    label: "Bảo mật dữ liệu:",
    text: "Bạn chỉ xem được nội dung sinh viên đã bật chia sẻ. Không sao chép hoặc chia sẻ ra ngoài hệ thống.",
  },
} satisfies Record<Role, unknown>

export function NoticeBanner({ role }: { role: Role }) {
  const { icon: Icon, label, text } = notices[role]
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
