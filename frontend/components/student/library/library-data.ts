"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { CvVersion, JdRecommendationItem, JobDescription, RecommendJdsResponse } from "@/lib/types"
import { useApi } from "@/lib/use-api"

/** Giới hạn gợi ý của backend (DESIGN.md mục 12). */
export const MAX_RECOMMENDATIONS = 6

const LEVEL_LABEL: Record<string, string> = { intern: "Thực tập", fresher: "Fresher", junior: "Junior" }

export const levelText = (level: string | null | undefined) => (level ? (LEVEL_LABEL[level] ?? level) : null)

/** "Công ty A · Thực tập" (bỏ phần trống). */
export const metaLine = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ")

/** Ba kỹ năng bắt buộc đầu tiên, dùng cho dòng phụ trong bảng. */
export const requiredLine = (jd: JobDescription) =>
  jd.skills
    .filter((s) => s.importance === "required")
    .slice(0, 3)
    .map((s) => s.name)
    .join(" · ")

/** "CV_NguyenMinhAnh_BA · v2.1": bỏ đuôi file và hậu tố phiên bản trùng với nhãn. */
export function cvOptionLabel(cv: CvVersion): string {
  const base = cv.file_name.replace(/\.[^.]+$/, "")
  const suffix = `_${cv.label}`
  return `${base.endsWith(suffix) ? base.slice(0, -suffix.length) : base} · ${cv.label}`
}

/** CV mặc định để gợi ý: CV đang dùng, nếu không có thì CV sẵn sàng đầu tiên. */
export function defaultCv(cvs: CvVersion[], preferredId: string | null): CvVersion | null {
  const ready = cvs.filter((cv) => cv.status === "ready")
  return (
    ready.find((cv) => cv.id === preferredId || cv.family_id === preferredId) ??
    ready.find((cv) => cv.is_active) ??
    ready[0] ??
    null
  )
}

// Gợi ý tốn một lượt LLM (lời khuyên), nên giữ kết quả theo CV trong phiên: từ Thư viện sang Chi tiết vị trí
// không phải gọi lại. Bản có lời khuyên dùng được cho cả nơi không cần lời khuyên.
const recCache = new Map<string, Promise<RecommendJdsResponse>>()
const cacheKey = (cvId: string, advice: boolean) => `${cvId}:${advice ? "advice" : "plain"}`

function fetchRecommendations(cvId: string, advice: boolean): Promise<RecommendJdsResponse> {
  const withAdvice = recCache.get(cacheKey(cvId, true))
  if (withAdvice) return withAdvice
  const key = cacheKey(cvId, advice)
  let pending = recCache.get(key)
  if (!pending) {
    pending = api.recommendJds({ cv_version_id: cvId, top_n: MAX_RECOMMENDATIONS, generate_advice: advice })
    pending.catch(() => recCache.delete(key))
    recCache.set(key, pending)
  }
  return pending
}

interface RecommendationState {
  data: RecommendJdsResponse | undefined
  error: Error | undefined
  loading: boolean
  reload: () => void
}

export function useRecommendations(cvId: string | null, advice: boolean): RecommendationState {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: RecommendJdsResponse; error?: Error }>()
  const key = cvId ? `${cacheKey(cvId, advice)}:${version}` : null

  useEffect(() => {
    if (!cvId || !key) return
    let active = true
    fetchRecommendations(cvId, advice).then(
      (data) => active && setResult({ key, data }),
      (err: unknown) => active && setResult({ key, error: err instanceof Error ? err : new Error(String(err)) }),
    )
    return () => {
      active = false
    }
  }, [cvId, advice, key])

  const current = result?.key === key ? result : undefined
  return {
    data: current?.data,
    error: current?.error,
    loading: key !== null && current === undefined,
    reload: () => {
      if (cvId) {
        recCache.delete(cacheKey(cvId, true))
        recCache.delete(cacheKey(cvId, false))
      }
      setVersion((v) => v + 1)
    },
  }
}

export const recommendationMap = (recs: JdRecommendationItem[] | undefined) =>
  new Map((recs ?? []).map((r, i) => [r.jd_id, { item: r, rank: i + 1 }]))

export type RecommendationLookup = ReturnType<typeof recommendationMap>

export interface SavedState {
  savedIds: Set<string>
  loading: boolean
  toggle: (jdId: string) => void
}

/** Vị trí đã lưu, đổi ngay trên giao diện; lỗi thì trả về trạng thái cũ kèm toast "Thử lại". */
export function useSavedJds(): SavedState {
  const { data, loading } = useApi(api.listSavedJds)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const savedIds = useMemo(() => {
    const ids = new Set((data ?? []).map((s) => s.jd_id))
    for (const [id, on] of Object.entries(overrides)) {
      if (on) ids.add(id)
      else ids.delete(id)
    }
    return ids
  }, [data, overrides])

  const apply = (jdId: string, save: boolean) => {
    setOverrides((o) => ({ ...o, [jdId]: save }))
    ;(save ? api.saveJd(jdId) : api.unsaveJd(jdId)).catch(() => {
      setOverrides((o) => ({ ...o, [jdId]: !save }))
      toast.error(save ? "Chưa lưu được vị trí." : "Chưa bỏ lưu được vị trí.", {
        action: { label: "Thử lại", onClick: () => apply(jdId, save) },
      })
    })
  }

  return { savedIds, loading, toggle: (jdId) => apply(jdId, !savedIds.has(jdId)) }
}
