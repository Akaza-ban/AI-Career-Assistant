"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronRight, ChevronUp, Heart, LockKeyhole, MessagesSquare, CloudOff, PencilLine, SearchX } from "lucide-react"

import { BottomActionBar } from "@/components/common/bottom-action-bar"
import { MatchBadge } from "@/components/common/match-badge"
import { PageHeader } from "@/components/common/page-header"
import { EmptyState } from "@/components/common/empty-state"
import { Panel } from "@/components/common/panel"
import { WidgetFooter, Zone } from "@/components/common/zone"
import { AddJdDialog } from "@/components/student/library/add-jd-dialog"
import { MatchSummary, SkillChip, type MatchSummaryProps } from "@/components/student/library/library-bits"
import {
  cvOptionLabel,
  defaultCv,
  levelText,
  metaLine,
  recommendationMap,
  useRecommendations,
  useSavedJds,
} from "@/components/student/library/library-data"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { jdFacts, sectionLines } from "@/lib/jd"
import type { CvVersion, JobDescription, RequirementImportance } from "@/lib/types"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

const REQUIREMENT_ROWS: { importance: RequirementImportance; label: string }[] = [
  { importance: "required", label: "Bắt buộc" },
  { importance: "preferred", label: "Ưu tiên" },
  { importance: "additional", label: "Cộng thêm" },
]

/**
 * Chi tiết vị trí (WIREFRAMES A3/B3, bản vẽ ChiTietJd / ChiTietJdCuaBan): cấu trúc chung cho JD thư viện và JD tự dán.
 * Nội dung bên trái, thẻ mức phù hợp dính bên phải (điện thoại: thanh đáy + sheet).
 */
