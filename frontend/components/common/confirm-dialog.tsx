"use client"

import { useState, type ReactNode } from "react"
import { Loader2, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface ConfirmFact {
  label: string
  value: ReactNode
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Một câu ngắn; số liệu chính đưa vào `facts` để người dùng đọc lướt. */
  description?: ReactNode
  /** Icon tròn phía trên tiêu đề. */
  icon?: LucideIcon
  /** Các con số chính, xếp thành một hàng ô (tối đa 4). */
  facts?: ConfirmFact[]
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** Dialog tự đóng khi hàm này hoàn tất; giữ nguyên nếu nó ném lỗi. */
  onConfirm: () => Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  facts,
  confirmLabel,
  cancelLabel = "Huỷ",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Nơi gọi đã hiển thị lỗi; giữ dialog mở để thử lại.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-panel p-0 shadow-dialog ring-line sm:max-w-[460px]">
        <div className="grid gap-5 px-6 pt-6 pb-6">
          {Icon && (
            <span
              className={cn(
                "grid size-11 place-items-center rounded-full",
                destructive ? "bg-bad-soft text-bad" : "bg-blue-soft text-blue",
              )}
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
          )}
          <div className="grid gap-1.5">
            <DialogTitle className="font-heading text-xl leading-7 font-semibold tracking-[-0.01em] text-ink">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-[15px] leading-6 text-ink-2">{description}</DialogDescription>
            )}
          </div>
          {facts && facts.length > 0 && (
            <dl
              className="grid divide-x divide-line rounded-card bg-panel"
              style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
            >
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0 px-4 py-3.5">
                  <dt className="truncate text-[13px] text-ink-3">{fact.label}</dt>
                  <dd className="mt-0.5 text-xl leading-7 font-semibold text-ink tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2.5 px-6 pb-6 sm:flex-row sm:justify-end">
          <Button variant="soft" size="brand" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            size="brand"
            className={cn(destructive && "bg-bad text-on-ink hover:bg-bad/85")}
            onClick={confirm}
            disabled={busy}
          >
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
