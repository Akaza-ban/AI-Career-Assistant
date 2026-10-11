import Link from "next/link"
import { Fragment, type CSSProperties } from "react"
import {
  ArrowDown,
  Award,
  BriefcaseBusiness,
  FileText,
  MessagesSquare,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { IconTile, type TileTone } from "./landing-bits"
import styles from "./landing.module.css"

// Toạ độ theo khung tham chiếu 1440 × 620 (bản thiết kế), đổi ra % để co giãn theo khung hero (cao bằng một màn hình).
const W = 1440
const H = 620
type TileSpec = { icon: LucideIcon; x: number; y: number; size: number; tone: TileTone; rot: number; delay: number; float: number }
const TILES: TileSpec[] = [
  // trái: CV và phân tích
  { icon: FileText, x: 96, y: 120, size: 96, tone: "blue", rot: -8, delay: 0.3, float: 6.5 },
  { icon: Target, x: 300, y: 96, size: 64, tone: "violet", rot: 8, delay: 0.45, float: 5.5 },
  { icon: ScanSearch, x: 48, y: 330, size: 72, tone: "white", rot: 6, delay: 0.6, float: 7 },
  { icon: PenLine, x: 270, y: 290, size: 84, tone: "peach", rot: -6, delay: 0.75, float: 6 },
  { icon: Sparkles, x: 176, y: 480, size: 48, tone: "pink", rot: 10, delay: 0.9, float: 5 },
  // phải: phỏng vấn và tiến bộ
  { icon: MessagesSquare, x: 1140, y: 108, size: 96, tone: "pink", rot: 7, delay: 0.35, float: 6.5 },
  { icon: ShieldCheck, x: 1316, y: 96, size: 60, tone: "blue", rot: -8, delay: 0.5, float: 5.5 },
  { icon: Timer, x: 1068, y: 320, size: 68, tone: "white", rot: -6, delay: 0.65, float: 7 },
  { icon: TrendingUp, x: 1250, y: 290, size: 88, tone: "violet", rot: 6, delay: 0.8, float: 6 },
  { icon: BriefcaseBusiness, x: 1130, y: 480, size: 56, tone: "peach", rot: -10, delay: 0.95, float: 5 },
  { icon: Award, x: 1330, y: 470, size: 46, tone: "white", rot: 8, delay: 1.05, float: 5.5 },
]
const DOTS = [
  { x: 360, y: 230, size: 14, color: "#9F86FF", delay: 1 },
  { x: 24, y: 250, size: 10, color: "#FFB59E", delay: 1.05 },
  { x: 370, y: 470, size: 9, color: "#9ED4FF", delay: 1.1 },
  { x: 1060, y: 230, size: 12, color: "#FF9FCB", delay: 1 },
  { x: 1390, y: 240, size: 14, color: "#9ED4FF", delay: 1.1 },
  { x: 1250, y: 520, size: 9, color: "#B8A4FF", delay: 1.15 },
]
const BLOBS = [
  { x: 10, y: 70, size: 360, color: "rgb(158 212 255 / 0.45)", delay: 0.1 },
  { x: 200, y: 330, size: 260, color: "rgb(184 164 255 / 0.32)", delay: 0.25 },
  { x: 1050, y: 60, size: 320, color: "rgb(255 159 203 / 0.32)", delay: 0.15 },
  { x: 1180, y: 330, size: 280, color: "rgb(255 181 158 / 0.3)", delay: 0.3 },
]
// Điện thoại: một hàng ô phía trên tiêu đề.
const MOBILE_TILES: TileSpec[] = [
  { icon: FileText, x: 2, y: 40, size: 64, tone: "blue", rot: -8, delay: 0.3, float: 6 },
  { icon: Target, x: 25, y: 8, size: 46, tone: "violet", rot: 8, delay: 0.45, float: 5.5 },
  { icon: PenLine, x: 40, y: 70, size: 56, tone: "peach", rot: -6, delay: 0.6, float: 6.5 },
  { icon: MessagesSquare, x: 60, y: 16, size: 64, tone: "pink", rot: 7, delay: 0.75, float: 6 },
  { icon: TrendingUp, x: 80, y: 74, size: 52, tone: "white", rot: -6, delay: 0.9, float: 5.5 },
]

const pct = (x: number) => `${(x / W) * 100}%`
const pctY = (y: number) => `${(y / H) * 100}%`
const delayStyle = (delay: number, extra?: CSSProperties) => ({ "--delay": `${delay}s`, ...extra }) as CSSProperties

function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(" ")
  return words.map((w, i) => (
    <Fragment key={i}>
      <span className={styles.word} style={{ "--i": start + i } as CSSProperties}>
        {w}
      </span>
      {i < words.length - 1 && " "}
    </Fragment>
  ))
}

