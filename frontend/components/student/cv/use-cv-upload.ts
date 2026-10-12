"use client"

import { useState } from "react"
import { toast } from "sonner"

import { api, ApiError } from "@/lib/api"
import { formatTime } from "@/lib/format"
import type { CvVersion } from "@/lib/types"

// Khớp CV_MAX_BYTES ở backend (src/services/cv_files.py).
export const CV_MAX_MB = 5
export const CV_MAX_BYTES = CV_MAX_MB * 1024 * 1024
export const CV_ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string; size: number }
  | { status: "error"; fileName: string; size: number; message: string }

/** US-SV-01: nhận PDF/DOCX/PNG/JPG/JPEG ≤ CV_MAX_MB; từ chối ngay phía client nếu sai định dạng/dung lượng. */
export function validateCvFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext || !["pdf", "docx", "png", "jpg", "jpeg"].includes(ext)) {
    return "Chỉ hỗ trợ file PDF, DOCX hoặc ảnh (PNG, JPG, JPEG)."
  }
  if (file.size > CV_MAX_BYTES) return `File vượt quá dung lượng cho phép (tối đa ${CV_MAX_MB}MB).`
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
