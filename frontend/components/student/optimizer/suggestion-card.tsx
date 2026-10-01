"use client"

import { useState } from "react"
import { Check, CircleCheck, KeyRound, Loader2, MessageSquareQuote, Pencil, Sparkles, Undo2, Wand2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Suggestion, SuggestionDecisionRequest, SuggestionKind } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Khớp MAX_EDIT_CHARS ở backend (src/services/cv_optimizer.py). */
const MAX_EDIT_CHARS = 600

const KIND: Record<SuggestionKind, { label: string; icon: typeof Sparkles; accent: string }> = {
  star_quantify: { label: "Gợi ý định lượng hoá STAR", icon: Sparkles, accent: "border-t-violet" },
  ats_keyword: { label: "Dùng đúng từ khoá JD", icon: KeyRound, accent: "border-t-blue" },
  rephrase: { label: "Gợi ý diễn đạt lại", icon: Wand2, accent: "border-t-blue" },
}

interface SuggestionCardProps {
  suggestion: Suggestion
  /** false khi đã "Hoàn tất": chỉ xem, không đổi được quyết định. */
  editable: boolean
  onDecide: (decision: SuggestionDecisionRequest["decision"], editedText?: string) => Promise<void>
  onProvideContext: (answer: string) => Promise<void>
}

// Figma: các thẻ bên phải "Trình tối ưu CV". PRD US-SV-03 (AC1 áp dụng, AC2 cần ngữ cảnh, AC3 bỏ qua), mục 6.4.
export function SuggestionCard({ suggestion: s, editable, onDecide, onProvideContext }: SuggestionCardProps) {
  const kind = KIND[s.kind]
  const KindIcon = kind.icon
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

  const applied = s.status === "accepted" || s.status === "edited"
  const rejected = s.status === "rejected"
  const pending = s.status === "pending"

  return (
    <article
      id={`sg-${s.id}`}
      className={cn(
        "grid scroll-mt-24 gap-3 rounded-[20px] border border-t-4 border-line bg-card p-4 shadow-card",
        kind.accent,
        rejected && "opacity-75",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <Badge variant={s.kind === "star_quantify" ? "violet" : "blue"} className="h-auto px-2 py-0.5">
          <KindIcon aria-hidden />
          {kind.label}
        </Badge>
        {s.status === "accepted" && (
          <span className="flex items-center gap-1 text-xs font-medium text-good">
            <CircleCheck className="size-3.5" aria-hidden />
            Đã áp dụng
          </span>
        )}
        {s.status === "edited" && (
          <span className="flex items-center gap-1 text-xs font-medium text-good">
            <Pencil className="size-3.5" aria-hidden />
            Đã sửa tay
          </span>
        )}
        {rejected && <span className="text-xs font-medium text-ink-3">Đã bỏ qua</span>}
      </header>

      <div className="grid gap-1">
        <h3 className="font-heading text-sm font-bold text-ink">{s.skill}</h3>
        {pending && s.rationale && <p className="text-[13px] leading-5 text-ink-2">{s.rationale}</p>}
        <p className="text-xs text-ink-3">Căn cứ: dòng {s.evidence_span.line_start} trong CV gốc</p>
      </div>

      {/* AC2: cần SV bổ sung ngữ cảnh trước khi AI gợi ý */}
      {pending && s.needs_context && (
        <div className="grid gap-2 rounded-xl bg-violet-soft/60 p-3">
          <p className="flex items-start gap-2 text-[13px] font-medium text-ink">
            <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-violet" aria-hidden />
            {s.context_question}
          </p>
          <Textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ví dụ: phỏng vấn 8 người gồm giảng viên và sinh viên, mô hình hoá 5 quy trình…"
            aria-label="Ngữ cảnh bổ sung"
            className="min-h-20 bg-card text-sm"
            disabled={!editable}
          />
          <p className="text-xs text-ink-2">AI không tự đặt số liệu. Gợi ý sẽ dựa hoàn toàn vào thông tin bạn cung cấp.</p>
          <Button
            size="sm"
            variant="violet"
            className="justify-self-start"
            disabled={!editable || busy || !context.trim()}
            onClick={() => run(() => onProvideContext(context))}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Gửi ngữ cảnh để nhận gợi ý
          </Button>
        </div>
      )}

      {pending && !s.needs_context && (
        <>
          <div className="grid gap-1.5 rounded-xl bg-surface p-3 text-[13px] leading-5">
            <p>
              <span className="font-semibold text-bad">Cũ: </span>
              <span className="text-ink-2">{s.original_text}</span>
            </p>
            {editing ? (
              <div className="grid gap-1">
                <span className="font-semibold text-good">Mới (bạn sửa):</span>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={MAX_EDIT_CHARS}
                  aria-label="Nội dung chỉnh sửa"
                  className="min-h-24 bg-card text-sm"
                />
                <span className="justify-self-end text-[11px] text-ink-3">
                  {draft.length}/{MAX_EDIT_CHARS}
                </span>
              </div>
            ) : (
              <p>
                <span className="font-semibold text-good">Mới: </span>
                <span className="text-ink">{s.proposed_text}</span>
              </p>
            )}
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button size="sm" disabled={busy || !draft.trim()} onClick={() => run(() => onDecide("edit", draft))}>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                    Lưu bản chỉnh sửa
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setEditing(false)
                      setDraft(s.proposed_text)
                    }}
                  >
                    <Undo2 aria-hidden />
                    Huỷ
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" disabled={busy} onClick={() => run(() => onDecide("accept"))}>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                    Chấp nhận gợi ý
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-blue-soft"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    <Pencil aria-hidden />
                    Chỉnh sửa
                  </Button>
                  <Button size="sm" variant="ghost" className="text-ink-2" disabled={busy} onClick={() => run(() => onDecide("reject"))}>
                    Bỏ qua
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {applied && (
        <p className="rounded-xl bg-good-soft/60 p-3 text-[13px] leading-5 text-ink">
          <span className="font-semibold text-good">{s.status === "edited" ? "Bản bạn sửa: " : "Đã áp dụng: "}</span>
          {s.final_text}
        </p>
      )}
      {rejected && (
        <p className="rounded-xl bg-surface p-3 text-[13px] leading-5 text-ink-2">
          Giữ nguyên câu gốc: <span className="text-ink">{s.original_text}</span>
        </p>
      )}
      {(applied || rejected) && editable && (
        <Button
          size="sm"
          variant="ghost"
          className="justify-self-start text-ink-2"
          disabled={busy}
          onClick={() => run(() => onDecide("undo"))}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          Hoàn tác
        </Button>
      )}
    </article>
  )
}
