"use client"

import { useCallback, useEffect, useState } from "react"

interface ApiState<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  /** Tải lại dữ liệu (ví dụ sau khi đánh dấu đã đọc). */
  reload: () => void
}

/**
 * Gọi một hàm trong lib/api.ts phía client và theo dõi trạng thái tải.
 * `fetcher` phải ổn định giữa các lần render (hàm module hoặc bọc trong useCallback).
 */
export function useApi<T>(fetcher: () => Promise<T>): ApiState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    fetcher().then(
      (value) => {
        if (!active) return
        setData(value)
        setError(undefined)
      },
      (err: unknown) => {
        if (active) setError(err instanceof Error ? err : new Error(String(err)))
      },
    )
    return () => {
      active = false
    }
  }, [fetcher, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { data, error, loading: data === undefined && error === undefined, reload }
}
