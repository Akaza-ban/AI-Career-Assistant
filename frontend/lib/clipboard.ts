/**
 * Sao chép văn bản vào clipboard. Trang mở qua http không phải localhost (ví dụ http://<IP máy> khi demo trong mạng LAN)
 * không có Clipboard API, nên dùng cách chọn văn bản + lệnh copy làm dự phòng.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Bị từ chối quyền hoặc không hỗ trợ: thử cách dự phòng bên dưới.
  }
  const el = document.createElement("textarea")
  el.value = text
  el.setAttribute("readonly", "")
  el.style.position = "fixed"
  el.style.opacity = "0"
  document.body.appendChild(el)
  el.select()
  const ok = document.execCommand("copy")
  el.remove()
  return ok
}
