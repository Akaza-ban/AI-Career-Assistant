"use client"

import { useState, type Ref } from "react"
import { Loader2, Pin, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { ChoiceChip, dayMonth } from "@/components/advisor/profile/profile-bits"
import { SuggestionList } from "@/components/advisor/progress-blocks"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Zone } from "@/components/common/zone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { AdvisorNote, AdvisorNoteTag } from "@/lib/types"
import { cn } from "@/lib/utils"

export const NOTE_TAGS: { value: AdvisorNoteTag; label: string; className: string }[] = [
  { value: "behavior", label: "Hành vi", className: "bg-warn-soft text-warn" },
  { value: "soft_skill", label: "Kỹ năng mềm", className: "bg-good-soft text-good" },
  { value: "technical", label: "Kỹ thuật", className: "bg-blue-soft text-blue" },
  { value: "watch", label: "Theo dõi đặc biệt", className: "bg-bad-soft text-bad" },
]
const tagMeta = (tag: AdvisorNoteTag) => NOTE_TAGS.find((t) => t.value === tag)!

const INPUT =
  "block w-full rounded-[10px] border border-line-strong bg-card px-3.5 py-3 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-3 focus-visible:border-ink-3 focus-visible:ring-3 focus-visible:ring-ring/40"

function TagPicker({ value, onChange }: { value: AdvisorNoteTag[]; onChange: (tags: AdvisorNoteTag[]) => void }) {
  return (
    <div role="group" aria-label="Gắn thẻ" className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-ink-3">Gắn thẻ</span>
      {NOTE_TAGS.map((t) => {
        const on = value.includes(t.value)
        return (
          <ChoiceChip
            key={t.value}
            on={on}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== t.value) : [...value, t.value])}
          >
            {t.label}
          </ChoiceChip>
        )
      })}
    </div>
  )
}

interface ProfileNotesTabProps {
  studentId: string
  studentName: string
  notes: AdvisorNote[]
  suggestions: string[]
  onNotesChange: (notes: AdvisorNote[]) => void
  /** Để nút "Thêm ghi chú" ở đầu trang focus vào ô nhập. */
  inputRef?: Ref<HTMLTextAreaElement>
}

