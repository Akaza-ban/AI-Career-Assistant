"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import {
  AccountCard,
  ConsentCard,
  NotificationsCard,
  PasswordCard,
  PersonalDataCard,
  PrivacyCard,
  SETTINGS_SECTIONS,
  SettingsNav,
  type SettingsSectionId,
} from "@/components/student/settings/settings-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { StudentSettings, UpdateSettingsRequest } from "@/lib/types"
import { useApi } from "@/lib/use-api"

const sectionClass = "grid scroll-mt-24 gap-8"

// Figma: frame "Cài đặt & Quyền riêng tư" (18:7888). Quản lý tệp CV nằm ở trang CV của tôi.
export function StudentSettingsPage() {
  const profile = useProfile()
  const settingsQuery = useApi(api.getSettings)
  const sharingQuery = useApi(api.getSharing)
  // Bản sau lần cập nhật gần nhất; null = dùng dữ liệu vừa tải.
  const [updatedSettings, setSettings] = useState<StudentSettings | null>(null)
  const [active, setActive] = useState<SettingsSectionId>("account")

  const settings = updatedSettings ?? settingsQuery.data
  const ready = settings !== undefined

  // Đánh dấu mục đang xem khi cuộn; mở /student/settings#privacy thì cuộn tới mục đó.
  useEffect(() => {
    if (!ready) return
    const hash = window.location.hash.slice(1)
    if (SETTINGS_SECTIONS.some((s) => s.id === hash)) document.getElementById(hash)?.scrollIntoView()
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id as SettingsSectionId)
      },
      { rootMargin: "-96px 0px -55% 0px" },
    )
    for (const s of SETTINGS_SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ready])

  function select(id: SettingsSectionId) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    history.replaceState(null, "", `#${id}`)
  }

  async function patch(body: UpdateSettingsRequest) {
    if (!settings) return
    const previous = settings
    setSettings({
      ...settings,
      privacy: { ...settings.privacy, ...body.privacy },
      notifications: { ...settings.notifications, ...body.notifications },
    })
    try {
      setSettings(await api.updateSettings(body))
      toast.success("Đã lưu thay đổi.")
    } catch (err) {
      setSettings(previous)
      toast.error(err instanceof Error ? err.message : "Không lưu được thay đổi.")
    }
  }

  async function withdrawConsent() {
    try {
      setSettings(await api.withdrawConsent())
      toast.success("Đã rút lại sự đồng ý xử lý dữ liệu.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không rút lại được sự đồng ý.")
      throw err
    }
  }

  async function deleteAll() {
    try {
      await api.deleteAllData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xoá được dữ liệu.")
      throw err
    }
    setSettings(await api.getSettings())
    toast.success("Đã xoá toàn bộ dữ liệu của bạn.")
  }

  if (settingsQuery.error) {
    return (
      <Panel className="grid justify-items-center gap-3 py-12 text-center">
        <AlertCircle className="size-8 text-bad" aria-hidden />
        <p className="font-heading font-bold">Không tải được cài đặt</p>
        <p className="text-sm text-ink-2">{settingsQuery.error.message}</p>
        <Button variant="soft" onClick={settingsQuery.reload}>
          Thử lại
        </Button>
      </Panel>
    )
  }

  return (
    <div className="grid gap-8">
      <header className="grid gap-2 py-2">
        <h1 className="font-heading text-[32px] leading-10 font-bold">Cài đặt & Quyền riêng tư</h1>
        <p className="text-sm text-ink-2">Quản lý tài khoản, quyền riêng tư và các tuỳ chọn thông báo của bạn.</p>
      </header>

      {!ready ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24">
            <SettingsNav active={active} onSelect={select} />
          </aside>

          <div className="grid min-w-0 gap-8">
            <section id="account" aria-label="Tài khoản & Bảo mật" className={sectionClass}>
              <AccountCard fullName={profile?.full_name ?? ""} settings={settings} />
              <PasswordCard
                updatedAt={settings.password_updated_at}
                onChanged={(at) => setSettings({ ...settings, password_updated_at: at })}
              />
            </section>
            <section id="privacy" aria-label="Quyền riêng tư & Liêm chính" className={sectionClass}>
              <ConsentCard consentAt={settings.consent_accepted_at} onWithdraw={withdrawConsent} />
              <PrivacyCard
                settings={settings}
                advisorName={sharingQuery.data?.advisor?.full_name ?? null}
                onChange={patch}
              />
            </section>
            <section id="notifications" aria-label="Thông báo & Lời nhắc" className={sectionClass}>
              <NotificationsCard settings={settings} onChange={patch} />
            </section>
            <section id="data" aria-label="Dữ liệu cá nhân" className={sectionClass}>
              <PersonalDataCard storage={settings.storage} onDeleteAll={deleteAll} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]" aria-busy="true" aria-label="Đang tải cài đặt">
      <Skeleton className="h-60 rounded-[20px]" />
      <div className="grid gap-8">
        <Skeleton className="h-[220px] rounded-[20px]" />
        <Skeleton className="h-[360px] rounded-[20px]" />
      </div>
    </div>
  )
}
