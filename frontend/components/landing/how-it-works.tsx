import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { LandingBadge, SectionHeading } from "./landing-bits"
import { Reveal } from "./reveal"
import styles from "./landing.module.css"

// ---------- Minh hoạ trong từng bước (dữ liệu mẫu, đúng quy tắc điểm số DESIGN.md 8.1) ----------

function PaneLibrary() {
  return (
    <>
      <div className="flex items-center gap-3 rounded-[14px] bg-panel px-3.5 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-card">
          <FileText className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">CV_cua_ban.pdf</p>
          <p className="text-[13px] text-ink-3">Phiên bản v2.1 · Đang dùng</p>
        </div>
        <LandingBadge tone="good">Đã đọc</LandingBadge>
      </div>
      <div className="mt-[22px] mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-semibold">Phù hợp nhất với CV của bạn</p>
        <p className="text-[13px] text-ink-3">Ước tính nhanh theo kỹ năng</p>
      </div>
      {[
        ["Data Analyst Intern", "Công ty Thương mại điện tử B · Thực tập", "good", "Cao"],
        ["Business Analyst Intern", "Công ty Công nghệ A · Thực tập", "mid", "Khá"],
        ["Marketing Analyst", "Công ty Truyền thông D · Fresher", "mid", "Khá"],
      ].map(([title, meta, tone, label], i) => (
        <div key={title} className="flex items-center gap-3 border-b border-line py-3.5 text-sm last:border-b-0">
          <span className="w-5 font-semibold text-ink-3 tabular-nums">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{title}</p>
            <p className="truncate text-[13px] text-ink-3">{meta}</p>
          </div>
          <LandingBadge tone={tone as "good" | "mid"}>{label}</LandingBadge>
        </div>
      ))}
    </>
  )
}

const MET = 2
const PARTIAL = 1
function SkillDot({ v }: { v: number }) {
  return (
    <span
      className={cn(
        "inline-block size-3 rounded-full",
        v === MET ? "bg-good" : v === PARTIAL ? "bg-[linear-gradient(90deg,var(--accent)_50%,var(--line-strong)_50%)]" : "shadow-[inset_0_0_0_2px_var(--line-strong)]",
      )}
      title={v === MET ? "Đã đáp ứng" : v === PARTIAL ? "Chỉ liệt kê" : "Còn thiếu"}
    />
  )
}
function PaneCompare() {
  const cols = [
    ["Data Analyst", "82%", "good", "Cao"],
    ["BI Developer", "74%", "mid", "Khá"],
    ["Product Analyst", "61%", "mid", "Khá"],
  ] as const
  const rows: [string, number[]][] = [
    ["SQL", [2, 2, 2]],
    ["Python", [2, 1, 2]],
    ["Tableau", [1, 2, 0]],
    ["Power BI", [0, 2, 0]],
    ["Thống kê", [0, 0, 0]],
  ]
  return (
    <>
      <div className="grid grid-cols-[1.2fr_repeat(3,1fr)] items-end gap-2.5 border-b border-line pb-3.5">
        <span className="text-[13px] text-ink-3">So 3 vị trí</span>
        {cols.map(([t, s, tone, l]) => (
          <div key={t} className="grid justify-items-center text-center">
            <span className="text-xs font-semibold sm:text-[13px]">{t}</span>
            <span className="text-[22px] leading-[30px] font-semibold tabular-nums">{s}</span>
            <LandingBadge tone={tone}>{l}</LandingBadge>
          </div>
        ))}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[1.2fr_repeat(3,1fr)] items-center gap-2.5 border-b border-line py-[11px] text-sm">
          <span className="font-medium">{k}</span>
          {v.map((x, i) => (
            <span key={i} className="text-center">
              <SkillDot v={x} />
            </span>
          ))}
        </div>
      ))}
      <p className="mt-3.5 text-[13px] text-ink-2">
        <b className="font-semibold text-ink">Nên ưu tiên học trước:</b> Thống kê
      </p>
    </>
  )
}

