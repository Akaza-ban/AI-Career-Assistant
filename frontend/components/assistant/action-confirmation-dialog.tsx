'use client';

import { useMemo } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { AgentPageContext } from "@/lib/use-agent-actions"
import type { AgentAction } from "@/types/assistant"

interface ActionConfirmationDialogProps {
  action: AgentAction | null
  busy: boolean
  error?: string | null
  onConfirm: () => Promise<void>
  onReject: () => Promise<void>
}

/** Hỏi trang đang mở CV và vị trí đang chọn (trang Phân tích gửi qua page_state) để hộp xác nhận nói rõ sẽ làm gì. */
function selectionRows(): { label: string; value: string }[] {
  const context: AgentPageContext = {}
  window.dispatchEvent(new CustomEvent("agent:page_context", { detail: context }))
  const state = context.page_state ?? {}
  const rows = [
    { label: "CV", value: state.selected_cv_name },
    { label: "Vị trí", value: state.selected_jd_title },
  ]
  return rows.filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value !== "")
}

/** Bản vẽ TroLyXacNhan: việc tạo dữ liệu (như bắt đầu phân tích) luôn chờ người dùng đồng ý. */
export function ActionConfirmationDialog({ action, busy, error, onConfirm, onReject }: ActionConfirmationDialogProps) {
  const isAnalysis = action?.action_type === "START_ANALYSIS"
  const rows = useMemo(() => (action && isAnalysis ? selectionRows() : []), [action, isAnalysis])
  if (!action) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) void onReject() }}>
      <DialogContent
        showCloseButton={false}
        className="z-[70] gap-0 rounded-panel p-0 shadow-dialog ring-line sm:max-w-[460px]"
        data-agent-target="action-confirmation-dialog"
      >
        <div className="grid gap-4 px-6 pt-6 pb-6">
          <div className="grid gap-1.5">
            <DialogTitle className="font-heading text-xl leading-7 font-semibold tracking-[-0.01em] text-ink">
              {isAnalysis ? "Bắt đầu phân tích?" : "Cho phép trợ lý thực hiện?"}
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-6 text-ink-2">
              {isAnalysis
                ? "Trợ lý sẽ phân tích CV với vị trí dưới đây. Kết quả mở ngay khi xong và được lưu vào Tiến bộ."
                : action.confirmation_message || action.description_vi}
            </DialogDescription>
          </div>
          {rows.length > 0 && (
            <dl className="grid gap-1.5 rounded-card bg-panel px-4 py-3 text-sm">
              {rows.map((row) => (
                <div key={row.label} className="flex gap-3">
                  <dt className="w-14 shrink-0 text-ink-3">{row.label}</dt>
                  <dd className="min-w-0 font-semibold text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {error && <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{error}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2.5 px-6 pb-6 sm:flex-row sm:justify-end">
          <Button variant="soft" size="brand" disabled={busy} onClick={() => { void onReject() }}>
            Huỷ
          </Button>
          <Button size="brand" disabled={busy} onClick={() => { void onConfirm() }}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {isAnalysis ? "Bắt đầu phân tích" : "Đồng ý"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
