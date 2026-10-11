"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

import styles from "./landing.module.css"

/** Theo dõi phần tử vào khung nhìn; `once` = giữ trạng thái đã hiện sau lần đầu. */
export function useInView<T extends Element>(options: { once?: boolean; threshold?: number; rootMargin?: string } = {}) {
  const { once = true, threshold = 0.2, rootMargin = "0px 0px -8% 0px" } = options
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    // Mọi trình duyệt đang hỗ trợ đều có IntersectionObserver.
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold, rootMargin])
  return [ref, inView] as const
}

/** Khối mờ dần, nhích lên và phóng nhẹ khi cuộn tới (kiểu Stripe, 700ms). */
export function Reveal({ className, delay = 0, children }: { className?: string; /** ms, để các khối cạnh nhau hiện lệch nhau */ delay?: number; children: ReactNode }) {
  const [ref, shown] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} data-shown={shown} className={cn(styles.reveal, className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  )
}
