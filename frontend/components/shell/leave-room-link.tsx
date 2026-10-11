"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, LogOut } from "lucide-react"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { runLeaveAction, useLeaveGuard } from "@/lib/leave-guard"

/**
 * Nút "Rời phòng" ở header khung tập trung: về trang Luyện phỏng vấn; hỏi xác nhận nếu phòng phỏng vấn đang làm dở.
 */
export function LeaveRoomLink({ href = "/student/interview/new" }: { href?: string }) {
  const router = useRouter()
  const guard = useLeaveGuard()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Link
        href={href}
        onClick={(e) => {
          if (guard) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Rời phòng
      </Link>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        icon={LogOut}
        title="Rời phòng phỏng vấn?"
        description={guard}
        cancelLabel="Tiếp tục phỏng vấn"
        confirmLabel="Rời phòng"
        onConfirm={async () => {
          await runLeaveAction()
          router.push(href)
        }}
      />
    </>
  )
}
