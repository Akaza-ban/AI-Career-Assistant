import { toast } from "sonner"

import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"

/** Lưu một Blob về máy với tên file cho trước. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  // Thu hồi ngay sau click có thể huỷ lượt tải ở một số trình duyệt.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Tải file gốc của một phiên bản CV về máy. */
export async function downloadCv(cv: CvVersion) {
  try {
    const blob = await api.getCvFile(cv.id)
    if (blob) saveBlob(blob, cv.file_name)
    else toast.info(`Bản demo chưa có file thật để tải: ${cv.file_name}`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Không tải được file CV.")
  }
}