function PaneOptimize() {
  return (
    <>
      <div className="flex items-center justify-between text-[13px]">
        <b className="text-[15px] font-semibold">Trình tối ưu CV</b>
        <span className="text-ink-3 tabular-nums">Đã xử lý 4 / 7</span>
      </div>
      <div className="mt-2.5 mb-[18px] h-1.5 overflow-hidden rounded-full bg-surface">
        <i className={cn(styles.grow, "block h-full w-[57%] rounded-full bg-blue")} />
      </div>
      <div className="rounded-[14px] bg-panel px-4 py-[18px] text-sm leading-[22px] sm:px-5">
        <p className="text-xs font-semibold tracking-[0.04em] text-ink-3">KINH NGHIỆM</p>
        <p className="mt-2 rounded-lg px-2.5 py-1.5">Xây dashboard doanh thu bằng SQL cho phòng kinh doanh.</p>
        <p className={cn(styles.applyLine, "mt-1 rounded-lg px-2.5 py-1.5")}>
          Phân tích dữ liệu bán hàng hằng tuần cho 3 chi nhánh, rút ngắn báo cáo 2 giờ.{" "}
          <span className={cn(styles.appliedTag, "text-xs font-semibold whitespace-nowrap text-good")}>Đã áp dụng</span>
        </p>
        <p className="mt-1 rounded-lg bg-gold-soft px-2.5 py-1.5 shadow-[inset_3px_0_0_var(--gold)]">Làm việc nhóm theo sprint 2 tuần.</p>
        <p className="mt-3 text-xs font-semibold tracking-[0.04em] text-ink-3">KỸ NĂNG ĐANG PHÁT TRIỂN</p>
        <p className="mt-2 px-2.5">Power BI (đang học)</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="min-w-0 flex-1 text-[13px] text-ink-3">AI không tự đặt số liệu. Bạn duyệt từng câu.</span>
        <span className="inline-flex h-8 items-center rounded-full bg-ink px-3 text-[13px] font-semibold text-white">Hoàn tất &amp; tạo v2.2</span>
      </div>
    </>
  )
}

function PaneInterview() {
  const star: [string, string, number][] = [
    ["Bối cảnh", "S", 4.2],
    ["Nhiệm vụ", "T", 4.0],
    ["Hành động", "A", 3.8],
    ["Kết quả", "R", 3.1],
  ]
  const points = [
    [6, 58],
    [52, 50],
    [98, 32],
    [144, 16],
  ]
  return (
    <>
      <div className="flex items-center justify-between text-[13px] text-ink-3">
        <span>Business Analyst Intern · Câu 3 / 5</span>
        <span className="font-semibold text-ink tabular-nums">02:41</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {[1, 1, 1, 0, 0].map((d, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", d ? "bg-ink" : "bg-line")} />
        ))}
      </div>
      <p className="mt-[18px] text-[17px] leading-[26px] font-semibold sm:text-lg sm:leading-[27px]">Kể về một lần bạn dùng dữ liệu để thuyết phục người khác thay đổi quyết định.</p>
      <div className="mt-3.5 min-h-11 overflow-hidden rounded-xl px-3.5 py-3 text-sm text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">
        <span className={styles.typing}>Trong đồ án, nhóm mình định giảm giá cả 5 nhóm hàng…</span>
      </div>
      <div className="mt-[18px] grid items-end gap-[18px] sm:grid-cols-[minmax(0,1fr)_150px]">
        <div>
          {star.map(([n, k, v]) => (
            <div key={k} className="grid grid-cols-[92px_1fr_28px] items-center gap-2.5 py-1 text-[13px]">
              <span>
                {n} <span className="text-ink-3">{k}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface">
                <i className={cn(styles.grow, "block h-full rounded-full", k === "R" ? "bg-[#D29A2E]" : "bg-blue")} style={{ width: `${(v / 5) * 100}%` }} />
              </span>
              <b className={cn("text-right font-semibold tabular-nums", k === "R" && "text-warn")}>{String(v).replace(".", ",")}</b>
            </div>
          ))}
        </div>
        <div className="max-sm:hidden">
          <svg viewBox="0 0 150 70" width="150" height="70" aria-hidden>
            <path className={styles.draw} d="M6 58 L52 50 L98 32 L144 16" fill="none" stroke="var(--accent)" strokeWidth="2" />
            {points.map(([x, y]) => (
              <circle key={x} cx={x} cy={y} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" />
            ))}
          </svg>
          <p className="text-[13px] text-ink-3 tabular-nums">
            Buổi 4: <b className="font-semibold text-ink">3,8 / 5</b>
          </p>
        </div>
      </div>
    </>
  )
}

