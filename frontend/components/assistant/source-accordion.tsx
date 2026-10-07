'use client';

import Link from "next/link"
import { BookOpen, ChevronDown, ArrowUpRight } from "lucide-react"

import { resolveAssistantRoute } from "@/lib/assistant-navigation"
import type { SourceCitation, UserRole } from "@/types/assistant"

export function SourceAccordion({ sources, userRole }: { sources: SourceCitation[]; userRole: UserRole }) {
  if (!sources.length) return null

  return (
    <details className="group mt-3 rounded-xl border border-line bg-surface/60 text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
        <BookOpen className="size-3.5 text-blue" aria-hidden />
        Nguồn tham khảo ({sources.length})
        <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="space-y-3 border-t border-line px-3 py-3">
        {sources.map((source, index) => {
          const route = resolveAssistantRoute(source.route, userRole)
          return (
            <li key={source.chunk_id ?? `${source.title}-${index}`} className="space-y-1">
              {route ? (
                <Link href={route} className="inline-flex items-start gap-1 font-medium text-blue hover:underline">
                  {source.title}<ArrowUpRight className="mt-0.5 size-3 shrink-0" aria-hidden />
                </Link>
              ) : <p className="font-medium text-ink">{source.title}</p>}
              {source.section && <p className="text-ink-3">{source.section}</p>}
              {source.snippet && <p className="leading-relaxed text-ink-2">{source.snippet}</p>}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
