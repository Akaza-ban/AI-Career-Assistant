"use client"

import { Check, ShieldCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DATA_POLICY_SECTIONS, DATA_POLICY_SUMMARY, DATA_POLICY_UPDATED_AT } from "@/lib/data-policy"
import { cn } from "@/lib/utils"

/** 4 ý chính, dạng checklist trên nền xám. */
export function PolicySummary({ columns = 2, className }: { columns?: 1 | 2; className?: string }) {
  return (
    <ul className={cn("grid gap-x-5 gap-y-2.5 rounded-card bg-panel px-5 py-[18px]", columns === 2 && "sm:grid-cols-2", className)}>
      {DATA_POLICY_SUMMARY.map((t) => (
        <li key={t} className="flex gap-2.5 text-sm leading-[21px] font-medium text-ink">
          <Check className="mt-0.5 size-[15px] shrink-0 text-good" strokeWidth={2.25} aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  )
}

/** 5 mục đánh số của chính sách. */
export function PolicySections({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {DATA_POLICY_SECTIONS.map((section, i) => (
        <section key={section.title} className={cn("border-b border-line last-of-type:border-b-0", compact ? "py-4" : "py-[22px]")}>
          <h3 className={cn("flex items-baseline gap-3 font-semibold text-ink", compact ? "text-[15px] leading-[22px]" : "text-base leading-6")}>
            <span className="text-sm text-ink-3 tabular-nums">{i + 1}</span>
            {section.title}
          </h3>
          <ul
            className={cn(
              "mt-2 grid list-disc gap-1.5 text-ink-2 marker:text-ink-3",
              compact ? "pl-[38px] text-sm leading-[21px]" : "mt-2.5 gap-2 pl-[42px] text-[15px] leading-[23px]",
            )}
          >
            {section.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className={cn("text-ink-3", compact ? "pt-1 pb-2 text-[13px]" : "mb-4 text-sm")}>Có câu hỏi về dữ liệu của bạn? Hãy liên hệ nhóm T131 · Model Citizens.</p>
    </>
  )
}

/** Popup Chính sách dữ liệu, mở từ chân trang giới thiệu. */
export function DataPolicyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(860px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden rounded-panel p-0 shadow-dialog ring-line sm:max-w-[680px]"
      >
        <header className="flex shrink-0 items-start gap-3.5 border-b border-line px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink">
            <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[22px] leading-7 font-semibold text-ink">Chính sách dữ liệu</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-ink-3">Cập nhật {DATA_POLICY_UPDATED_AT} · Đọc khoảng 3 phút</DialogDescription>
          </div>
          <DialogClose render={<Button variant="ghost" size="icon" className="size-9 rounded-full text-ink-3 hover:text-ink" />} aria-label="Đóng">
            <X className="size-[18px]" strokeWidth={1.75} />
          </DialogClose>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-2 [scrollbar-width:thin] sm:px-6">
          <PolicySummary />
          <PolicySections />
        </div>

        <footer className="flex shrink-0 justify-end border-t border-line px-5 py-4 sm:px-6">
          <Button variant="soft" size="brand" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
