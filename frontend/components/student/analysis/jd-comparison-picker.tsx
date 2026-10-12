"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  History,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { LEVEL_LABEL } from "@/components/student/analysis/jd-picker-sections"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/lib/api"
import type { CompareJDsResponse, CvVersion, JobDescription } from "@/lib/types"
import { cn } from "@/lib/utils"

interface JdComparisonPickerProps {
  selectedCv: CvVersion
  libraryJds?: JobDescription[]
  selectedJd: JobDescription | null
  onSelectJd: (jd: JobDescription) => void
}

const MAX_COMPARE_COUNT = 5
const MIN_COMPARE_COUNT = 2

export function JdComparisonPicker({
  selectedCv,
  libraryJds = [],
  selectedJd,
  onSelectJd,
}: JdComparisonPickerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparisonResult, setComparisonResult] = useState<CompareJDsResponse | null>(null)
  const [activeTab, setActiveTab] = useState<"new" | "history">("new")

  // State cho lịch sử so sánh
  const [historyList, setHistoryList] = useState<CompareJDsResponse[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const items = await api.listComparisonHistory(20)
      setHistoryList(items)
    } catch {
      // Bỏ qua lỗi im lặng nếu ở môi trường chưa sẵn sàng
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    let ignore = false
    api.listComparisonHistory(20)
      .then((items) => {
        if (!ignore) {
          setHistoryList(items)
        }
      })
      .catch(() => {
        // Bỏ qua lỗi nếu backend chưa sẵn sàng
      })
    return () => {
      ignore = true
    }
  }, [])

  function toggleJd(id: string) {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    } else {
      if (selectedIds.length >= MAX_COMPARE_COUNT) {
        toast.warning(`Bạn chỉ có thể chọn tối đa ${MAX_COMPARE_COUNT} vị trí JD để so sánh cùng lúc.`)
        return
      }
      setSelectedIds((prev) => [...prev, id])
    }
  }

  async function handleCompare() {
    if (selectedIds.length < MIN_COMPARE_COUNT) {
      toast.warning(`Vui lòng chọn ít nhất ${MIN_COMPARE_COUNT} vị trí JD để so sánh.`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await api.compareJds({
        cv_version_id: selectedCv.id,
        jd_ids: selectedIds,
      })
      setComparisonResult(res)
      toast.success(`Đã so sánh thành công ${res.total_compared} vị trí JD bằng AI và lưu vào lịch sử!`)
      void loadHistory()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "So sánh thất bại. Vui lòng thử lại."
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteHistory(historyId: string, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await api.deleteComparisonHistory(historyId)
      setHistoryList((prev) => prev.filter((item) => item.id !== historyId))
      toast.success("Đã xóa bản ghi so sánh khỏi lịch sử.")
      if (comparisonResult?.id === historyId) {
        setComparisonResult(null)
      }
    } catch {
      toast.error("Không xóa được lịch sử. Hãy thử lại.")
    }
  }

  function handlePickForAnalysis(jdId: string) {
    const target = libraryJds.find((j) => j.id === jdId)
    if (target) {
      onSelectJd(target)
      toast.success(`Đã chọn "${target.title}" để phân tích khoảng cách năng lực.`)
    }
  }

  const selectedCount = selectedIds.length
  const canCompare = selectedCount >= MIN_COMPARE_COUNT && selectedCount <= MAX_COMPARE_COUNT

  return (
    <Panel className="grid min-w-0 gap-6">
      {/* Header giới thiệu */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-blue-soft text-blue">
              <ArrowLeftRight className="size-4" aria-hidden />
            </span>
            <h2 className="font-heading text-lg font-bold">So sánh các vị trí tuyển dụng (Multi-JD Matching)</h2>
            <Badge variant="blue" className="text-[11px]">Hỗ trợ 2–5 JD</Badge>
          </div>
          <p className="text-sm text-ink-2">
            Chọn <strong>từ 2 đến 5 vị trí</strong> để AI đối soát đồng thời với CV{" "}
            <strong>{selectedCv.file_name}</strong>, xếp hạng mức độ phù hợp và tự động lưu lịch sử so sánh.
          </p>
        </div>

        {/* Nút quay lại chọn khi đang xem kết quả */}
        {comparisonResult && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setComparisonResult(null)
            }}
          >
            <RotateCcw className="size-3.5" />
            Chọn lại vị trí
          </Button>
        )}
      </div>

      {/* Sub-tabs điều hướng: So sánh mới vs Lịch sử so sánh (chỉ hiện khi chưa xem chi tiết kết quả) */}
      {!comparisonResult && !loading && (
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "new"
                  ? "bg-blue text-white shadow-xs"
                  : "bg-surface text-ink-2 hover:bg-surface/80 hover:text-ink",
              )}
            >
              <Sparkles className="size-3.5" />
              So sánh mới ({selectedCount}/{MAX_COMPARE_COUNT})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("history")
                void loadHistory()
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                activeTab === "history"
                  ? "bg-blue text-white shadow-xs"
                  : "bg-surface text-ink-2 hover:bg-surface/80 hover:text-ink",
              )}
            >
              <History className="size-3.5" />
              Lịch sử so sánh
              {historyList.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] leading-tight">
                  {historyList.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "new" && (
            <span className="text-xs text-ink-3">
              Được chọn tối đa <strong>{MAX_COMPARE_COUNT}</strong> vị trí
            </span>
          )}
        </div>
      )}

      {/* Giai đoạn 1A: Tab So sánh mới */}
      {!comparisonResult && !loading && activeTab === "new" && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">
                Đã chọn: <strong className={cn("text-base", selectedCount >= MIN_COMPARE_COUNT ? "text-good" : "text-blue")}>{selectedCount}</strong>/{MAX_COMPARE_COUNT} vị trí
              </span>
              {selectedCount < MIN_COMPARE_COUNT && (
                <span className="text-xs text-ink-3">(Cần tối thiểu {MIN_COMPARE_COUNT} vị trí để so sánh)</span>
              )}
            </div>

            <Button
              variant="default"
              size="sm"
              disabled={!canCompare}
              onClick={() => void handleCompare()}
              className="gap-2"
            >
              <Sparkles className="size-4" />
              So sánh {selectedCount > 0 ? `${selectedCount} vị trí` : ""} bằng AI
            </Button>
          </div>

          {/* Danh sách thẻ JD có thể tích chọn */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {libraryJds.map((jd) => {
              const isChecked = selectedIds.includes(jd.id)
              return (
                <div
                  key={jd.id}
                  onClick={() => toggleJd(jd.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggleJd(jd.id)
                    }
                  }}
                  className={cn(
                    "relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4.5 transition-all",
                    isChecked
                      ? "border-blue bg-blue-soft/30 shadow-sm ring-1 ring-blue"
                      : "border-line bg-card hover:border-line-hover hover:bg-surface/50",
                  )}
                >
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid min-w-0 gap-0.5">
                        <h3 className="line-clamp-2 font-heading text-sm font-bold text-ink">{jd.title}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-ink-2">
                          <Building2 className="size-3.5 shrink-0 text-ink-3" />
                          <span className="truncate">{jd.company}</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                          isChecked
                            ? "border-blue bg-blue text-white"
                            : "border-line bg-surface text-transparent",
                        )}
                      >
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {jd.level && (
                        <Badge variant="neutral" className="text-[10px] py-0">
                          {LEVEL_LABEL[jd.level] ?? jd.level}
                        </Badge>
                      )}
                      {jd.industry && (
                        <Badge variant="neutral" className="text-[10px] py-0">
                          {jd.industry}
                        </Badge>
                      )}
                      <span className="text-[11px] text-ink-3 ml-auto">
                        {jd.skills.length} kỹ năng
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-line/60 pt-2.5">
                    <p className="line-clamp-1 text-xs text-ink-3">
                      Yêu cầu: {jd.skills.slice(0, 3).map((s) => s.name).join(", ")}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {libraryJds.length === 0 && (
            <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-2">
              Chưa có vị trí tuyển dụng trong thư viện.
            </p>
          )}
        </div>
      )}

      {/* Giai đoạn 1B: Tab Lịch sử so sánh đã lưu */}
      {!comparisonResult && !loading && activeTab === "history" && (
        <div className="grid gap-4">
          {loadingHistory && (
            <div className="grid gap-3 py-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          )}

          {!loadingHistory && historyList.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface/50 p-8 text-center">
              <Clock className="mx-auto size-8 text-ink-3 mb-2" />
              <p className="font-heading font-semibold text-ink">Chưa có lịch sử so sánh nào</p>
              <p className="mt-1 text-xs text-ink-2">
                Hãy chuyển sang tab &quot;So sánh mới&quot; và chọn từ 2 đến 5 vị trí để so sánh. Kết quả sẽ tự động được lưu lại đây.
              </p>
            </div>
          )}

          {!loadingHistory && historyList.length > 0 && (
            <div className="grid gap-3">
              {historyList.map((item) => {
                const topJd = item.comparisons[0]
                const dateLabel = item.created_at
                  ? new Date(item.created_at).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Vừa xong"

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setComparisonResult(item)
                      toast.info(`Đã mở lại kết quả so sánh ${item.total_compared} vị trí.`)
                    }}
                    role="button"
                    tabIndex={0}
                    className="group relative flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card p-4.5 transition-all hover:border-blue/50 hover:bg-surface/50 shadow-xs cursor-pointer"
                  >
                    <div className="grid gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="blue" className="text-[11px]">
                          {item.total_compared} vị trí JD
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-ink-3">
                          <Calendar className="size-3" />
                          {dateLabel}
                        </span>
                        {item.cv_label && (
                          <span className="text-xs text-ink-2 font-mono">
                            CV: {item.cv_label}
                          </span>
                        )}
                      </div>

                      <p className="line-clamp-1 text-sm font-semibold text-ink">
                        {item.comparisons.map((c) => c.title).join(" · ")}
                      </p>

                      {topJd && (
                        <p className="text-xs text-ink-2 flex items-center gap-1.5">
                          <Trophy className="size-3.5 text-violet shrink-0" />
                          Vị trí số 1: <strong className="text-ink">{topJd.title}</strong> (Độ khớp: {topJd.match_score}%)
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <Button
                        variant="soft"
                        size="sm"
                        className="text-xs pointer-events-none group-hover:bg-blue group-hover:text-white"
                      >
                        Xem chi tiết
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Xóa lượt so sánh này"
                        onClick={(e) => void handleDeleteHistory(item.id || "", e)}
                        className="text-ink-3 hover:text-bad hover:bg-bad-soft"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Trạng thái Loading */}
      {loading && (
        <div className="grid gap-4 py-8">
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-blue-soft/50 p-6 text-sm text-blue">
            <Loader2 className="size-5 animate-spin shrink-0" />
            <span className="font-medium">
              AI đang phân tích đối soát ngữ nghĩa song song {selectedCount} vị trí JD và lưu vào lịch sử...
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      )}

      {/* Trạng thái Lỗi */}
      {!loading && error && (
        <div className="grid justify-items-center gap-3 rounded-2xl border border-bad/20 bg-bad-soft/40 p-6 text-center">
          <AlertCircle className="size-8 text-bad" />
          <p className="font-heading font-bold text-bad">Chưa thể so sánh các vị trí tuyển dụng</p>
          <p className="text-sm text-ink-2">{error}</p>
          <Button variant="soft" size="sm" onClick={() => void handleCompare()}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Giai đoạn 2: Kết quả so sánh (Comparison Matrix) */}
      {!loading && comparisonResult && (
        <div className="grid gap-6">
          {/* Khối Kỹ năng thiếu chung ở tất cả các vị trí (Common Missing Skills) */}
          <div className="relative overflow-hidden rounded-2xl border border-warn/30 bg-gradient-to-br from-warn-soft/80 via-surface to-amber-soft/40 p-5 shadow-card">
            <div className="flex items-center gap-2 font-heading text-sm font-bold text-warn-text uppercase tracking-wide">
              <AlertTriangle className="size-4 text-warn" aria-hidden />
              Kỹ năng còn thiếu chung ở tất cả {comparisonResult.total_compared} vị trí
            </div>

            {comparisonResult.common_missing_skills.length > 0 ? (
              <div className="mt-3 grid gap-3">
                <p className="text-sm leading-6 text-ink">
                  Hệ thống phát hiện CV của bạn chưa đáp ứng các kỹ năng cốt lõi sau đây trên <strong>toàn bộ</strong> các JD đã chọn. 
                  Hãy ưu tiên trau dồi các kỹ năng này để tăng cơ hội trúng tuyển đa vị trí:
                </p>
                <div className="flex flex-wrap gap-2">
                  {comparisonResult.common_missing_skills.map((skill) => (
                    <Tooltip key={skill}>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-warn/40 bg-card px-3 py-1 text-xs font-semibold text-warn shadow-xs">
                            <Compass className="size-3.5 text-warn" aria-hidden />
                            {skill}
                          </span>
                        }
                      />
                      <TooltipContent className="text-xs">
                        Kỹ năng thiếu chung ở cả {comparisonResult.total_compared} vị trí
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-good font-medium flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Tuyệt vời! Không có kỹ năng thiếu chung nào bị trùng lặp ở tất cả các vị trí.
              </p>
            )}
          </div>

          {/* Ma trận so sánh đa cột (Side-by-side Matrix linh hoạt 2 đến 5 cột) */}
          <div
            className={cn(
              "grid gap-4",
              comparisonResult.comparisons.length === 2 && "md:grid-cols-2",
              comparisonResult.comparisons.length === 3 && "md:grid-cols-3",
              comparisonResult.comparisons.length >= 4 && "sm:grid-cols-2 lg:grid-cols-4",
            )}
          >
            {comparisonResult.comparisons.map((item) => {
              const isTop = item.rank === 1
              const isCurrentlySelected = selectedJd?.id === item.jd_id

              return (
                <div
                  key={item.jd_id}
                  className={cn(
                    "relative flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition-all",
                    isTop
                      ? "border-violet/40 bg-gradient-to-b from-violet-soft/30 via-card to-card ring-2 ring-violet/30"
                      : "border-line bg-card",
                  )}
                >
                  <div className="grid gap-4">
                    {/* Header cột */}
                    <div className="flex items-start justify-between gap-2 border-b border-line pb-3.5">
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isTop ? "violet" : "neutral"}
                            className="font-mono text-xs font-bold"
                          >
                            {isTop ? (
                              <span className="flex items-center gap-1">
                                <Trophy className="size-3 text-violet" />
                                #1 Phù hợp nhất
                              </span>
                            ) : (
                              `#${item.rank}`
                            )}
                          </Badge>
                          {item.level && (
                            <span className="text-xs text-ink-3">
                              {LEVEL_LABEL[item.level as keyof typeof LEVEL_LABEL] ?? item.level}
                            </span>
                          )}
                        </div>
                        <h3 className="font-heading text-base font-bold text-ink leading-snug">{item.title}</h3>
                        <p className="text-xs font-medium text-ink-2">{item.company}</p>
                      </div>
                    </div>

                    {/* Điểm tương thích ATS */}
                    <div className="grid gap-1.5 rounded-xl bg-surface p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-medium text-ink-2">Độ khớp CV–JD</span>
                        <span className="font-heading text-xl font-extrabold text-ink">
                          {item.match_score}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-line/60">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            item.match_score >= 75
                              ? "bg-good"
                              : item.match_score >= 50
                              ? "bg-blue"
                              : "bg-warn",
                          )}
                          style={{ width: `${Math.min(100, item.match_score)}%` }}
                        />
                      </div>
                    </div>

                    {/* Nhận xét của AI */}
                    {item.llm_summary && (
                      <div className="rounded-xl border border-line/60 bg-surface/50 p-3 text-xs leading-5 text-ink-2">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-ink">
                          <Bot className="size-3.5 text-blue" />
                          Đánh giá từ AI:
                        </div>
                        {item.llm_summary}
                      </div>
                    )}

                    {/* Chi tiết kỹ năng */}
                    <div className="grid gap-3 pt-1 text-xs">
                      {/* Đã đáp ứng */}
                      <div className="grid gap-1.5">
                        <span className="font-semibold text-good flex items-center gap-1">
                          <Check className="size-3.5 stroke-[2.5]" />
                          Kỹ năng đã có ({item.matched_skills.length}):
                        </span>
                        {item.matched_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.matched_skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-md bg-good-soft px-2 py-0.5 text-[11px] font-medium text-good"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-ink-3 italic">Chưa tìm thấy bằng chứng</span>
                        )}
                      </div>

                      {/* Một phần */}
                      {item.partial_skills.length > 0 && (
                        <div className="grid gap-1.5">
                          <span className="font-semibold text-warn flex items-center gap-1">
                            <Info className="size-3.5" />
                            Mới chỉ liệt kê ({item.partial_skills.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {item.partial_skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Còn thiếu */}
                      <div className="grid gap-1.5">
                        <span className="font-semibold text-bad flex items-center gap-1">
                          <X className="size-3.5 stroke-[2.5]" />
                          Còn thiếu ({item.missing_skills.length}):
                        </span>
                        {item.missing_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.missing_skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-md bg-bad-soft px-2 py-0.5 text-[11px] font-medium text-bad"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-good">Đáp ứng đầy đủ!</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nút chọn vị trí này */}
                  <div className="mt-5 border-t border-line pt-4">
                    <Button
                      variant={isCurrentlySelected ? "soft" : isTop ? "violet" : "secondary"}
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => handlePickForAnalysis(item.jd_id)}
                    >
                      {isCurrentlySelected ? (
                        <>
                          <Check className="size-4" />
                          Đang được chọn
                        </>
                      ) : (
                        <>
                          Chọn vị trí này để phân tích
                        </>
                      )}
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
