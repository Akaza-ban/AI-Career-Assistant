import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface LogoProps {
  href?: string
  /** Ẩn dòng phụ "CV Coach & Mock Interview" (ví dụ ở header phòng phỏng vấn). */
  compact?: boolean
  className?: string
}

// Biểu tượng lấy từ Figma (frame "Logo 2"); chữ dựng bằng text theo wordmark của landing page.
export function Logo({ href = "/", compact = false, className }: LogoProps) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-3", className)} aria-label="CareerX, về trang chủ">
      <Image
        src="/brand/careerx-mark.png"
        alt=""
        width={40}
        height={40}
        priority
        className="size-10 shrink-0 rounded-[24%] shadow-[0_4px_12px_-4px_rgb(37_99_235/0.6)]"
      />
      <span className="grid leading-none">
        <span className="font-heading text-[22px] font-extrabold tracking-[-0.04em] text-ink">
          Career<span className="text-gold">X</span>
        </span>
        {!compact && (
          <span className="mt-1 text-[10px] font-medium tracking-[0.02em] text-ink-3">CV Coach & Mock Interview</span>
        )}
      </span>
    </Link>
  )
}