// Bản vẽ HoSoSinhVien, tab Ghi chú. Ghi chú nội bộ: chỉ cố vấn viết ra mới thấy.
export function ProfileNotesTab({ studentId, studentName, notes, suggestions, onNotesChange, inputRef }: ProfileNotesTabProps) {
  const [body, setBody] = useState("")
  const [tags, setTags] = useState<AdvisorNoteTag[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AdvisorNote | null>(null)

  const sorted = [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  async function create() {
    if (!body.trim()) return
    setSaving(true)
    try {
      const note = await api.createAdvisorNote(studentId, { body, tags })
      onNotesChange([note, ...notes])
      setBody("")
      setTags([])
      toast.success("Đã lưu ghi chú.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được ghi chú.")
    } finally {
      setSaving(false)
    }
  }

  async function update(note: AdvisorNote, patch: { body?: string; tags?: AdvisorNoteTag[]; pinned?: boolean }) {
    try {
      const updated = await api.updateAdvisorNote(studentId, note.id, patch)
      onNotesChange(notes.map((n) => (n.id === note.id ? updated : n)))
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không cập nhật được ghi chú.")
      return false
    }
  }

  async function remove(note: AdvisorNote) {
    try {
      await api.deleteAdvisorNote(studentId, note.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xoá được ghi chú.")
      throw err
    }
    onNotesChange(notes.filter((n) => n.id !== note.id))
    toast.success("Đã xoá ghi chú.")
  }

  return (
    <div className="grid items-start gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Zone id="notes-heading" title="Ghi chú của bạn" aside={<span className="text-[13px] text-ink-3">Chỉ cố vấn xem được</span>}>
        <div className="-mt-2.5">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Thêm ghi chú về ${studentName}…`}
            aria-label="Nội dung ghi chú"
            className={cn(INPUT, "min-h-24 resize-y")}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-3">
            <TagPicker value={tags} onChange={setTags} />
            <Button
              className="ml-auto h-8 rounded-full px-3.5 text-[13px] font-semibold"
              onClick={create}
              disabled={saving || !body.trim()}
            >
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Lưu ghi chú
            </Button>
          </div>
          {sorted.length === 0 ? (
            <p className="mt-2 border-b border-line py-6 text-sm text-ink-3">Chưa có ghi chú nào cho sinh viên này.</p>
          ) : (
            <ul className="mt-3">
              {sorted.map((note) => (
                <NoteRow key={note.id} note={note} onUpdate={(patch) => update(note, patch)} onDelete={() => setDeleting(note)} />
              ))}
            </ul>
          )}
        </div>
      </Zone>

      <Zone id="advice-heading" title="Gợi ý cho buổi tư vấn tới">
        <div className="-mt-5">
          <SuggestionList items={suggestions} />
          <p className="mt-3 flex items-start gap-1.5 text-[13px] leading-5 text-ink-3">
            <Sparkles className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Hệ thống tổng hợp từ báo cáo và CV mà sinh viên chia sẻ.
          </p>
        </div>
      </Zone>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xoá ghi chú này?"
        description="Ghi chú sẽ bị xoá vĩnh viễn khỏi hồ sơ theo dõi của sinh viên."
        confirmLabel="Xoá ghi chú"
        destructive
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve())}
      />
    </div>
  )
}

const LINK_BUTTON = "text-[13px] text-ink-3 transition-colors hover:text-ink"

function NoteRow({
  note,
  onUpdate,
  onDelete,
}: {
  note: AdvisorNote
  onUpdate: (patch: { body?: string; tags?: AdvisorNoteTag[]; pinned?: boolean }) => Promise<boolean>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const [draftTags, setDraftTags] = useState(note.tags)
  const [saving, setSaving] = useState(false)
  const edited = note.updated_at !== note.created_at

  async function save() {
    setSaving(true)
    if (await onUpdate({ body: draft, tags: draftTags })) setEditing(false)
    setSaving(false)
  }

  return (
    <li className="border-b border-line py-4">
      <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[13px] text-ink-3 tabular-nums">
          {dayMonth(note.created_at)}
          {edited && " · đã sửa"}
        </span>
        {note.pinned && (
          <span className="flex items-center gap-1 text-[13px] font-medium text-ink-2">
            <Pin className="size-3.5" strokeWidth={1.75} aria-hidden />
            Đã ghim
          </span>
        )}
        {!editing &&
          note.tags.map((t) => (
            <Badge key={t} variant="neutral" className="h-[22px] px-2">
              {tagMeta(t).label}
            </Badge>
          ))}
        {!editing && (
          <span className="ml-auto flex items-center gap-3">
            <button type="button" className={LINK_BUTTON} onClick={() => void onUpdate({ pinned: !note.pinned })}>
              {note.pinned ? "Bỏ ghim" : "Ghim"}
            </button>
            <button
              type="button"
              className={LINK_BUTTON}
              onClick={() => {
                setDraft(note.body)
                setDraftTags(note.tags)
                setEditing(true)
              }}
            >
              Sửa
            </button>
            <button type="button" className={cn(LINK_BUTTON, "hover:text-bad")} onClick={onDelete}>
              Xoá
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-2 grid gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Sửa nội dung ghi chú"
            className={cn(INPUT, "min-h-24 resize-y")}
          />
          <TagPicker value={draftTags} onChange={setDraftTags} />
          <div className="flex gap-2">
            <Button className="h-8 rounded-full px-3.5 text-[13px] font-semibold" onClick={save} disabled={saving || !draft.trim()}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Lưu thay đổi
            </Button>
            <Button
              variant="ghost"
              className="h-8 rounded-full bg-card px-3.5 text-[13px] font-semibold text-ink ring-1 ring-line-strong ring-inset hover:bg-panel"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Huỷ
            </Button>
          </div>
        </div>
      ) : (
        <p className="leading-6 whitespace-pre-line text-ink">{note.body}</p>
      )}
    </li>
  )
}