const STEPS: { label: string; text: string; pane: ReactNode; alt: string }[] = [
  {
    label: "Bước 1 · Tải CV, xem vị trí hợp với bạn",
    text: "Tải CV lên và xem ngay những vị trí hợp với kỹ năng của bạn trong Thư viện JD. Gặp JD ở nơi khác thì dán vào để phân tích.",
    pane: <PaneLibrary />,
    alt: "Minh hoạ: danh sách vị trí phù hợp nhất với CV, gắn nhãn Cao hoặc Khá.",
  },
  {
    label: "Bước 2 · So CV với một hoặc nhiều vị trí",
    text: "Mỗi yêu cầu trong JD được đặt cạnh câu trích từ CV: đã đáp ứng, chỉ liệt kê hay còn thiếu. So 2–3 vị trí cùng lúc để chọn hướng đi.",
    pane: <PaneCompare />,
    alt: "Minh hoạ: bảng so sánh kỹ năng của CV với 3 vị trí.",
  },
  {
    label: "Bước 3 · Sửa CV có duyệt",
    text: "Áp dụng, sửa hoặc bỏ qua từng gợi ý. Chỗ cần số liệu để trống cho bạn tự điền; kỹ năng chưa có không bao giờ được thêm vào.",
    pane: <PaneOptimize />,
    alt: "Minh hoạ: Trình tối ưu CV, một câu đã được áp dụng.",
  },
  {
    label: "Bước 4 · Luyện phỏng vấn, theo dõi tiến bộ",
    text: "Trả lời 5 câu theo vị trí, mỗi câu có đồng hồ riêng. Báo cáo chấm theo STAR và điểm được so qua từng buổi cùng vị trí.",
    pane: <PaneInterview />,
    alt: "Minh hoạ: phòng phỏng vấn với điểm STAR và biểu đồ tiến bộ.",
  },
]

/** Kiểu "Details that matter" của Family: cột trái dính, các khung bên phải hiện dần khi cuộn tới. */
export function HowItWorks() {
  return (
    <section id="cach-dung" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-16 pb-20 md:px-10 md:pt-[100px] md:pb-[140px] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-[72px]">
        <div className="lg:sticky lg:top-[120px]">
          <SectionHeading title="Từ CV đến buổi phỏng vấn." description="Bốn bước, mỗi bước có phản hồi cụ thể. Bạn luôn là người quyết định." className="lg:max-w-[440px]" />
          <Link href="/register" className="mt-7 inline-flex items-center gap-1.5 font-semibold">
            Bắt đầu với CV của bạn
            <ArrowRight className="size-[15px]" aria-hidden />
          </Link>
        </div>
        <ol className="grid gap-12 md:gap-[88px]">
          {STEPS.map((s) => (
            <li key={s.label}>
              <Reveal className="grid gap-3.5 md:gap-[18px]">
                <div className="overflow-hidden rounded-[20px] bg-panel p-3 md:rounded-[24px] md:p-7">
                  <div role="img" aria-label={s.alt} className="min-h-[300px] rounded-card bg-card p-4 shadow-[var(--shadow-sm-token),0_0_0_1px_var(--line)] md:min-h-[320px] md:p-6">
                    <div aria-hidden>{s.pane}</div>
                  </div>
                </div>
                <h3 className="text-[15px] font-semibold text-blue">{s.label}</h3>
                <p className="text-base leading-[26px] text-ink-2 md:text-lg md:leading-[29px]">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