export function JdDetail({ id, initialCvId }: { id: string; initialCvId: string | null }) {
  // Thư viện đang hiển thị và JD sinh viên tự dán (GET /jd)
  const library = useApi(api.listMyJds)
  const [editing, setEditing] = useState(false)
  const cvs = useApi(api.listCvVersions)
  const saved = useSavedJds()
  const [sheetOpen, setSheetOpen] = useState(false)

  const cv = cvs.data ? defaultCv(cvs.data, initialCvId) : null
  const recs = useRecommendations(cv?.id ?? null, false)
  const lookup = useMemo(() => recommendationMap(recs.data?.recommendations), [recs.data])

  if (library.error) {
    return (
      <Panel className="mx-auto mt-10 max-w-xl">
        <EmptyState
          icon={CloudOff}
          title="Không tải được vị trí"
          description={library.error.message}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="dark" size="brand" onClick={library.reload}>
                Thử lại
              </Button>
              <Button variant="soft" size="brand" nativeButton={false} render={<Link href="/student/library" />}>
                Về Thư viện JD
              </Button>
            </div>
          }
        />
      </Panel>
    )
  }
  if (!library.data) return <DetailSkeleton />

  const jd = library.data.find((j) => j.id === id)
  const pasted = jd?.source === "pasted"
  if (!jd) {
    return (
      <Panel className="mx-auto mt-10 max-w-xl">
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy vị trí"
          description="Vị trí này không còn trong thư viện, đã bị xoá hoặc đường dẫn chưa đúng."
          action={
            <Button variant="dark" size="brand" nativeButton={false} render={<Link href="/student/library" />}>
              Về Thư viện JD
            </Button>
          }
        />
      </Panel>
    )
  }

  const hasCv = cvs.data ? cv !== null : cvs.error ? true : undefined
  const match: MatchSummaryProps = {
    match: lookup.get(jd.id),
    hasCv: hasCv !== false,
    loading: hasCv === undefined || recs.loading,
    error: cvs.error ?? recs.error,
    onRetry: cvs.error ? cvs.reload : recs.reload,
  }
  const libraryHref = `/student/library${cv && !cv.is_active ? `?cv=${encodeURIComponent(cv.id)}` : ""}`

  // Điện thoại: nút có chữ "Lưu vị trí" để không thành một biểu tượng đứng riêng một hàng; desktop chỉ còn trái tim.
  const isSaved = saved.savedIds.has(jd.id)
  const save = (
    <button
      type="button"
      aria-pressed={isSaved}
      onClick={() => saved.toggle(jd.id)}
      className="glass inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink shadow-xs transition-[background-color,transform] duration-150 hover:bg-card active:scale-[.96] lg:w-11 lg:px-0"
    >
      <Heart
        className={cn("size-[18px] shrink-0", isSaved ? "fill-current text-bad" : "text-ink-2")}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="lg:sr-only">Lưu vị trí</span>
    </button>
  )

  // Kiểu dashboard Stripe (DESIGN.md 3.6): tiêu đề trang, rồi vùng "Mô tả & yêu cầu" với khối "Mức phù hợp" dính bên phải.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 md:gap-12">
      <PageHeader
        title={jd.title}
        description={
          <>
            {metaLine(jd.company, levelText(jd.level), jd.industry)}
            {pasted && (
              <span className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
                <LockKeyhole className="size-3.5" strokeWidth={1.75} aria-hidden />
                JD bạn tự dán, chỉ bạn thấy
              </span>
            )}
          </>
        }
        actions={
          <>
            {pasted && (
              <Button
                variant="outline"
                size="brand"
                className="border-line-strong bg-card shadow-xs"
                onClick={() => setEditing(true)}
              >
                <PencilLine data-icon="inline-start" aria-hidden />
                Sửa
              </Button>
            )}
            {save}
            <span className="hidden flex-wrap gap-2.5 lg:flex">
              <Button
                variant="ghost"
                size="brand"
                className="glass text-ink shadow-xs hover:bg-card"
                nativeButton={false}
                render={<Link href={`/student/interview/new?jd=${jd.id}`} />}
              >
                Luyện phỏng vấn
              </Button>
              <Button size="brand" nativeButton={false} render={<Link href={`/student/analysis/new?jd=${jd.id}`} />}>
                Phân tích chi tiết
                <ChevronRight aria-hidden />
              </Button>
            </span>
          </>
        }
      />

      <Facts jd={jd} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <JdBody jd={jd} />
        <aside className="sticky top-6 hidden lg:block" aria-labelledby="jd-match-title">
          {/* Cao bằng hàng tiêu đề vùng để hai đường kẻ thẳng hàng. */}
          <div className="border-b border-line pb-3.5">
            <h2 id="jd-match-title" className="pt-2 text-base leading-6 font-semibold text-ink">
              Mức phù hợp với CV của bạn
            </h2>
          </div>
          <div className="grid gap-5 pt-7">
            <MatchSummary {...match} />
            <WidgetFooter
              link={{ label: "Xem gợi ý khác", href: libraryHref }}
              note={cv && <span className="block max-w-[180px] truncate">theo {cvOptionLabel(cv)}</span>}
              className="border-t border-line pt-3.5"
            />
          </div>
        </aside>
      </div>

      <div className="lg:hidden">
        <BottomActionBar className="flex items-center gap-3">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSheetOpen(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm text-ink-2"
          >
            <MatchBarSummary {...match} />
            <ChevronUp className="ml-auto size-4 shrink-0 text-ink-3" aria-hidden />
            <span className="sr-only">Xem mức phù hợp</span>
          </button>
          <Button className="h-11 shrink-0 rounded-full px-5 text-[15px] font-semibold" nativeButton={false} render={<Link href={`/student/analysis/new?jd=${jd.id}`} />}>
            Phân tích
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </BottomActionBar>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[88dvh] gap-4 overflow-y-auto rounded-t-[22px] px-5 pt-2.5 pb-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span className="mx-auto h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden />
            <MatchSheetHeader cv={cv} />
            <MatchSummary {...match} />
            <div className="grid gap-2">
              <ActionButtons jdId={jd.id} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {pasted && (
        <AddJdDialog mode={editing ? { kind: "edit", jd } : null} onOpenChange={setEditing} onSaved={library.reload} />
      )}
    </div>
  )
}

