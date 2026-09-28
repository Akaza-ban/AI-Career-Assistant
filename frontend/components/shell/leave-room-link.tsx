"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { setLeaveGuard, useLeaveGuard } from "@/lib/leave-guard"

/** Nút "Rời phòng" ở header khung tập trung; hỏi xác nhận nếu phòng phỏng vấn đang làm dở. */
export function LeaveRoomLink({ href = "/student" }: { href?: string }) {
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rời phòng phỏng vấn?</DialogTitle>
            <DialogDescription>{guard}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="soft" onClick={() => setOpen(false)}>
              Tiếp tục phỏng vấn
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLeaveGuard(null)
                setOpen(false)
                router.push(href)
              }}
            >
              Rời phòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
