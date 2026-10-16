"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Info, Loader2, ShieldCheck } from "lucide-react"

import { diffAdded } from "@/components/student/optimizer/text-diff"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import type { Suggestion, SuggestionDecisionRequest, SuggestionKind } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Khớp MAX_EDIT_CHARS ở backend (src/services/cv_optimizer.py). */
const MAX_EDIT_CHARS = 600

/**
 * Câu đề xuất khi SV không có số liệu: bỏ chỗ trống cùng cả vế AI thêm trước nó, tính từ dấu phẩy cuối
 * ("…, đạt [kết quả đo được]", "…, reducing deployment time by [measurable result]").
 */
export function withoutPlaceholder(text: string) {
  return text
    .replace(/(?:,[^,[\]]*)?\s*\[[^\]]{1,40}\]/g, "")
    .replace(/\s+([.,;])/g, "$1")
    .trim()
}

const KIND_LABEL: Record<SuggestionKind, string> = {
  star_quantify: "Định lượng hoá theo STAR",
  ats_keyword: "Dùng đúng từ khoá JD",
  rephrase: "Diễn đạt lại",
}

const DONE: Record<Exclude<Suggestion["status"], "pending">, { text: string; tone: string }> = {
  accepted: { text: "Đã áp dụng đề xuất này.", tone: "bg-good-soft text-good" },
  edited: { text: "Đã lưu bản bạn sửa.", tone: "bg-good-soft text-good" },
  rejected: { text: "Đã bỏ qua gợi ý này. Câu gốc được giữ nguyên.", tone: "bg-surface text-ink-2" },
}

interface SuggestionCardProps {
  suggestion: Suggestion
  /** Vị trí 1-based và tổng số gợi ý, cho tiêu đề "Gợi ý x / n". */
  index: number
  total: number
  /** Tên mục CV chứa dòng được gợi ý, ví dụ "Kinh nghiệm". */
  section?: string
  /** false khi đã "Hoàn tất": chỉ xem, không đổi được quyết định. */
  editable: boolean
  onPrev: () => void
  onNext: () => void
  onDecide: (decision: SuggestionDecisionRequest["decision"], editedText?: string) => Promise<void>
  onProvideContext: (answer: string) => Promise<void>
  /** Ghi chú cuối thẻ: các bước kiểm tra gợi ý đã qua, số câu AI cho là đã rõ. */
  checkedNote?: string
}