/** Dải thông tin nhanh: địa điểm, hình thức, nơi làm việc, lương, kinh nghiệm, hạn nộp (chỉ các trường có giá trị). */
export function Facts({ jd }: { jd: JobDescription }) {
  const facts = jdFacts(jd)
  if (facts.length === 0) return null
  return (
    <dl
      className="-mt-4 grid gap-x-5 gap-y-4 rounded-card bg-panel px-5 py-4 [grid-template-columns:repeat(auto-fill,minmax(140px,1fr))] md:-mt-6 md:px-[22px]"
      aria-label="Thông tin nhanh"
    >
      {facts.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-ink-3">{f.label}</dt>
          <dd className="mt-0.5 text-[15px] font-medium text-ink">{f.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function MatchSheetHeader({ cv }: { cv: CvVersion | null }) {
  return (
    <div className="grid gap-0.5">
      <SheetTitle className="font-heading text-lg font-bold text-ink">Mức phù hợp với CV của bạn</SheetTitle>
      {cv && <p className="truncate text-[13px] text-ink-3">CV: {cvOptionLabel(cv)}</p>}
    </div>
  )
}

function MatchBarSummary({ match, hasCv, loading, error }: MatchSummaryProps) {
  if (!hasCv) return <span className="truncate">Tải CV để xem mức phù hợp</span>
  if (loading) return <Skeleton className="h-[22px] w-36 rounded-badge" />
  if (error) return <span className="truncate">Chưa tải được mức phù hợp</span>
  if (!match?.item.match_label) return <span className="truncate">Ngoài Top gợi ý cho CV</span>
  const missing = match.item.missing_skills.length
  return (
    <>
      <MatchBadge label={match.item.match_label} className="shrink-0" />
      <span className="truncate">{missing ? `Thiếu ${missing} kỹ năng` : "Đủ kỹ năng chính"}</span>
    </>
  )
}

function ActionButtons({ jdId }: { jdId: string }) {
  return (
    <>
      <Button className="h-11 w-full rounded-full text-[15px] font-semibold" nativeButton={false} render={<Link href={`/student/analysis/new?jd=${jdId}`} />}>
        Phân tích chi tiết
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <Button
        variant="soft"
        className="h-11 w-full rounded-full text-[15px] font-semibold"
        nativeButton={false}
        render={<Link href={`/student/interview/new?jd=${jdId}`} />}
      >
        <MessagesSquare className="size-4" aria-hidden />
        Luyện phỏng vấn
      </Button>
    </>
  )
}

/** Các mục theo cấu trúc chung: Mô tả công việc, Yêu cầu ứng viên (kèm kỹ năng theo mức), Quyền lợi, Cách ứng tuyển. */
export function JdBody({ jd }: { jd: JobDescription }) {
  // Kỹ năng chỉ dò từ điển (chưa phân tích): chưa biết mức nên hiện một hàng
  const graded = jd.skills_source !== "dictionary"
  return (
    <div className="grid max-w-[880px] min-w-0 grid-cols-[minmax(0,1fr)] gap-12">
      <Zone id="jd-desc-title" title="Mô tả công việc">
        <Lines text={jd.description} />
      </Zone>

      <Zone id="jd-req-title" title="Yêu cầu ứng viên">
        <div className="grid gap-5">
          {jd.majors && jd.majors.length > 0 && (
            <p className="text-sm text-ink-2">Chuyên ngành phù hợp: {jd.majors.join(", ")}</p>
          )}
          <Lines text={jd.requirements} />
          {jd.skills.length > 0 && (
            <div className="border-t border-line">
              {graded ? (
                REQUIREMENT_ROWS.map(({ importance, label }) => {
                  const skills = jd.skills.filter((s) => s.importance === importance)
                  if (skills.length === 0) return null
                  return (
                    <div
                      key={importance}
                      className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-line py-3.5 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-4"
                    >
                      <p className="pt-0.5 text-[15px] font-medium text-ink">{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <SkillChip key={s.name} name={s.name} />
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="grid gap-2.5 py-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {jd.skills.map((s) => (
                      <SkillChip key={s.name} name={s.name} />
                    ))}
                  </div>
                  <p className="text-[13px] text-ink-3">Mức Bắt buộc / Ưu tiên / Cộng thêm sẽ có sau lần phân tích đầu tiên.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Zone>

      {jd.benefits && (
        <Zone id="jd-benefits-title" title="Quyền lợi">
          <Lines text={jd.benefits} />
        </Zone>
      )}
      {jd.how_to_apply && (
        <Zone id="jd-apply-title" title="Cách ứng tuyển">
          <Lines text={jd.how_to_apply} />
        </Zone>
      )}
    </div>
  )
}

/** Đoạn văn, gạch đầu dòng và tiêu đề nhỏ ("Ưu tiên:") của một mục. */
function Lines({ text }: { text: string | null | undefined }) {
  const lines = sectionLines(text)
  if (lines.length === 0) return <p className="text-[15px] text-ink-3">Chưa có nội dung.</p>
  const blocks: { kind: "p" | "h" | "ul"; items: string[] }[] = []
  for (const line of lines) {
    const kind = line.heading ? "h" : line.bullet ? "ul" : "p"
    const last = blocks.at(-1)
    if (kind === "ul" && last?.kind === "ul") last.items.push(line.text)
    else blocks.push({ kind, items: [line.text] })
  }
  return (
    <div className="grid gap-2.5 text-[15px] text-ink-2">
      {blocks.map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="grid list-disc gap-1.5 pl-5 marker:text-ink-3">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : b.kind === "h" ? (
          <p key={i} className="pt-1.5 text-sm font-semibold text-ink">
            {b.items[0].replace(/:$/, "")}
          </p>
        ) : (
          <p key={i} className={i === 0 ? "text-ink" : undefined}>
            {b.items[0]}
          </p>
        ),
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-10 md:gap-12" aria-busy="true" aria-label="Đang tải vị trí">
      <div className="grid gap-3 pt-8 pb-2 md:pt-12">
        <Skeleton className="h-9 w-96 max-w-full md:h-11" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-14 lg:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-7">
          <Skeleton className="h-8 w-60" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-full max-w-[720px]" />
          ))}
          <Skeleton className="h-[220px] w-full max-w-[880px] rounded-card" />
        </div>
        <div className="hidden gap-4 lg:grid">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-[220px] rounded-card" />
        </div>
      </div>
    </div>
  )
}
