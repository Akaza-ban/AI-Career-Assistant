import {
  FileText,
  LayoutGrid,
  MessagesSquare,
  ScanText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { Role } from "@/lib/types"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Tiền tố URL để đánh dấu mục đang chọn; mặc định = href (khớp chính xác). */
  match?: string
}

export interface Crumb {
  label: string
  /** null cho trang hiện tại. */
  href: string | null
}

/** Trang không nằm trong menu (trang chi tiết, bước con trong một luồng...). */
interface ExtraPage {
  pattern: RegExp
  title: string
  /** Các bước cha trong breadcrumb, dựng từ kết quả khớp của pattern. */
  parents?: (match: RegExpMatchArray) => Crumb[]
}

export interface ShellConfig {
  role: Role
  nav: NavItem[]
  settingsHref: string | null
  extraPages: ExtraPage[]
}

const analysisRoot: Crumb = { label: "Phân tích CV & JD", href: "/student/analysis/new" }
const analysisResult = (id: string): Crumb => ({ label: "Kết quả phân tích", href: `/student/analysis/${id}` })

// Menu sinh viên 6 mục. "Trình tối ưu CV" và "Xuất CV" không có tab riêng mà đi theo luồng
// Phân tích CV & JD → Trình tối ưu CV → Xuất CV (/student/analysis/[id]/optimize, /export).
export const studentShell: ShellConfig = {
  role: "student",
  nav: [
    { href: "/student", label: "Tổng quan", icon: LayoutGrid },
    { href: "/student/cv", label: "CV của tôi", icon: FileText },
    { href: "/student/analysis/new", label: "Phân tích CV & JD", icon: ScanText, match: "/student/analysis" },
    { href: "/student/interview/new", label: "Luyện phỏng vấn", icon: MessagesSquare, match: "/student/interview" },
    { href: "/student/history", label: "Lịch sử & Tiến bộ", icon: TrendingUp },
    { href: "/student/share", label: "Chia sẻ với Cố vấn", icon: Users },
  ],
  settingsHref: "/student/settings",
  extraPages: [
    {
      pattern: /^\/student\/analysis\/([^/]+)\/optimize$/,
      title: "Trình tối ưu CV",
      parents: (m) => [analysisRoot, analysisResult(m[1])],
    },
    {
      pattern: /^\/student\/analysis\/([^/]+)\/export$/,
      title: "Xuất CV",
      parents: (m) => [
        analysisRoot,
        analysisResult(m[1]),
        { label: "Trình tối ưu CV", href: `/student/analysis/${m[1]}/optimize` },
      ],
    },
    {
      pattern: /^\/student\/analysis\/(?!new$)[^/]+$/,
      title: "Kết quả phân tích",
      parents: () => [analysisRoot],
    },
    {
      pattern: /^\/student\/interview\/[^/]+\/report$/,
      title: "Báo cáo phỏng vấn",
      parents: () => [{ label: "Luyện phỏng vấn", href: "/student/interview/new" }],
    },
    { pattern: /^\/student\/settings$/, title: "Cài đặt & Quyền riêng tư" },
  ],
}

export const advisorShell: ShellConfig = {
  role: "advisor",
  nav: [
    { href: "/advisor", label: "Tổng quan", icon: LayoutGrid },
    { href: "/advisor/students", label: "Sinh viên phụ trách", icon: Users, match: "/advisor/students" },
  ],
  settingsHref: null,
  extraPages: [
    {
      pattern: /^\/advisor\/students\/[^/]+$/,
      title: "Hồ sơ sinh viên",
      parents: () => [{ label: "Sinh viên phụ trách", href: "/advisor/students" }],
    },
  ],
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  const prefix = item.match ?? item.href
  return item.match ? pathname === prefix || pathname.startsWith(`${prefix}/`) : pathname === item.href
}

/** Breadcrumb trên topbar: các bước cha (có link) và trang hiện tại (href null). */
export function getBreadcrumb(config: ShellConfig, pathname: string): Crumb[] {
  for (const page of config.extraPages) {
    const match = pathname.match(page.pattern)
    if (match) return [...(page.parents?.(match) ?? []), { label: page.title, href: null }]
  }
  const item = config.nav.find((nav) => isNavActive(nav, pathname)) ?? config.nav[0]
  return [{ label: item.label, href: null }]
}
