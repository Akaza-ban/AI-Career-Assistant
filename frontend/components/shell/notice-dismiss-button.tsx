"use client"

import { X } from "lucide-react"

import { noticeHtmlAttr, noticeStorageKey } from "@/lib/notice"
import type { Role } from "@/lib/types"

export function NoticeDismissButton({ role }: { role: Role }) {
  function dismiss() {
    document.documentElement.setAttribute(noticeHtmlAttr(role), "")
    try {
      sessionStorage.setItem(noticeStorageKey(role), "1")
    } catch {
      // Trình duyệt chặn storage: banner vẫn ẩn cho tới khi tải lại trang.
    }
  }

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Ẩn lưu ý trong phiên này"
      className="grid size-6 shrink-0 place-items-center rounded-md text-ink-2 transition-colors hover:bg-blue-soft hover:text-ink"
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}
