"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/common/empty-state"
import { PageHeader } from "@/components/common/page-header"
import { Panel } from "@/components/common/panel"
import { useProfile } from "@/components/shell/profile-context"
import {
  AccountSection,
  DataSection,
  NotificationsSection,
  PrivacySection,
  SETTINGS_SECTIONS,
  SettingsNav,
  type SettingsSectionId,
} from "@/components/student/settings/settings-sections"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { StudentSettings, UpdateSettingsRequest } from "@/lib/types"
import { useApi } from "@/lib/use-api"

// Bản vẽ CaiDat. Quản lý tệp CV nằm ở trang CV của tôi.
export function StudentSettingsPage() {
  const profile = useProfile()
  const settingsQuery = useApi(api.getSettings)
  const sharingQuery = useApi(api.getSharing)
  // Bản sau lần cập nhật gần nhất; null = dùng dữ liệu vừa tải.
  const [updatedSettings, setSettings] = useState<StudentSettings | null>(null)
  const [active, setActive] = useState<SettingsSectionId>("account")

  const settings = updatedSettings ?? settingsQuery.data
  const ready = settings !== undefined

  // Bấm mục lục thì giữ mục đã chọn trong lúc trang cuộn mượt tới đó.
  const lockUntil = useRef(0)

  // Đánh dấu mục đang xem khi cuộn: mục cuối cùng có đầu mục đã qua vạch 35% màn hình; cuộn chạm đáy trang thì
  // chọn mục cuối, vì mục ngắn ở cuối trang không bao giờ lên tới vạch. Mở /student/settings#privacy thì cuộn tới mục đó.
  useEffect(() => {
    if (!ready) return
    const hash = window.location.hash.slice(1)
    if (SETTINGS_SECTIONS.some((s) => s.id === hash)) document.getElementById(hash)?.scrollIntoView()

    function update() {
      if (Date.now() < lockUntil.current) return
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) {
        setActive(SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id)
        return
      }
      const line = window.innerHeight * 0.35
      let current: SettingsSectionId = SETTINGS_SECTIONS[0].id
      for (const section of SETTINGS_SECTIONS) {
        const el = document.getElementById(section.id)
        if (el && el.getBoundingClientRect().top <= line) current = section.id
      }
      setActive(current)
    }

    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [ready])

  function select(id: SettingsSectionId) {
    setActive(id)
    lockUntil.current = Date.now() + 900
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    history.replaceState(null, "", `#${id}`)
  }

  // Công tắc lưu ngay khi bật/tắt.
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
      toast.success("Đã lưu")
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
      <Panel className="mx-auto mt-10 w-full max-w-lg p-0">
        <EmptyState
          icon={AlertCircle}
          title="Không tải được cài đặt"
          description={settingsQuery.error.message}
          action={
            <Button size="brand" onClick={settingsQuery.reload}>
              Thử lại
            </Button>
          }
        />
      </Panel>
    )
  }

  return (
    <div className="grid gap-9 md:gap-11">
      <PageHeader title="Cài đặt" />

      {!ready ? (
        <SettingsSkeleton />
      ) : (
        <div className="flex items-start gap-16">
          {/* Điện thoại: ẩn mục lục, các mục xếp nối tiếp nhau. */}
          <aside className="sticky top-24 hidden w-[200px] shrink-0 lg:block">
            <SettingsNav active={active} onSelect={select} />
          </aside>
          <div className="flex max-w-[960px] min-w-0 flex-1 flex-col gap-14 md:gap-16">
            <AccountSection
              fullName={profile?.full_name ?? ""}
              settings={settings}
              onPasswordChanged={(at) => setSettings({ ...settings, password_updated_at: at })}
            />
            <PrivacySection
              settings={settings}
              advisorName={sharingQuery.data?.advisor?.full_name ?? null}
              onChange={patch}
              onWithdraw={withdrawConsent}
            />
            <NotificationsSection settings={settings} onChange={patch} />
            <DataSection storage={settings.storage} onDeleteAll={deleteAll} />
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="flex gap-16" aria-busy="true" aria-label="Đang tải cài đặt">
      <div className="hidden w-[200px] shrink-0 gap-2 lg:grid">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
      <div className="grid min-w-0 flex-1 gap-4">
        <Skeleton className="h-8 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-[10px]" />
        ))}
      </div>
    </div>
  )
}
