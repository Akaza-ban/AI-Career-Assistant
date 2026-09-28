"use client"

import { useState, type Ref } from "react"
import { Lightbulb, Loader2, Lock, NotebookPen, Pencil, Pin, PinOff, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Panel, PanelHeader } from "@/components/common/panel"
import { UserAvatar } from "@/components/shell/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { formatDate, formatTime, formatWhen } from "@/lib/format"
import type { AdvisorNote, AdvisorNoteTag } from "@/lib/types"
import { cn } from "@/lib/utils"

export const NOTE_TAGS: { value: AdvisorNoteTag; label: string; className: string }[] = [
  { value: "behavior", label: "Hành vi", className: "bg-warn-soft text-warn" },
  { value: "soft_skill", label: "Kỹ năng mềm", className: "bg-good-soft text-good" },
  { value: "technical", label: "Kỹ thuật", className: "bg-blue-soft text-blue" },
  { value: "watch", label: "Theo dõi đặc biệt", className: "bg-bad-soft text-bad" },
]
const tagMeta = (tag: AdvisorNoteTag) => NOTE_TAGS.find((t) => t.value === tag)!

function TagPicker({ value, onChange }: { value: AdvisorNoteTag[]; onChange: (tags: AdvisorNoteTag[]) => void }) {
  return (
    <div role="group" aria-label="Gắn thẻ" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Gắn thẻ:</span>
      {NOTE_TAGS.map((t) => {
        const on = value.includes(t.value)
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== t.value) : [...value, t.value])}
            className={cn(
              "rounded-lg px-2.5 py-1 text-sm font-medium transition-colors",
              on ? t.className : "bg-surface text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
          </button>
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
  /** Để nút "Thêm ghi chú riêng" ở đầu trang focus vào ô nhập. */
  inputRef?: Ref<HTMLTextAreaElement>
}

// Figma: frame "Hồ sơ sinh viên - Ghi chú & CV" (18:6676).
export function ProfileNotesTab({ studentId, studentName, notes, suggestions, onNotesChange, inputRef }: ProfileNotesTabProps) {
  const [body, setBody] = useState("")
  const [tags, setTags] = useState<AdvisorNoteTag[]>([])
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<AdvisorNoteTag | "all">("all")
  const [deleting, setDeleting] = useState<AdvisorNote | null>(null)

  const sorted = [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const visible = filter === "all" ? sorted : sorted.filter((n) => n.tags.includes(filter))

  async function create() {
    if (!body.trim()) return
    setSaving(true)
    try {
      const note = await api.createAdvisorNote(studentId, { body, tags })
      onNotesChange([note, ...notes])
      setBody("")
      setTags([])
      toast.success("Đã lưu ghi chú nội bộ.")
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid min-w-0 gap-6">
        <p className="flex items-start gap-3 rounded-[20px] bg-blue-soft/50 p-4 text-sm text-ink">
          <Lock className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
          <span>
            <strong className="font-heading">Không gian riêng của cố vấn.</strong> Chỉ bạn thấy các ghi chú này. Sinh viên và
            các bên khác không bao giờ xem được.
          </span>
        </p>

        <Panel className="grid gap-4">
          <PanelHeader icon={NotebookPen} title="Thêm ghi chú mới" />
          <Textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Quan sát, nhận xét thái độ, điểm cần rèn thêm cho ${studentName}…`}
            aria-label="Nội dung ghi chú"
            className="min-h-28 bg-surface"
          />
          <TagPicker value={tags} onChange={setTags} />
          <Button className="h-10 justify-self-start px-4" onClick={create} disabled={saving || !body.trim()}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Lưu ghi chú
          </Button>
        </Panel>

        <section className="grid gap-3" aria-labelledby="notes-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="notes-heading" className="flex items-center gap-2 font-heading text-lg font-bold">
              Nhật ký theo dõi
              <Badge variant="neutral" className="h-auto px-2 py-0.5">
                {notes.length} mục
              </Badge>
            </h2>
            <div role="group" aria-label="Lọc theo thẻ" className="flex flex-wrap gap-1">
              {[{ value: "all" as const, label: "Tất cả" }, ...NOTE_TAGS].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={filter === t.value}
                  onClick={() => setFilter(t.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    filter === t.value ? "bg-blue text-on-blue" : "bg-card text-ink-2 ring-1 ring-line hover:bg-blue-soft",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <Panel className="py-10 text-center text-sm text-ink-2">
              {notes.length === 0 ? "Chưa có ghi chú nào cho sinh viên này." : "Không có ghi chú nào với thẻ này."}
            </Panel>
          ) : (
            <ul className="grid gap-3">
              {visible.map((note) => (
                <li key={note.id}>
                  <NoteCard note={note} onUpdate={(patch) => update(note, patch)} onDelete={() => setDeleting(note)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Panel className="grid gap-3 bg-blue-soft/40 shadow-none">
        <PanelHeader icon={Lightbulb} title="Gợi ý cho buổi tư vấn tiếp theo" />
        <p className="-mt-1 text-xs text-ink-2">AI tổng hợp từ báo cáo sinh viên đã chia sẻ. Bạn quyết định có dùng hay không.</p>
        <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-ink">
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Panel>

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

function NoteCard({
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
    <Panel className={cn("grid gap-3 p-5", note.pinned && "ring-1 ring-blue/25")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar name={note.author_name} src={null} className="size-9" />
          <div className="grid">
            <p className="font-heading text-sm font-bold text-ink">{note.author_name}</p>
            <p className="text-xs text-ink-2">
              {formatWhen(note.created_at)}
              {!formatWhen(note.created_at).startsWith("Hôm nay") && ` · ${formatDate(note.created_at)} ${formatTime(note.created_at)}`}
              {note.pinned && " · Đã ghim"}
              {edited && " · Đã sửa"}
            </p>
          </div>
        </div>
        {!editing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={note.pinned ? "Bỏ ghim" : "Ghim ghi chú"}
              onClick={() => void onUpdate({ pinned: !note.pinned })}
            >
              {note.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sửa ghi chú"
              onClick={() => {
                setDraft(note.body)
                setDraftTags(note.tags)
                setEditing(true)
              }}
            >
              <Pencil aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Xoá ghi chú" className="hover:bg-bad-soft hover:text-bad" onClick={onDelete}>
              <Trash2 aria-hidden />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="grid gap-3">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Sửa nội dung ghi chú" className="min-h-24 bg-surface" />
          <TagPicker value={draftTags} onChange={setDraftTags} />
          <div className="flex gap-2">
            <Button className="h-9" onClick={save} disabled={saving || !draft.trim()}>
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              Lưu thay đổi
            </Button>
            <Button variant="soft" className="h-9" onClick={() => setEditing(false)} disabled={saving}>
              Huỷ
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-6 whitespace-pre-line text-ink">{note.body}</p>
          {note.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {note.tags.map((t) => (
                <li key={t} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", tagMeta(t).className)}>
                  # {tagMeta(t).label}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  )
}
