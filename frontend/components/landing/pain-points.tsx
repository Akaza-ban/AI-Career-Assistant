import Image from "next/image"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

import { SectionHeading } from "./landing-bits"
import { Reveal } from "./reveal"

const ROWS = [
  {
    task: "Biết CV còn thiếu gì",
    alone: "Đọc lại JD và tự đoán, hoặc chờ phản hồi từ nhà tuyển dụng.",
    careerx: "Mỗi yêu cầu trong JD được đối chiếu với câu trích từ CV: đã đáp ứng, chỉ liệt kê hay còn thiếu.",
  },
  {
    task: "Sửa CV cho đúng vị trí",
    alone: "Sửa theo mẫu CV chung, không chắc câu nào cần viết lại.",
    careerx: "Gợi ý sửa từng câu kèm lý do. Bạn áp dụng, sửa hoặc bỏ qua; chỗ cần số liệu để trống cho bạn tự điền.",
  },
  {
    task: "Luyện phỏng vấn",
    alone: "Tự hỏi tự trả lời, không biết câu trả lời đã đủ ý chưa.",
    careerx: "5 câu theo vị trí, mỗi câu có đồng hồ. Báo cáo chấm theo STAR và chỉ ra phần còn yếu.",
  },
]

const COLS = "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.15fr)]"

/** Ngay dưới hero: so sánh tự chuẩn bị với dùng CareerX, dạng bảng kẻ mảnh (không thẻ, không icon). */
export function PainPoints() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-8 pb-20 md:px-10 md:pt-16 md:pb-[120px]">
      <SectionHeading
        title="Bớt đoán, luyện đúng chỗ."
        description="Khi tự chuẩn bị, rất khó biết CV còn thiếu gì hay câu trả lời đã đủ ý chưa. CareerX chỉ ra từng chỗ cụ thể."
      />
      <Reveal className="mt-10 md:mt-14">
        <div role="table" aria-label="So sánh tự chuẩn bị và dùng CareerX">
          {/* Hàng tiêu đề (desktop) */}
          <div role="row" className={cn("hidden md:grid", COLS)}>
            <span role="columnheader">
              <span className="sr-only">Việc cần làm</span>
            </span>
            <span role="columnheader" className="self-end px-6 pb-4 text-sm font-semibold text-ink-3">
              Tự chuẩn bị
            </span>
            <span role="columnheader" className="flex items-center gap-2 rounded-t-[20px] bg-panel px-7 pt-6 pb-4 text-sm font-semibold text-ink">
              <Image src="/brand/careerx-glyph.png" alt="" width={18} height={18} className="size-[18px]" />
              Với CareerX
            </span>
          </div>
          {ROWS.map((r, i) => {
            const last = i === ROWS.length - 1
            return (
              <div key={r.task} role="row" className={cn("grid border-t border-line max-md:py-6 md:border-t-0", COLS)}>
                <span role="rowheader" className="text-lg leading-7 font-semibold text-ink md:border-t md:border-line md:py-7 md:pr-6 md:text-xl">
                  {r.task}
                </span>
                <span role="cell" className="mt-2 text-[15px] leading-6 text-ink-3 md:mt-0 md:border-t md:border-line md:px-6 md:py-7 md:text-base md:leading-[26px]">
                  <span className="mb-0.5 block text-[13px] font-semibold text-ink-3 md:hidden">Tự chuẩn bị</span>
                  {r.alone}
                </span>
                <span
                  role="cell"
                  className={cn(
                    "mt-4 flex gap-3 rounded-[14px] bg-panel p-4 text-[15px] leading-6 text-ink md:mt-0 md:rounded-none md:px-7 md:py-7 md:text-base md:leading-[26px]",
                    "md:shadow-[inset_0_1px_0_var(--line-strong)]",
                    last && "md:rounded-b-[20px]",
                  )}
                >
                  <Check className="mt-[5px] size-4 shrink-0 text-good" strokeWidth={2.25} aria-hidden />
                  <span>
                    <span className="mb-0.5 block text-[13px] font-semibold text-ink md:hidden">Với CareerX</span>
                    {r.careerx}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </Reveal>
    </section>
  )
}
