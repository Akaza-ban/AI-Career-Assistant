// Dải lưu ý dưới topbar: hiện mỗi lần người dùng mở web, ẩn đến hết phiên khi bấm X.
// Dùng sessionStorage: giữ qua các lần chuyển trang/tải lại (F5), mất khi đóng tab.

import type { Role } from "@/lib/types"

export const noticeStorageKey = (role: Role) => `careerx:notice-dismissed:${role}`
export const noticeHtmlAttr = (role: Role) => `data-notice-dismissed-${role}`

const roles: Role[] = ["student", "advisor"]

/**
 * Script chạy trước khi trang hiển thị (đặt trong <head> của root layout):
 * gắn thuộc tính lên <html> nếu phiên này đã tắt lưu ý, để CSS ẩn banner ngay, không bị nháy.
 */
export const noticeInitScript = `try{${roles
  .map(
    (role) =>
      `if(sessionStorage.getItem(${JSON.stringify(noticeStorageKey(role))})==="1")document.documentElement.setAttribute(${JSON.stringify(noticeHtmlAttr(role))},"")`,
  )
  .join(";")}}catch(e){}`
