"use client"

import { useSyncExternalStore } from "react"

// Kho nhỏ báo cho nút "Rời phòng" (header khung tập trung) biết có cần hỏi xác nhận không.
// Phòng phỏng vấn bật guard khi đang làm dở, tắt khi đã nộp bài.

let message: string | null = null
const listeners = new Set<() => void>()

export function setLeaveGuard(next: string | null) {
  message = next
  listeners.forEach((l) => l())
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
