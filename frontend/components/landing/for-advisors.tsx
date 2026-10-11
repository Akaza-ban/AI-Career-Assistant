import Link from "next/link"
import { ArrowRight, Check, UserRound } from "lucide-react"

import { cn } from "@/lib/utils"

import { LandingBadge, SectionHeading } from "./landing-bits"
import { Reveal } from "./reveal"

const POINTS = [
  ["Xem đúng phần được chia sẻ", "CV và báo cáo phỏng vấn mà sinh viên đã bật chia sẻ."],
  ["Nhận xét từng buổi phỏng vấn", "Nhận xét nằm cạnh báo cáo AI; điểm AI giữ nguyên."],
  ["Biết sớm ai cần hỗ trợ", "Sinh viên không tăng điểm 2 vòng liên tiếp được đưa lên đầu."],
]

// Dữ liệu minh hoạ, không dùng tên người thật.
const ROWS = [
  { name: "Sinh viên A", target: "Data Analyst Intern", score: "2,8 → 4,1", tone: "good", label: "Đang tiến bộ", avatar: "bg-blue-soft text-accent-strong" },
  { name: "Sinh viên B", target: "Business Analyst Intern", score: "3,4 → 2,9", tone: "warn", label: "Cần chú ý", avatar: "bg-warn-soft text-warn" },
  { name: "Sinh viên C", target: "Marketing Analyst", score: "3,0 → 3,6", tone: "mid", label: "Chờ nhận xét", avatar: "bg-good-soft text-good" },
] as const

const GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_88px_118px]"

export function ForAdvisors() {
  return (
    <section id="co-van" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-20 md:px-10 md:py-[120px]">
      <div className="flex flex-wrap items-center gap-12 lg:gap-16">
        <div className="min-w-0 flex-[1_1_400px]">
          <SectionHeading eyebrow="Cho cố vấn hướng nghiệp" title="Đồng hành đúng lúc sinh viên cần." />
          <ul className="mt-7">
            {POINTS.map(([t, d]) => (
              <li key={t} className="flex gap-3 border-b border-line py-3.5">
                <Check className="mt-1 size-4 shrink-0 text-good" strokeWidth={2.25} aria-hidden />
                <div>
                  <p className="font-semibold text-ink">{t}</p>
                  <p className="text-ink-2">{d}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 font-semibold">
            Cố vấn đăng nhập
            <ArrowRight className="size-[15px]" aria-hidden />
          </Link>
        </div>
        <Reveal className="w-full min-w-0 flex-[1_1_560px] rounded-[24px] bg-panel p-3 md:p-6">
          <div role="img" aria-label="Minh hoạ: bảng theo dõi của cố vấn với điểm phỏng vấn và trạng thái của từng sinh viên." className="rounded-card bg-card px-4 py-2 shadow-[var(--shadow-sm-token),0_0_0_1px_var(--line)] md:px-5">
            <div aria-hidden>
              <div className={cn(GRID, "border-b border-line py-3 text-xs font-medium text-ink-3")}>
                <span>Sinh viên</span>
                <span className="max-sm:hidden">Vị trí đang luyện</span>
                <span className="max-sm:hidden">Điểm PV</span>
                <span>Trạng thái</span>
              </div>
              {ROWS.map((r) => (
                <div key={r.name} className={cn(GRID, "border-b border-line py-3.5 text-sm last:border-b-0")}>
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span className={cn("grid size-8 place-items-center rounded-full", r.avatar)}>
                      <UserRound className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      {r.name}
                      <span className="block truncate text-[13px] font-normal text-ink-3 sm:hidden">
                        {r.target} · <span className="tabular-nums">{r.score}</span>
                      </span>
                    </span>
                  </span>
                  <span className="truncate text-ink-2 max-sm:hidden">{r.target}</span>
                  <span className="tabular-nums max-sm:hidden">{r.score}</span>
                  <span>
                    <LandingBadge tone={r.tone}>{r.label}</LandingBadge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