export function LandingHero() {
  return (
    <>
      {/* Hero cao vừa một màn hình (trừ thanh trên) để khung minh hoạ chỉ hiện khi cuộn xuống */}
      <section className="relative flex min-h-[calc(100svh-64px)] flex-col justify-center overflow-hidden py-8 md:min-h-[calc(100svh-72px)] lg:min-h-[max(620px,calc(100svh-72px))] lg:py-0">
        {/* Hai bên tiêu đề (desktop) */}
        <div className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1440px] lg:block" aria-hidden>
          {BLOBS.map((b, i) => (
            <span
              key={i}
              className={styles.blob}
              style={delayStyle(b.delay, { left: pct(b.x), top: pctY(b.y), width: b.size, height: b.size, background: `radial-gradient(circle at 35% 35%, ${b.color}, transparent 70%)` })}
            />
          ))}
          {TILES.map((t, i) => (
            <span key={i} className={styles.tile} style={delayStyle(t.delay, { left: pct(t.x), top: pctY(t.y), rotate: `${t.rot}deg`, "--float": `${t.float}s` } as CSSProperties)}>
              <IconTile icon={t.icon} size={t.size} tone={t.tone} />
            </span>
          ))}
          {DOTS.map((d, i) => (
            <span key={i} className={cn(styles.tile, "rounded-full")} style={delayStyle(d.delay, { left: pct(d.x), top: pctY(d.y), width: d.size, height: d.size, background: d.color })} />
          ))}
        </div>

        {/* Điện thoại và máy tính bảng */}
        <div className="pointer-events-none relative mx-auto h-[150px] w-full max-w-[420px] shrink-0 lg:hidden" aria-hidden>
          <span className={styles.blob} style={delayStyle(0.1, { left: "-15%", top: -10, width: 220, height: 220, background: "radial-gradient(circle at 35% 35%, rgb(158 212 255 / 0.5), transparent 70%)" })} />
          <span className={styles.blob} style={delayStyle(0.2, { left: "52%", top: 10, width: 200, height: 200, background: "radial-gradient(circle at 35% 35%, rgb(255 159 203 / 0.38), transparent 70%)" })} />
          {MOBILE_TILES.map((t, i) => (
            <span key={i} className={styles.tile} style={delayStyle(t.delay, { left: `${t.x}%`, top: t.y, rotate: `${t.rot}deg`, "--float": `${t.float}s` } as CSSProperties)}>
              <IconTile icon={t.icon} size={t.size} tone={t.tone} />
            </span>
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-[640px] px-4 text-center lg:-mt-4">
          <h1 className="font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.03em] text-ink sm:text-[54px] sm:leading-[60px] lg:text-[64px] lg:leading-[70px]">
            <Words text="CV đúng vị trí." />
            <br />
            <Words text="Phỏng vấn tự tin hơn." start={3} />
          </h1>
          <p className={cn(styles.fadeUp, "mx-auto mt-4 max-w-[520px] text-[17px] leading-[27px] text-ink-2 md:mt-6 md:text-[19px] md:leading-[30px]")} style={delayStyle(0.65)}>
            CareerX so CV với mô tả công việc, gợi ý sửa từng câu và cho bạn luyện phỏng vấn thử theo khung STAR. Miễn phí cho sinh viên.
          </p>
          <div className={cn(styles.fadeUp, "mt-7 grid justify-center gap-2.5 sm:flex md:mt-[34px] md:gap-3")} style={delayStyle(0.8)}>
            <Button variant="dark" size="brand" className="h-[50px] px-6 text-base" nativeButton={false} render={<Link href="/register" />}>
              Tạo tài khoản miễn phí
            </Button>
            <Button variant="soft" size="brand" className="h-[50px] px-6 text-base" nativeButton={false} render={<a href="#cach-dung" />}>
              Xem cách hoạt động
              <ArrowDown aria-hidden />
            </Button>
          </div>
        </div>
      </section>

    </>
  )
}
