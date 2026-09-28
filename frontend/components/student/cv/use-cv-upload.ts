"use client"

import { useState } from "react"
import { toast } from "sonner"

import { api, ApiError } from "@/lib/api"
import { formatTime } from "@/lib/format"
import type { CvVersion } from "@/lib/types"

export const CV_MAX_BYTES = 10 * 1024 * 1024
export const CV_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; size: number }
  | { status: "error"; fileName: string; size: number; message: string }

/** US-SV-01 AC3: chỉ nhận PDF/DOCX ≤ 10MB; từ chối ngay phía client, không gọi API. */
export function validateCvFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext !== "pdf" && ext !== "docx") return "Chỉ hỗ trợ file PDF hoặc DOCX."
  if (file.size > CV_MAX_BYTES) return "File vượt quá dung lượng cho phép (tối đa 10MB)."
  return null
}

export function useCvUpload(onUploaded: (cv: CvVersion) => void) {
  const [state, setState] = useState<UploadState>({ status: "idle" })

  async function upload(file: File) {
    const invalid = validateCvFile(file)
    if (invalid) {
      setState({ status: "error", fileName: file.name, size: file.size, message: invalid })
      return
    }
    setState({ status: "uploading", fileName: file.name, size: file.size })
    try {
      const cv = await api.uploadCv(file)
      setState({ status: "idle" })
      // US-SV-01 AC1: báo thành công kèm tên file và thời điểm tải lên.
      toast.success("Tải lên thành công", { description: `${cv.file_name} · lúc ${formatTime(cv.uploaded_at)}` })
      onUploaded(cv)
    } catch (err) {
      const message = err instanceof ApiError || err instanceof Error ? err.message : "Tải lên thất bại."
      setState({ status: "error", fileName: file.name, size: file.size, message })
    }
  }

  return { state, upload, dismiss: () => setState({ status: "idle" }) }
}