// Bản vẽ ToiUu: thẻ gợi ý bên phải. PRD US-SV-03 (AC1 áp dụng, AC2 cần ngữ cảnh, AC3 bỏ qua), mục 6.4.
export function SuggestionCard({
  suggestion: s,
  index,
  total,
  section,
  editable,
  onPrev,
  onNext,
  onDecide,
  onProvideContext,
  checkedNote,
}: SuggestionCardProps) {
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(s.proposed_text)
  const [context, setContext] = useState("")

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const pending = s.status === "pending"
  // Phần AI viết thêm so với câu gốc (không tính chỗ trống chờ điền số): SV tự xác nhận đúng sự thật trước khi áp dụng
  const aiAdded = diffAdded(s.original_text, s.proposed_text).some(
    (part) => part.added && /\p{L}/u.test(part.text.replace(/\[[^\]]*\]/g, "")),
  )
  // AC2: hỏi số liệu thật trước; SV không có số liệu thì chọn bỏ chỗ trống và tự sửa câu
  const askContext = pending && s.needs_context && !editing

  return (
    <section
      id={`sg-${s.id}`}
      aria-labelledby="suggestion-title"
      className="scroll-mt-24 rounded-card border border-line bg-card px-5 py-5 shadow-card sm:px-[22px]"
    >
      <div className="mb-3.5 flex items-center gap-2">
        <h2 id="suggestion-title" className="flex-1 text-base font-semibold text-ink">
          Gợi ý <span className="tabular-nums">{index}</span> / {total}
        </h2>
        {total > 1 && (
          <>
            <RoundButton label="Gợi ý trước" onClick={onPrev}>
              <ChevronLeft className="size-4" aria-hidden />
            </RoundButton>
            <RoundButton label="Gợi ý sau" onClick={onNext}>
              <ChevronRight className="size-4" aria-hidden />
            </RoundButton>
          </>
        )}
      </div>

      <div className="flex animate-in flex-col gap-3 duration-300 fade-in slide-in-from-bottom-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="blue">
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {KIND_LABEL[s.kind]}
          </Badge>
          <span className="text-xs text-ink-3">
            {/* Gợi ý soạn ở Trình tối ưu có thể không gắn với kỹ năng JD nào */}
            {s.skill && <span className="font-medium text-ink-2">{s.skill}</span>}
            {section && `${s.skill ? " · " : ""}${section}`}
          </span>
        </div>
        <Labeled label="Câu gốc">
          <p className="rounded-[10px] bg-panel px-3 py-2.5 text-sm text-ink-2">{s.original_text}</p>
        </Labeled>

        {/* AC2: cần SV bổ sung ngữ cảnh thật trước khi AI gợi ý */}
        {askContext && (
          <>
            <Labeled label="Đề xuất">
              <p className="rounded-[10px] border border-line-strong px-3 py-2.5 text-[15px] leading-6 text-ink">
                <Highlighted prev={s.original_text} next={s.proposed_text} />
              </p>
            </Labeled>
            {s.rationale && <Rationale text={s.rationale} />}
            {aiAdded && <CheckAdded />}
            <Labeled label={s.context_question ?? "Bạn bổ sung thêm thông tin thật cho câu này nhé"} htmlFor={`ctx-${s.id}`}>
              <Textarea
                id={`ctx-${s.id}`}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ví dụ: phỏng vấn 8 người gồm giảng viên và sinh viên, mô hình hoá 5 quy trình…"
                className="min-h-24 rounded-[10px] px-3 py-2.5 text-[15px] leading-6"
                disabled={!editable}
              />
            </Labeled>
            <p className="flex gap-2 rounded-[10px] bg-warn-soft px-2.5 py-2 text-[13px] leading-5 text-warn">
              <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
              AI không tự đặt số liệu. Gợi ý sẽ dựa hoàn toàn vào thông tin bạn cung cấp.
            </p>
            {editable && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                <PillButton tone="dark" disabled={busy || !context.trim()} onClick={() => run(() => onProvideContext(context))}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Gửi để nhận gợi ý
                </PillButton>
                <PillButton
                  tone="soft"
                  disabled={busy}
                  onClick={() => {
                    setDraft(withoutPlaceholder(s.proposed_text))
                    setEditing(true)
                  }}
                >
                  Không có số liệu, bỏ chỗ trống
                </PillButton>
                <PillButton tone="ghost" disabled={busy} onClick={() => run(() => onDecide("reject"))}>
                  Bỏ qua
                </PillButton>
              </div>
            )}
          </>
        )}

        {!askContext && editing && (
          <Labeled label="Bản bạn sửa" htmlFor={`edit-${s.id}`}>
            <Textarea
              id={`edit-${s.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_EDIT_CHARS}
              className="min-h-24 rounded-[10px] border-ink px-3 py-2.5 text-[15px] leading-6"
            />
            <span className="mt-1 block text-right text-xs text-ink-3 tabular-nums">
              {draft.length}/{MAX_EDIT_CHARS}
            </span>
          </Labeled>
        )}

        {!askContext && !editing && (
          <Labeled label={s.status === "edited" ? "Bản bạn sửa" : pending ? "Đề xuất" : "Đề xuất đã xét"}>
            <p
              className={cn(
                "rounded-[10px] border border-line-strong px-3 py-2.5 text-[15px] leading-6 text-ink",
                s.status === "rejected" && "text-ink-3",
              )}
            >
              {s.status === "edited" ? s.final_text : <Highlighted prev={s.original_text} next={s.proposed_text} />}
            </p>
          </Labeled>
        )}
        {!askContext && !editing && pending && s.rationale && <Rationale text={s.rationale} />}
        {!askContext && !editing && pending && aiAdded && <CheckAdded />}

        {pending && !askContext && editable && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {editing ? (
              <>
                <PillButton tone="dark" disabled={busy || !draft.trim()} onClick={() => run(() => onDecide("edit", draft))}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Lưu bản sửa
                </PillButton>
                <PillButton
                  tone="soft"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false)
                    setDraft(s.proposed_text)
                  }}
                >
                  Huỷ
                </PillButton>
              </>
            ) : (
              <>
                <PillButton tone="dark" disabled={busy} onClick={() => run(() => onDecide("accept"))}>
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Áp dụng
                </PillButton>
                <PillButton tone="soft" disabled={busy} onClick={() => setEditing(true)}>
                  Sửa
                </PillButton>
                <PillButton tone="ghost" disabled={busy} onClick={() => run(() => onDecide("reject"))}>
                  Bỏ qua
                </PillButton>
              </>
            )}
          </div>
        )}

        {s.status !== "pending" && (
          <div className={cn("flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm font-medium", DONE[s.status].tone)}>
            <span className="flex-1">{DONE[s.status].text}</span>
            {editable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => onDecide("undo"))}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink disabled:opacity-50"
              >
                {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                Hoàn tác
              </button>
            )}
          </div>
        )}
      </div>
      {checkedNote && (
        <p className="mt-4 flex gap-2 border-t border-line pt-3.5 text-[12.5px] leading-[18px] text-ink-3">
          <ShieldCheck className="mt-px size-[15px] shrink-0" strokeWidth={1.75} aria-hidden />
          {checkedNote}
        </p>
      )}
    </section>
  )
}

function CheckAdded() {
  return (
    <p className="flex gap-2 text-[12.5px] leading-[18px] text-ink-3">
      <Info className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      Phần tô màu là phần AI viết thêm so với câu gốc. Chỉ áp dụng khi đúng với việc bạn đã làm; chưa đúng thì bấm Sửa
      hoặc Bỏ qua.
    </p>
  )
}

function Rationale({ text }: { text: string }) {
  return (
    <p className="text-[13px] leading-5 text-ink-2">
      <span className="font-semibold text-ink">Vì sao: </span>
      {text}
    </p>
  )
}

/** Câu đề xuất: phần thêm mới so với câu gốc tô nhẹ màu nhấn, chỗ trống cần điền số liệu tô màu cảnh báo. */
function Highlighted({ prev, next }: { prev: string; next: string }) {
  return (
    <>
      {diffAdded(prev, next).flatMap((part, i) =>
        part.text.split(/(\[[^\]]{1,40}\])/).map((piece, j) =>
          !piece ? null : /^\[[^\]]{1,40}\]$/.test(piece) ? (
            <mark key={`${i}-${j}`} className="rounded bg-warn-soft px-1 font-semibold text-warn">
              {piece}
            </mark>
          ) : part.added ? (
            <mark key={`${i}-${j}`} className="rounded bg-accent-soft px-0.5 text-ink">
              {piece}
            </mark>
          ) : (
            <span key={`${i}-${j}`}>{piece}</span>
          ),
        ),
      )}
    </>
  )
}

function Labeled({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  const Tag = htmlFor ? "label" : "div"
  return (
    <div>
      <Tag htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink-3">
        {label}
      </Tag>
      {children}
    </div>
  )
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full bg-surface text-ink-2 transition-colors hover:bg-line hover:text-ink active:scale-95"
    >
      {children}
    </button>
  )
}

const PILL_TONE = {
  dark: "bg-ink px-5 text-on-ink hover:bg-ink/85",
  soft: "bg-surface px-[18px] text-ink hover:bg-line",
  ghost: "px-3.5 text-ink-2 hover:bg-surface hover:text-ink",
}

function PillButton({
  tone,
  className,
  ...props
}: React.ComponentProps<"button"> & { tone: keyof typeof PILL_TONE }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full text-sm font-semibold transition-[transform,background-color] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        PILL_TONE[tone],
        className,
      )}
      {...props}
    />
  )
}
