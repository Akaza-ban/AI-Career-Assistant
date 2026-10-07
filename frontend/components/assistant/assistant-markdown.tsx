'use client';

import { createElement, type ReactNode } from "react"
import Link from "next/link"

import { resolveAssistantRoute } from "@/lib/assistant-navigation"
import type { UserRole } from "@/types/assistant"

function inlineMarkdown(text: string, role: UserRole): ReactNode[] {
  // Render React nodes directly, so Markdown can never inject HTML or scripts.
  const tokens = /\\([\\`*{}\[\]()#+.!_>~-])|(`+)([^`]+)\2|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+)\*|_([^_\n]+)_|~~(.+?)~~|\[([^\]]+)\]\(([^\s)]+)\)/g
  const nodes: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(tokens)) {
    const index = match.index
    if (index > cursor) nodes.push(text.slice(cursor, index))
    const key = `${index}-${nodes.length}`
    if (match[1]) nodes.push(match[1])
    else if (match[3]) nodes.push(<code key={key}>{match[3]}</code>)
    else if (match[4] || match[5]) nodes.push(<strong key={key}>{inlineMarkdown(match[4] ?? match[5], role)}</strong>)
    else if (match[6] || match[7]) nodes.push(<em key={key}>{inlineMarkdown(match[6] ?? match[7], role)}</em>)
    else if (match[8]) nodes.push(<del key={key}>{inlineMarkdown(match[8], role)}</del>)
    else {
      const label = inlineMarkdown(match[9], role)
      const href = match[10]
      const route = resolveAssistantRoute(href, role)
      if (route) nodes.push(<Link key={key} href={route}>{label}</Link>)
      else if (/^https?:\/\//i.test(href)) nodes.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)
      else nodes.push(<span key={key}>{label}</span>)
    }
    cursor = index + match[0].length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

const LIST_ITEM = /^(\s*)([-+*]|\d+[.)])\s+(.+)$/
const FENCE = /^\s{0,3}(`{3,}|~{3,})(.*)$/
const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*$/
const RULE = /^\s{0,3}(?:\*\s*){3,}$|^\s{0,3}(?:-\s*){3,}$|^\s{0,3}(?:_\s*){3,}$/

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || LIST_ITEM.test(line) || /^\s{0,3}>/.test(line)
}

function blockMarkdown(lines: string[], role: UserRole): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const key = `block-${index}`
    if (!line.trim()) { index++; continue }

    const fence = line.match(FENCE)
    if (fence) {
      const code: string[] = []
      const closing = new RegExp(`^\\s{0,3}${fence[1][0]}{${fence[1].length},}\\s*$`)
      index++
      while (index < lines.length && !closing.test(lines[index])) code.push(lines[index++])
      if (index < lines.length) index++
      const language = fence[2].trim().split(/\s/)[0]
      nodes.push(<pre key={key}><code className={/^[\w+-]+$/.test(language) ? `language-${language}` : undefined}>{code.join("\n")}</code></pre>)
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      nodes.push(createElement(`h${heading[1].length}`, { key }, inlineMarkdown(heading[2], role)))
      index++
      continue
    }
    if (RULE.test(line)) { nodes.push(<hr key={key} />); index++; continue }

    if (/^\s{0,3}>/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) quote.push(lines[index++].replace(/^\s{0,3}> ?/, ""))
      nodes.push(<blockquote key={key}>{blockMarkdown(quote, role)}</blockquote>)
      continue
    }

    const firstItem = line.match(LIST_ITEM)
    if (firstItem) {
      const ordered = /^\d/.test(firstItem[2])
      const indent = firstItem[1].length
      const items: ReactNode[] = []
      while (index < lines.length) {
        const item = lines[index].match(LIST_ITEM)
        if (!item || item[1].length !== indent || /^\d/.test(item[2]) !== ordered) break
        const itemKey = `item-${index}`
        const contentIndent = item[0].length - item[3].length
        const content = [item[3]]
        index++
        while (index < lines.length) {
          const next = lines[index]
          if (next.trim() && next.length - next.trimStart().length > indent) {
            content.push(next.slice(Math.min(contentIndent, next.length - next.trimStart().length)))
            index++
          } else if (!next.trim() && index + 1 < lines.length && /^\s+\S/.test(lines[index + 1])) {
            content.push("")
            index++
          } else break
        }
        items.push(<li key={itemKey}>{blockMarkdown(content, role)}</li>)
      }
      nodes.push(ordered ? <ol key={key} start={Number.parseInt(firstItem[2], 10)}>{items}</ol> : <ul key={key}>{items}</ul>)
      continue
    }

    const paragraph = [line]
    index++
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) paragraph.push(lines[index++])
    nodes.push(<p key={key}>{inlineMarkdown(paragraph.join("\n"), role)}</p>)
  }
  return nodes
}

/** Supports the assistant's text Markdown: emphasis, lists, code, headings, quotes and links. */
export function AssistantMarkdown({ content, userRole }: { content: string; userRole: UserRole }) {
  return <div className="assistant-markdown">{blockMarkdown(content.replace(/\r\n?/g, "\n").split("\n"), userRole)}</div>
}
