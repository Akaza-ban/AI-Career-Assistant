"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { AlertCircle, FilePlus2, SearchX, Upload } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/common/panel"
import {
  CvCard,
  CvDropzone,
  CvTipCard,
  CvToolbar,
  UploadStatusBanner,
  type CvSort,
} from "@/components/student/cv/cv-sections"
import { CV_ACCEPT, useCvUpload } from "@/components/student/cv/use-cv-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { CvVersion } from "@/lib/types"
import { useApi } from "@/lib/use-api"

function sortCvs(list: CvVersion[], sort: CvSort): CvVersion[] {
  const copy = [...list]
  if (sort === "ats") return copy.sort((a, b) => (b.ats_score ?? -1) - (a.ats_score ?? -1))
  if (sort === "name") return copy.sort((a, b) => a.file_name.localeCompare(b.file_name, "vi"))
  return copy.sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
}

// Figma: frame "CV của tôi" (18:1835). US-SV-01.
export function MyCv() {
  const { data, error, reload } = useApi(api.listCvVersions)
  const inputRef = useRef<HTMLInputElement>(null)
  const { state: uploadState, upload, dismiss } = useCvUpload(() => reload())
  const uploading = uploadState.status === "uploading"

  const [query, setQuery] = useState("")
  const [target, setTarget] = useState("all")
  const [sort, setSort] = useState<CvSort>("recent")

  const cvs = useMemo(() => data ?? [], [data])
  const targets = useMemo(
    () => [...new Set(cvs.map((cv) => cv.target_title).filter((t): t is string => Boolean(t)))],
    [cvs],
  )
  const scored = cvs.filter((cv) => cv.ats_score !== null)
  const averageAts = scored.length
    ? Math.round(scored.reduce((sum, cv) => sum + (cv.ats_score ?? 0), 0) / scored.length)
    : null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = cvs.filter(
      (cv) =>
        (target === "all" || cv.target_title === target) &&
        (!q || cv.file_name.toLowerCase().includes(q) || cv.target_title?.toLowerCase().includes(q)),
    )
    return sortCvs(filtered, sort)
  }, [cvs, query, target, sort])

  async function handleSetActive(cv: CvVersion) {
    try {
      await api.setActiveCv(cv.id)
      toast.success(`Đã đặt ${cv.label} làm phiên bản đang dùng`)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không đổi được phiên bản đang dùng.")
    }
  }

  const openPicker = () => inputRef.current?.click()
  const hasCvs = cvs.length > 0

  return (
    <div className="grid gap-6">
      <input
        ref={inputRef}
        type="file"
        accept={CV_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
          e.target.value = ""
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 md:flex-nowrap">
        <div className="grid max-w-2xl min-w-0 flex-1 gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-[28px] leading-9 font-bold">CV của tôi</h1>
            {data && (
              <Badge variant="neutral" className="h-auto bg-blue-soft px-2.5 py-0.5 font-medium">
                {cvs.length} hồ sơ
              </Badge>
            )}
          </div>
          <p className="text-sm text-ink-2">
            Quản lý các phiên bản CV theo từng vị trí mục tiêu và theo dõi mức độ tối ưu cho hệ thống lọc hồ sơ ATS với
            sự trợ giúp của AI.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasCvs && (
            <Button variant="soft" className="h-10 px-4" nativeButton={false} render={<Link href="/student/analysis/new" />}>
              <FilePlus2 aria-hidden />
              Tạo phiên bản mới
            </Button>
          )}
          <Button className="h-10 px-4 shadow-md" onClick={openPicker} disabled={uploading}>
            <Upload aria-hidden />
            Tải CV lên
          </Button>
        </div>
      </div>

      <UploadStatusBanner state={uploadState} onDismiss={dismiss} />

      {error ? (
        <Panel className="grid justify-items-center gap-3 py-12 text-center">
          <AlertCircle className="size-8 text-bad" aria-hidden />
          <p className="font-heading font-bold">Không tải được danh sách CV</p>
          <p className="text-sm text-ink-2">{error.message}</p>
          <Button variant="soft" onClick={reload}>
            Thử lại
          </Button>
        </Panel>
      ) : !data ? (
        <div className="grid gap-6" aria-busy="true" aria-label="Đang tải danh sách CV">
          <Skeleton className="h-[52px] rounded-[20px]" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[470px] rounded-[20px]" />
            ))}
          </div>
        </div>
      ) : hasCvs ? (
        <>
          <CvToolbar
            query={query}
            onQueryChange={setQuery}
            target={target}
            onTargetChange={setTarget}
            targets={targets}
            sort={sort}
            onSortChange={setSort}
            total={cvs.length}
            averageAts={averageAts}
          />
          {visible.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((cv, index) => (
                <CvCard key={cv.id} cv={cv} index={index} onSetActive={handleSetActive} />
              ))}
            </div>
          ) : (
            <Panel className="grid justify-items-center gap-2 py-10 text-center">
              <SearchX className="size-6 text-ink-3" aria-hidden />
              <p className="text-sm font-medium">Không có CV nào khớp bộ lọc</p>
              <Button
                variant="link"
                onClick={() => {
                  setQuery("")
                  setTarget("all")
                }}
              >
                Xoá bộ lọc
              </Button>
            </Panel>
          )}
          <CvDropzone onFile={(f) => void upload(f)} onBrowse={openPicker} disabled={uploading} />
        </>
      ) : (
        <CvDropzone onFile={(f) => void upload(f)} onBrowse={openPicker} disabled={uploading} prominent />
      )}

      <CvTipCard />
    </div>
  )
}
