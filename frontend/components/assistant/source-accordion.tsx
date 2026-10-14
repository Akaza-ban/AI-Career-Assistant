'use client';

import Link from "next/link"
import { ArrowUpRight, BookOpen, ChevronDown } from "lucide-react"

import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"
import { getBreadcrumb, shellOf } from "@/components/shell/nav-config"
import { resolveAssistantRoute } from "@/lib/assistant-navigation"
import { sourcePageTitle } from "@/lib/assistant-response"
import type { SourceCitation, UserRole } from "@/types/assistant"

/** Tên trang của nguồn theo thanh điều hướng (vd. "Phân tích CV & JD"); không có thì dùng tiêu đề tài liệu. */
function pageName(source: SourceCitation, role: UserRole): { name: string; route: string | null } {
  const route = resolveAssistantRoute(source.route, role)
  const name = route ? getBreadcrumb(shellOf(role), route).at(-1)?.label : undefined
  return { name: name ?? sourcePageTitle(source.title), route }
}

/** Dòng "Theo hướng dẫn: …" dưới câu trả lời; mở ra để xem đoạn trích và đi tới trang đó. */
export function SourceAccordion({ sources, userRole }: { sources: SourceCitation[]; userRole: UserRole }) {
  if (!sources.length) return null
  const pages = [...new Set(sources.map((s) => pageName(s, userRole).name))]
  const summary = pages.length > 1 ? `${pages[0]} và ${pages.length - 1} trang khác` : pages[0]

  return (
    <details className="group rounded-xl bg-panel text-[13px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-ink-2 hover:bg-surface [&::-webkit-details-marker]:hidden">
        <BookOpen className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          Theo hướng dẫn: <b className="font-semibold text-ink">{summary}</b>
        </span>
        <ChevronDown className="size-[15px] shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="grid gap-3 px-3 pt-1 pb-3 pl-[34px]">
        {sources.map((source, index) => {
          const { name, route } = pageName(source, userRole)
          return (
            <li key={source.chunk_id ?? `${source.title}-${index}`} className="grid gap-1 leading-5 text-ink-2">
              {source.section && <p className="font-medium text-ink">{source.section.split(" > ").at(-1)}</p>}
              {source.snippet && <AssistantMarkdown content={source.snippet} userRole={userRole} />}
              {route && (
                <Link href={route} className="inline-flex items-center gap-1 justify-self-start font-semibold text-blue hover:underline">
                  Mở {name}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
