"use client"

import Link from "next/link"
import { useId } from "react"

import { cn } from "@/lib/utils"

interface BrandMarkProps {
  className?: string
  /** Luôn vẽ bản nền tối (hình trắng, mặt trong suốt), dùng trên dải tối của landing. */
  onDark?: boolean
}

/**
 * Hình logo CareerV (public/brand/careerv/careerv-mark.svg): chữ C ôm khuôn mặt, đỉnh lõm thành chữ V, góc gấp vàng.
 * Màu theo token nên tự đổi theo chế độ: hình = --ink, mặt = --brand-face (trắng ở nền sáng, trong suốt ở nền tối).
 * Kích thước đặt qua className (chiều cao); tỉ lệ 120:92.
 */
export function BrandMark({ className, onDark = false }: BrandMarkProps) {
  const mask = useId()
  const fg = onDark ? "#ffffff" : "var(--ink)"
  const face = onDark ? "transparent" : "var(--brand-face)"
  const silhouette = "28,27 54,27 68.5,41.5 83,27 96,27 108,39 108,54 82,80 54,80 28,54"
  return (
    <svg viewBox="-6 -6 120 92" fill="none" aria-hidden className={cn("aspect-[120/92] h-7 w-auto shrink-0", className)}>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-10" y="-10" width="130" height="100">
          <polygon points={silhouette} fill="#fff" stroke="#fff" strokeWidth="3" />
        </mask>
      </defs>
      <polygon points="26,0 54,0 54,27 28,27 28,54 54,80 26,80 0,54 0,26" fill={fg} />
      <polygon points="52.5,25.5 84.5,25.5 68.5,41.5" fill={fg} />
      <polygon points={silhouette} fill={face} stroke={fg} strokeWidth="3" />
      <polygon points="96,27 96,39 108,39" fill="#e0b852" stroke="#e0b852" strokeWidth="3" mask={`url(#${mask})`} />
      <rect x="60.5" y="52.5" width="4" height="9" rx="2" fill={fg} />
      <rect x="72.5" y="52.5" width="4" height="9" rx="2" fill={fg} />
    </svg>
  )
}

/** Chữ "CareerV": "Career" theo màu chữ chính, riêng "V" màu vàng nối với góc gấp trên logo. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading text-xl leading-none font-bold tracking-[-0.02em] text-ink", className)}>
      Career<span className="text-brand-v">V</span>
    </span>
  )
}

interface LogoProps {
  href?: string
  className?: string
  /** Lớp thêm cho chữ "CareerV" (sidebar thu gọn ẩn chữ, chỉ còn hình logo). */
  textClassName?: string
}

export function Logo({ href = "/", className, textClassName }: LogoProps) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="CareerV, về trang chủ">
      <BrandMark className="h-[26px]" />
      <Wordmark className={textClassName} />
    </Link>
  )
}
