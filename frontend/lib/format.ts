const rtf = new Intl.RelativeTimeFormat("vi", { numeric: "auto" })

/** "15 phút trước", "hôm qua", "3 ngày trước"... */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 60) return "Vừa xong"
  if (abs < 3600) return rtf.format(Math.round(diffSeconds / 60), "minute")
  if (abs < 86_400) return rtf.format(Math.round(diffSeconds / 3600), "hour")
  if (abs < 30 * 86_400) return rtf.format(Math.round(diffSeconds / 86_400), "day")
  return new Date(iso).toLocaleDateString("vi-VN")
}

/** 850 KB, 1.2 MB */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "14:05" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).toDateString() === now.toDateString()
}

/** "Hôm nay, 09:30" khi trong ngày, ngược lại "3 ngày trước" / "14/10/2024". */
export function formatWhen(iso: string, now: Date = new Date()): string {
  return isToday(iso, now) ? `Hôm nay, ${formatTime(iso)}` : formatRelativeTime(iso, now)
}

/** "07/09/2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}
