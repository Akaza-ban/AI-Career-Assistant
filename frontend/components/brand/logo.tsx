import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface LogoProps {
  href?: string
  className?: string
}

// Hình chữ X tách từ careerx-mark.png, màu đen trên nền trong suốt (DESIGN.md 5.1).
export function Logo({ href = "/", className }: LogoProps) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="CareerX, về trang chủ">
      <Image src="/brand/careerx-glyph.png" alt="" width={28} height={28} priority className="size-7 shrink-0" />
      <span className="font-heading text-xl leading-none font-bold tracking-[-0.02em] text-ink">CareerX</span>
    </Link>
  )
}
