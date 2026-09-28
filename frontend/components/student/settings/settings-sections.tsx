"use client"

import { useId, useState, type FormEvent, type ReactNode } from "react"
import {
  BadgeCheck,
  Bell,
  CircleAlert,
  CircleX,
  CloudUpload,
  Download,
  Check,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  FolderOpen,
  FolderDown,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { Panel } from "@/components/common/panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api, ApiError } from "@/lib/api"
import { features } from "@/lib/features"
import { formatBytes, formatDate, formatRelativeTime, formatTime } from "@/lib/format"
import { isStrongPassword, PASSWORD_RULES } from "@/lib/password"
import type { CvVersion, StudentSettings } from "@/lib/types"
import { cn } from "@/lib/utils"

// ---------- Khung chung ----------

export const SETTINGS_SECTIONS = [
  { id: "data", label: "Dữ liệu CV & Phỏng vấn", icon: FileText },
  { id: "privacy", label: "Quyền riêng tư & Liêm chính", icon: ShieldCheck },
  { id: "notifications", label: "Thông báo & Lời nhắc", icon: Bell },
  { id: "account", label: "Tài khoản & Bảo mật", icon: UserRound },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[]

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"]

function SectionHeader({
  icon: Icon,
  title,
  description,
  aside,
  iconClass = "text-blue",
}: {
  icon: LucideIcon
  title: string
  description: string
  aside?: ReactNode
  iconClass?: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-1">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <Icon className={cn("size-5", iconClass)} aria-hidden />
          {title}
        </h2>
        <p className="text-sm text-ink-2">{description}</p>
      </div>
      {aside}
    </div>
  )
}

/** Nút thao tác dữ liệu: khi cờ dataActions tắt thì chỉ hiển thị, kèm nhãn "Sắp có". */
function SoonBadge() {
  return (
    <Badge variant="neutral" className="h-auto px-2 py-0.5">
      Sắp có
    </Badge>
  )
}

// ---------- Cột trái: mục lục, dung lượng, AI có trách nhiệm ----------

export function SettingsNav({ active, onSelect }: { active: SettingsSectionId; onSelect: (id: SettingsSectionId) => void }) {
  return (
    <nav aria-label="Mục cài đặt" className="rounded-[20px] border border-line bg-card p-2 shadow-card">
      <ul className="grid gap-1">
        {SETTINGS_SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = s.id === active
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onSelect(s.id)
                }}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive ? "bg-blue-soft text-blue" : "text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-blue" aria-hidden />}
                <Icon className="size-[18px] shrink-0" aria-hidden />
                {s.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function StorageCard({ storage }: { storage: StudentSettings["storage"] }) {
  const percent = Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100))
  return (
    <Panel className="grid gap-3 p-5">
      <p className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <CloudUpload className="size-4 text-blue" aria-hidden />
          Dung lượng lưu trữ
        </span>
        <span className="text-blue">{percent}%</span>
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Dung lượng đã dùng"
      >
        <div className="h-full rounded-full bg-blue" style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <p className="text-xs text-ink-2">
        Đã dùng {formatBytes(storage.used_bytes)} / {formatBytes(storage.limit_bytes)}
      </p>
      <p className="text-xs text-ink-3">Dung lượng do {storage.allocated_by} cấp.</p>
    </Panel>
  )
}

export function ResponsibleAiCard() {
  return (
    <div className="grid gap-2 rounded-[20px] bg-violet-soft/60 p-5 text-sm">
      <p className="flex items-center gap-2 font-heading font-bold text-violet">
        <Sparkles className="size-4" aria-hidden />
        AI có trách nhiệm
      </p>
      <p className="leading-6 text-ink">
        CV và câu trả lời phỏng vấn của bạn chỉ dùng để tạo phân tích cho chính bạn. Dữ liệu định danh không được dùng
        để huấn luyện mô hình bên ngoài phạm vi nhà trường.
      </p>
    </div>
  )
}

// ---------- Dữ liệu CV ----------

function cvTag(cv: CvVersion) {
  if (cv.is_active) return <Badge variant="blue">CV đang dùng</Badge>
  if (cv.is_draft) return <Badge variant="violet">Bản nháp</Badge>
  return <Badge variant="neutral">Bản lưu {cv.label}</Badge>
}

function downloadCv(cv: CvVersion) {
  const url = api.cvDownloadUrl(cv.id)
  if (url) window.open(url, "_blank", "noopener")
  else toast.info(`Bản demo chưa có file thật để tải: ${cv.file_name}`)
}

interface CvFilesCardProps {
  cvs: CvVersion[]
  onDelete: (cv: CvVersion) => Promise<void>
}

export function CvFilesCard({ cvs, onDelete }: CvFilesCardProps) {
  const [deleting, setDeleting] = useState<CvVersion | null>(null)
  const [exporting, setExporting] = useState(false)

  async function exportAll() {
    setExporting(true)
    try {
      const { download_url } = await api.requestDataExport()
      if (download_url) window.open(download_url, "_blank", "noopener")
      else toast.success("Đã tạo gói dữ liệu. Bản demo không có file thật để tải.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tạo được gói dữ liệu.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Panel className="grid gap-5">
      <SectionHeader
        icon={FolderOpen}
        title="Quản lý tệp CV đã tải lên"
        description="Các tệp dùng để phân tích độ khớp với JD và tạo câu hỏi phỏng vấn STAR."
        aside={
          <Badge variant="blue" className="h-auto px-2.5 py-1">
            {cvs.length} tệp
          </Badge>
        }
      />

      {cvs.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-2">Bạn chưa tải lên CV nào.</p>
      ) : (
        <ul className="grid gap-3">
          {cvs.map((cv) => (
            <li key={cv.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-4">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl text-[10px] font-bold uppercase",
                  cv.is_active ? "bg-blue-soft text-blue" : "bg-card text-ink-2",
                )}
                aria-hidden
              >
                {cv.file_type}
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-heading font-bold text-ink">{cv.file_name}</span>
                  {cvTag(cv)}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
                  <span>{formatBytes(cv.size_bytes)}</span>
                  <span aria-hidden>•</span>
                  <span>Tải lên {formatDate(cv.uploaded_at)}</span>
                  <span aria-hidden>•</span>
                  {cv.ats_score !== null ? (
                    <span className="flex items-center gap-1 font-medium text-good">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      ATS {cv.ats_score}/100
                    </span>
                  ) : (
                    <span>Chưa phân tích</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" className="h-9 bg-card" onClick={() => downloadCv(cv)}>
                  <Download aria-hidden />
                  Tải về
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-ink-2 hover:bg-bad-soft hover:text-bad"
                  aria-label={`Xoá ${cv.file_name}`}
                  onClick={() => setDeleting(cv)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-blue-soft/30 p-4">
        <div className="flex items-start gap-3">
          <FolderDown className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden />
          <div className="grid gap-0.5">
            <p className="flex items-center gap-2 font-heading text-sm font-bold">
              Quyền sở hữu dữ liệu
              {!features.dataActions && <SoonBadge />}
            </p>
            <p className="text-xs text-ink-2">Tải về toàn bộ lịch sử phân tích, báo cáo phỏng vấn và các phiên bản CV.</p>
          </div>
        </div>
        <Button variant="outline" className="h-10 bg-card" disabled={!features.dataActions || exporting} onClick={exportAll}>
          <Download aria-hidden />
          Tải xuống toàn bộ dữ liệu cá nhân
        </Button>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Xoá ${deleting?.file_name ?? "CV"}?`}
        description="Tệp CV sẽ bị xoá vĩnh viễn. Các báo cáo phân tích đã tạo từ tệp này vẫn được giữ trong lịch sử."
        confirmLabel="Xoá tệp"
        destructive
        onConfirm={() => (deleting ? onDelete(deleting) : Promise.resolve())}
      />
    </Panel>
  )
}

// ---------- Đồng ý xử lý dữ liệu & liêm chính ----------

const CONSENT_TERMS = [
  "Hệ thống dùng CV, JD và câu trả lời phỏng vấn của bạn để phân tích khoảng trống kỹ năng và gợi ý cách diễn đạt.",
  "AI chỉ gợi ý dựa trên kinh nghiệm có thật do bạn cung cấp, không tự thêm kỹ năng hay thành tích bạn chưa có.",
  "Bạn tự kiểm tra và chịu trách nhiệm về tính trung thực của nội dung CV cuối cùng.",
  "Điểm số và nhận xét chỉ mang tính tham khảo, không đảm bảo kết quả tuyển dụng.",
  "Cố vấn chỉ xem được tài liệu bạn bật chia sẻ; bạn có thể thu hồi quyền bất cứ lúc nào.",
]

export function ConsentCard({
  consentAt,
  onWithdraw,
}: {
  consentAt: string | null
  onWithdraw: () => Promise<void>
}) {
  const [viewing, setViewing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  return (
    <Panel className="grid gap-5">
      <SectionHeader
        icon={ShieldCheck}
        iconClass="text-good"
        title="Đồng ý xử lý dữ liệu & Cam kết liêm chính học thuật"
        description="Nguyên tắc bảo vệ hồ sơ sinh viên và cam kết trung thực của ứng viên."
      />
      {consentAt ? (
        <div className="grid gap-2 rounded-2xl bg-good-soft/70 p-5 text-sm">
          <p className="flex items-center gap-2 font-heading font-bold text-good">
            <BadgeCheck className="size-5" aria-hidden />
            Bạn đã đồng ý điều khoản xử lý dữ liệu & cam kết liêm chính học thuật
          </p>
          <p className="text-xs text-ink-2">
            Xác nhận lúc {formatTime(consentAt)} ngày {formatDate(consentAt)}, khi khởi tạo hồ sơ lần đầu.
          </p>
          <p className="leading-6 font-medium text-ink">
            Nguyên tắc cốt lõi: AI chỉ phân tích khoảng trống kỹ năng và gợi ý cách diễn đạt dựa trên{" "}
            <span className="underline underline-offset-2">kinh nghiệm có thật</span> do bạn cung cấp. Bạn chịu trách
            nhiệm về tính trung thực của hồ sơ trước nhà tuyển dụng và nhà trường.
          </p>
        </div>
      ) : (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-warn-soft/70 p-5 text-sm text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          Bạn đã rút lại sự đồng ý. Các chức năng phân tích CV và phỏng vấn thử tạm khoá cho tới khi bạn đồng ý lại.
        </p>
      )}
      <div className="grid gap-3">
        {consentAt && (
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <CircleAlert className="size-3.5 text-bad" aria-hidden />
            Rút lại sự đồng ý sẽ khoá ngay các chức năng phân tích bằng AI.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="soft" className="h-10" onClick={() => setViewing(true)}>
            <Eye aria-hidden />
            Xem lại văn bản cam kết
          </Button>
          {consentAt && (
            <Button
              variant="ghost"
              className="h-10 bg-bad-soft text-bad hover:bg-bad-soft/80 hover:text-bad"
              disabled={!features.dataActions}
              onClick={() => setWithdrawing(true)}
            >
              <CircleX aria-hidden />
              Rút lại sự đồng ý
            </Button>
          )}
          {consentAt && !features.dataActions && <SoonBadge />}
        </div>
      </div>

      <Dialog open={viewing} onOpenChange={setViewing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Điều khoản xử lý dữ liệu & Cam kết liêm chính</DialogTitle>
            <DialogDescription>Nội dung bạn đã đồng ý khi bắt đầu sử dụng CareerX.</DialogDescription>
          </DialogHeader>
          <ol className="grid list-decimal gap-2 pl-5 text-sm leading-6 text-ink">
            {CONSENT_TERMS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <DialogFooter>
            <Button variant="soft" onClick={() => setViewing(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Rút lại sự đồng ý xử lý dữ liệu?"
        description="Các chức năng phân tích CV, tối ưu CV và phỏng vấn thử sẽ bị khoá ngay. Dữ liệu hiện có vẫn được giữ cho tới khi bạn yêu cầu xoá."
        confirmLabel="Rút lại sự đồng ý"
        destructive
        onConfirm={onWithdraw}
      />
    </Panel>
  )
}

// ---------- Nhóm công tắc ----------

interface ToggleRowProps {
  id: string
  title: string
  tag?: string
  description: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ id, title, tag, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <li className="flex items-start justify-between gap-6 rounded-2xl bg-surface p-5">
      <div className="grid gap-1">
        <label htmlFor={id} className="flex flex-wrap items-center gap-2 font-heading font-bold text-ink">
          {title}
          {tag && <Badge variant="neutral">{tag}</Badge>}
        </label>
        <p className="text-sm leading-6 text-ink-2">{description}</p>
      </div>
      <Switch id={id} size="lg" checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-1" />
    </li>
  )
}

type SettingsPatch = { privacy?: Partial<StudentSettings["privacy"]>; notifications?: Partial<StudentSettings["notifications"]> }

export function PrivacyCard({
  settings,
  advisorName,
  onChange,
}: {
  settings: StudentSettings
  advisorName: string | null
  onChange: (patch: SettingsPatch) => void
}) {
  return (
    <Panel className="grid gap-5">
      <SectionHeader
        icon={SlidersHorizontal}
        iconClass="text-violet"
        title="Tuỳ chọn quyền riêng tư & chia sẻ"
        description="Chủ động quyết định ai được xem dữ liệu hướng nghiệp của bạn."
      />
      <ul className="grid gap-3">
        <ToggleRow
          id="advisor-access"
          title="Cho phép cố vấn xem các tài liệu đang bật chia sẻ"
          tag="Học thuật"
          description={
            <>
              {advisorName ? `Người phụ trách: ${advisorName}. ` : ""}Khi tắt, cố vấn không xem được tài liệu nào, kể cả tài
              liệu đang bật ở mục Chia sẻ với Cố vấn.
            </>
          }
          checked={settings.privacy.advisor_access}
          onChange={(v) => onChange({ privacy: { advisor_access: v } })}
        />
        <ToggleRow
          id="anonymous-contribution"
          title="Đóng góp dữ liệu ẩn danh để cải thiện gợi ý"
          tag="Cộng đồng"
          description="Họ tên, email, số điện thoại và địa chỉ được loại bỏ trước khi dữ liệu được dùng để thống kê chất lượng gợi ý."
          checked={settings.privacy.anonymous_contribution}
          onChange={(v) => onChange({ privacy: { anonymous_contribution: v } })}
        />
      </ul>
    </Panel>
  )
}

export function NotificationsCard({
  settings,
  onChange,
}: {
  settings: StudentSettings
  onChange: (patch: SettingsPatch) => void
}) {
  const n = settings.notifications
  return (
    <Panel className="grid gap-5">
      <SectionHeader icon={Bell} title="Thông báo & Lời nhắc" description="Chọn những gì bạn muốn được báo qua chuông thông báo." />
      <ul className="grid gap-3">
        <ToggleRow
          id="notify-advisor"
          title="Khi cố vấn để lại nhận xét mới"
          description="Báo ngay khi cố vấn nhận xét CV hoặc báo cáo phỏng vấn bạn đã chia sẻ."
          checked={n.advisor_comment}
          onChange={(v) => onChange({ notifications: { advisor_comment: v } })}
        />
        <ToggleRow
          id="notify-report"
          title="Khi báo cáo phân tích hoặc phỏng vấn sẵn sàng"
          description="Hữu ích khi bạn rời trang trong lúc hệ thống đang chấm điểm."
          checked={n.report_ready}
          onChange={(v) => onChange({ notifications: { report_ready: v } })}
        />
        <ToggleRow
          id="notify-weekly"
          title="Nhắc luyện tập hằng tuần"
          description="Nhắc bạn khi chưa luyện phỏng vấn trong 7 ngày và còn lượt trong tuần."
          checked={n.weekly_reminder}
          onChange={(v) => onChange({ notifications: { weekly_reminder: v } })}
        />
        <ToggleRow
          id="notify-email"
          title="Gửi thêm qua email"
          description={`Gửi bản sao các thông báo đang bật tới ${settings.email}.`}
          checked={n.email}
          onChange={(v) => onChange({ notifications: { email: v } })}
        />
      </ul>
    </Panel>
  )
}

// ---------- Đổi mật khẩu ----------

interface PasswordFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "current-password" | "new-password"
  error?: string | null
  describedBy?: string
}

function PasswordField({ label, value, onChange, autoComplete, error, describedBy }: PasswordFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [visible, setVisible] = useState(false)
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? errorId : null, describedBy].filter(Boolean).join(" ") || undefined}
          className="h-10 bg-surface pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-card hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  )
}

type PasswordFieldName = "current" | "next" | "confirm"

export function PasswordCard({
  updatedAt,
  onChanged,
}: {
  updatedAt: string | null
  onChanged: (updatedAt: string) => void
}) {
  const rulesId = useId()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<{ field: PasswordFieldName; message: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const errors: Record<PasswordFieldName, string | null> = {
    current: !current ? "Hãy nhập mật khẩu hiện tại." : null,
    next: !isStrongPassword(next)
      ? "Mật khẩu mới chưa đạt các điều kiện bên cạnh."
      : next === current
        ? "Mật khẩu mới phải khác mật khẩu hiện tại."
        : null,
    confirm: confirm !== next ? "Mật khẩu nhập lại không khớp." : null,
  }
  const valid = !errors.current && !errors.next && !errors.confirm

  // Lỗi hiển thị sau lần bấm cập nhật đầu tiên; riêng ô nhập lại báo ngay khi đã gõ.
  const fieldError = (field: PasswordFieldName) =>
    (serverError?.field === field ? serverError.message : null) ??
    (submitted || (field === "confirm" && confirm.length > 0) ? errors[field] : null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (!valid) return
    setSaving(true)
    try {
      const res = await api.changePassword({ current_password: current, new_password: next })
      onChanged(res.password_updated_at)
      setCurrent("")
      setNext("")
      setConfirm("")
      setSubmitted(false)
      toast.success("Đã đổi mật khẩu.")
    } catch (err) {
      if (err instanceof ApiError && err.code === "wrong_password") setServerError({ field: "current", message: err.message })
      else if (err instanceof ApiError && err.code === "same_password") setServerError({ field: "next", message: err.message })
      else toast.error(err instanceof Error ? err.message : "Không đổi được mật khẩu.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="grid gap-5">
      <SectionHeader
        icon={KeyRound}
        title="Đổi mật khẩu"
        description={
          updatedAt
            ? `Lần đổi gần nhất: ${formatRelativeTime(updatedAt).toLowerCase()} (${formatDate(updatedAt)}).`
            : "Bạn chưa đổi mật khẩu kể từ khi tạo tài khoản."
        }
      />
      <form onSubmit={submit} noValidate className="grid gap-4 md:grid-cols-2 md:gap-x-6">
        <div className="grid content-start gap-4">
          <PasswordField
            label="Mật khẩu hiện tại"
            value={current}
            onChange={(v) => {
              setCurrent(v)
              if (serverError?.field === "current") setServerError(null)
            }}
            autoComplete="current-password"
            error={fieldError("current")}
          />
          <PasswordField
            label="Mật khẩu mới"
            value={next}
            onChange={(v) => {
              setNext(v)
              if (serverError?.field === "next") setServerError(null)
            }}
            autoComplete="new-password"
            error={fieldError("next")}
            describedBy={rulesId}
          />
          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={fieldError("confirm")}
          />
        </div>
        <div className="grid content-between gap-4">
          <div id={rulesId} className="grid gap-2 rounded-2xl bg-surface p-4">
            <p className="text-sm font-medium text-ink">Mật khẩu mới cần có</p>
            <ul className="grid gap-1.5 text-sm">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(next)
                return (
                  <li key={rule.label} className={cn("flex items-center gap-2", ok ? "text-good" : "text-ink-2")}>
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded-full",
                        ok ? "bg-good text-white" : "border border-line bg-card",
                      )}
                      aria-hidden
                    >
                      {ok && <Check className="size-3" />}
                    </span>
                    {rule.label}
                    <span className="sr-only">{ok ? "(đã đạt)" : "(chưa đạt)"}</span>
                  </li>
                )
              })}
            </ul>
            <p className="pt-1 text-xs text-ink-3">Sau khi đổi, các thiết bị khác cần đăng nhập lại bằng mật khẩu mới.</p>
          </div>
          <Button type="submit" className="h-10 justify-self-start px-5" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            {saving ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
          </Button>
        </div>
      </form>
    </Panel>
  )
}

// ---------- Tài khoản & vùng nguy hiểm ----------

export function AccountCard({
  fullName,
  settings,
  onDeleteAll,
}: {
  fullName: string
  settings: StudentSettings
  onDeleteAll: () => Promise<void>
}) {
  const [confirm, setConfirm] = useState(false)
  const rows: { label: string; value: string }[] = [
    { label: "Họ và tên", value: fullName },
    { label: "Mã sinh viên", value: settings.student_code },
    { label: "Khoa", value: settings.faculty },
    { label: "Email", value: settings.email },
  ]
  return (
    <>
      <Panel className="grid gap-5">
        <SectionHeader icon={UserRound} title="Tài khoản" description="Thông tin dùng để cố vấn và nhà trường nhận diện bạn." />
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="grid gap-0.5 rounded-2xl bg-surface px-4 py-3">
              <dt className="text-xs text-ink-2">{r.label}</dt>
              <dd className="font-medium wrap-anywhere text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-2">Cần sửa thông tin tài khoản? Hãy liên hệ cố vấn hoặc phòng quản lý đào tạo của trường.</p>
      </Panel>

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-[20px] border border-line border-l-4 border-l-bad bg-card p-6 shadow-card">
        <div className="grid max-w-xl gap-1.5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-bad">
            <TriangleAlert className="size-5" aria-hidden />
            Vùng nguy hiểm
            {!features.dataActions && <SoonBadge />}
          </h2>
          <p className="text-sm text-ink-2">
            Xoá vĩnh viễn toàn bộ phiên bản CV, lịch sử phỏng vấn STAR, điểm số và nhận xét của cố vấn.{" "}
            <span className="font-medium text-bad">Không thể hoàn tác sau khi xác nhận.</span>
          </p>
        </div>
        <Button variant="destructive" size="brand" disabled={!features.dataActions} onClick={() => setConfirm(true)}>
          <Trash2 aria-hidden />
          Xoá toàn bộ dữ liệu của tôi
        </Button>
      </section>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Xoá toàn bộ dữ liệu?"
        description="Mọi CV, báo cáo phân tích, báo cáo phỏng vấn và nhận xét của cố vấn sẽ bị xoá vĩnh viễn. Hãy tải về bản sao trước nếu bạn cần lưu lại."
        confirmLabel="Xoá vĩnh viễn"
        destructive
        onConfirm={onDeleteAll}
      />
    </>
  )
}
