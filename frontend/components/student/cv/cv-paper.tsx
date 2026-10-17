"use client"

import { useCallback } from "react"

import { CvViewer, loadCvView } from "@/components/common/cv-viewer"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"

/** Nguồn xem một phiên bản CV của SV: ảnh trang PDF / nội dung theo mẫu CV; văn bản ở chế độ mock. */
export function studentCvSource(cv: CvVersion) {
  return {
    preview: () => api.getCvPreview(cv.id),
    page: (page: number) => api.getCvPage(cv.id, page),
    text: () => api.getCvText(cv.id),
  }
}

/** Nội dung một phiên bản CV dạng các tờ giấy (trang Chi tiết CV). */
export function CvPaper({ cv, className }: { cv: CvVersion; className?: string }) {
  const load = useCallback(() => loadCvView(studentCvSource(cv)), [cv])
  return <CvViewer load={load} fileName={cv.file_name} showInfo className={className} />
}
