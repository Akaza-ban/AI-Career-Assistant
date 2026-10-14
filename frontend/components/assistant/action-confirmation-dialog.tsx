'use client';

import { Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import type { AgentAction } from "@/types/assistant"

interface ActionConfirmationDialogProps {
  action: AgentAction | null
  busy: boolean
  error?: string | null
  onConfirm: () => Promise<void>
  onReject: () => Promise<void>
}

export function ActionConfirmationDialog({ action, busy, error, onConfirm, onReject }: ActionConfirmationDialogProps) {
  if (!action) return null
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) void onReject() }}>
      <DialogContent showCloseButton={false} className="z-[70] sm:max-w-lg" data-agent-target="action-confirmation-dialog">
        <DialogHeader>
          <ShieldCheck className="size-8 text-blue" aria-hidden />
          <DialogTitle>Yêu cầu xác nhận hành động</DialogTitle>
          <DialogDescription>{action.confirmation_message || action.description_vi}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="soft" disabled={busy} onClick={() => { void onReject() }}>Huỷ bỏ</Button>
          <Button type="button" disabled={busy} onClick={() => { void onConfirm() }}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Đồng ý
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
