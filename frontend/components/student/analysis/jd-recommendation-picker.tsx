"use client"

import { useCallback, useEffect } from "react"
import {
  AlertCircle,
  Award,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  ListOrdered,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type {
  CvVersion,
  JobDescription,
  JobLevel,
} from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

import { LEVEL_LABEL } from "./jd-picker-sections"

interface JdRecommendationPickerProps {
  selectedCv: CvVersion
  selected: JobDescription | null
  onSelect: (jd: JobDescription) => void
  libraryJds: JobDescription[] | undefined
}

export function JdRecommendationPicker({
  selectedCv,
  selected,
  onSelect,
  libraryJds,
}: JdRecommendationPickerProps) {
  const fetcher = useCallback(
    () =>
      api.recommendJds({
        cv_version_id: selectedCv.id,
        top_n: 3,
        generate_advice: true,
      }),
    [selectedCv.id],
  )

  const { data, loading, error, reload } = useApi(fetcher)

  // Tự động chọn JD số 1 khi có dữ liệu gợi ý mà người dùng chưa chọn JD nào
  useEffect(() => {
    if (data?.recommendations?.length && !selected && libraryJds) {
      const topId = data.recommendations[0].jd_id
      const matched = libraryJds.find((j) => j.id === topId)
      if (matched) {
        onSelect(matched)
      }
    }
  }, [data, selected, libraryJds, onSelect])

  function handlePick(jdId: string) {
    if (!libraryJds) return
    const target = libraryJds.find((j) => j.id === jdId)
    if (target) {
      onSelect(target)
      toast.success(`Đã chọn vị trí "${target.title}" để phân tích khoảng cách năng lực.`)
    }
  }

  return (
    <Panel className="grid min-w-0 gap-6">
      {/* Header giới thiệu tính năng */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-violet-soft text-violet">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <h2 className="font-heading text-lg font-bold">Vị trí phù hợp nhất với CV của bạn</h2>
            <Badge variant="violet" className="text-[11px]">Two-Stage RAG</Badge>
          </div>
          <p className="text-sm text-ink-2">
            AI đối soát kỹ năng và kinh nghiệm từ CV <strong>{selectedCv.file_name}</strong> qua ChromaDB và thuật toán ATS để xếp hạng công việc phù hợp.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 bg-surface text-ink-2 hover:text-ink"
          disabled={loading}
          onClick={() => void reload()}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Quét lại
        </Button>
      </div>

      {/* Trạng thái Loading */}
      {loading && (
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl bg-violet-soft/40 p-4 text-sm text-violet">
            <Loader2 className="size-5 animate-spin shrink-0" />
            <span>AI đang phân tích vector CV, lọc ứng viên và chấm điểm tương thích ATS...</span>
          </div>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      )}

      {/* Trạng thái lỗi */}
      {!loading && error && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-bad/20 bg-bad-soft/40 p-6 text-center">
          <AlertCircle className="size-8 text-bad" />
          <p className="font-heading font-bold text-bad">Chưa thể tải danh sách gợi ý</p>
          <p className="text-sm text-ink-2">{error.message}</p>
          <Button variant="soft" size="sm" onClick={() => void reload()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Kết quả gợi ý */}
      {!loading && data && (
        <div className="grid gap-6">
          {/* Khối Lời khuyên nghề nghiệp từ AI */}
          {data.advice && (
            <div className="relative overflow-hidden rounded-2xl border border-violet/30 bg-gradient-to-br from-violet-soft/80 via-surface to-blue-soft/40 p-5 shadow-card">
              <div className="flex items-center gap-2 font-heading text-sm font-bold text-violet uppercase tracking-wide">
                <Bot className="size-4" aria-hidden />
                Tư vấn định hướng nghề nghiệp từ AI
              </div>
              <p className="mt-2 text-sm leading-6 font-medium text-ink">
                {data.advice.summary}
              </p>
              <p className="mt-1 text-xs leading-5 text-ink-2">
                {data.advice.top_position_advice}
              </p>

              {data.advice.action_plan.length > 0 && (
                <div className="mt-4 border-t border-violet/15 pt-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-ink uppercase tracking-wider">
                    <ListOrdered className="size-3.5 text-violet" aria-hidden />
                    Lộ trình hành động đề xuất:
                  </p>
                  <ul className="mt-2 grid gap-1.5 text-xs text-ink-2">
                    {data.advice.action_plan.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-violet-soft text-[10px] font-bold text-violet">
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Danh sách các JD được xếp hạng Top */}
          <div className="grid gap-3">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-ink-2">
              Các vị trí được xếp hạng theo độ tương thích ATS
            </h3>

            {data.recommendations.map((item, idx) => {
              const isSelected = selected?.id === item.jd_id
              const score = item.match_score ?? Math.round(item.semantic_score * 100)
              const rankBadge =
                idx === 0
                  ? { label: "#1 Phù hợp nhất", color: "bg-good text-white" }
                  : idx === 1
                  ? { label: "#2 Tiềm năng cao", color: "bg-blue text-white" }
                  : { label: "#3 Lựa chọn bổ sung", color: "bg-ink-3 text-white" }

              return (
                <div
                  key={item.jd_id}
                  onClick={() => handlePick(item.jd_id)}
                  className={cn(
                    "group relative cursor-pointer rounded-2xl border p-5 transition-all",
                    isSelected
                      ? "border-violet bg-violet-soft/20 shadow-md ring-2 ring-violet/40"
                      : "border-line bg-card hover:border-violet/40 hover:shadow-card",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold", rankBadge.color)}>
                          {rankBadge.label}
                        </span>
                        <h4 className="font-heading text-base font-bold text-ink group-hover:text-violet transition-colors">
                          {item.title}
                        </h4>
                      </div>

                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
                        {item.company && (
                          <span className="flex items-center gap-1 font-medium">
                            <Building2 className="size-3.5 text-blue" />
                            {item.company}
                          </span>
                        )}
                        {item.industry && <span>· {item.industry}</span>}
                        {item.level && (
                          <span className="font-medium text-violet">
                            · {LEVEL_LABEL[item.level as JobLevel] ?? item.level}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Huy hiệu điểm Match */}
                    <div className="flex items-center gap-2">
                      <div className="grid text-right">
                        <span className="font-heading text-lg font-black tabular-nums text-ink">
                          {score}%
                        </span>
                        <span className="text-[10px] text-ink-3 uppercase tracking-wider font-semibold">
                          ATS Match
                        </span>
                      </div>
                      <div
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl font-heading text-sm font-bold",
                          score >= 70
                            ? "bg-good-soft text-good"
                            : score >= 50
                            ? "bg-blue-soft text-blue"
                            : "bg-warn-soft text-warn",
                        )}
                      >
                        {score >= 70 ? (
                          <Award className="size-5" />
                        ) : score >= 50 ? (
                          <Check className="size-5" />
                        ) : (
                          <Flame className="size-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kỹ năng đã khớp và còn thiếu */}
                  <div className="mt-4 grid gap-2 border-t border-line/60 pt-3">
                    {item.matched_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-good flex items-center gap-1">
                          <Check className="size-3" /> Đã có:
                        </span>
                        {item.matched_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-good-soft/70 px-2 py-0.5 text-[11px] font-medium text-good"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.missing_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-warn flex items-center gap-1">
                          <AlertCircle className="size-3" /> Cần bổ sung:
                        </span>
                        {item.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-warn-soft/70 px-2 py-0.5 text-[11px] font-medium text-warn"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trạng thái lựa chọn */}
                  <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3 text-xs">
                    {isSelected ? (
                      <span className="flex items-center gap-1.5 font-bold text-violet">
                        <CheckCircle2 className="size-4" /> Đang chọn vị trí này để phân tích
                      </span>
                    ) : (
                      <span className="text-ink-3 group-hover:text-ink-2 transition-colors">
                        Bấm để chọn vị trí này
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant={isSelected ? "violet" : "secondary"}
                      className="h-8 gap-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePick(item.jd_id)
                      }}
                    >
                      {isSelected ? "Đã chọn" : "Chọn vị trí này"}
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Panel>
  )
}
