"use client"

import { useSyncExternalStore } from "react"

// Kho nhỏ báo cho nút "Rời phòng" (header khung tập trung) biết có cần hỏi xác nhận không.
// Phòng phỏng vấn bật guard khi đang làm dở, tắt khi đã hoàn thành.

let message: string | null = null
let leaveAction: (() => Promise<unknown> | void) | null = null
const listeners = new Set<() => void>()

/** onLeave: việc cần làm khi SV xác nhận rời đi, ví dụ huỷ buổi phỏng vấn đang dở. */
export function setLeaveGuard(next: string | null, onLeave?: () => Promise<unknown> | void) {
  message = next
  leaveAction = next ? (onLeave ?? null) : null
  listeners.forEach((l) => l())
}

/** Chạy việc dọn dẹp đã đăng ký (nếu có) rồi gỡ guard. */
export async function runLeaveAction() {
  const action = leaveAction
  setLeaveGuard(null)
  try {
    await action?.()
  } catch {
    // Rời trang vẫn tiếp tục; backend tự huỷ buổi bỏ dở khi quá hạn.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLeaveGuard(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => message,
    () => null,
  )
}
