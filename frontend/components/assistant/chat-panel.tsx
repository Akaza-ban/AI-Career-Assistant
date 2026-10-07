'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { AlertCircle, Bot, LoaderCircle, Minus, SendHorizontal, Sparkles, Trash2, X } from "lucide-react"

import { ActionBadges } from "@/components/assistant/action-badges"
import { AssistantMarkdown } from "@/components/assistant/assistant-markdown"
import { useAssistant } from "@/components/assistant/assistant-provider"
import { SourceAccordion } from "@/components/assistant/source-accordion"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith("/advisor")) return ["Cách theo dõi tiến bộ sinh viên?", "Mở danh sách sinh viên"]
  if (pathname.startsWith("/student/analysis")) return ["Match score tính thế nào?", "Nút phân tích ở đâu?"]
  if (pathname.startsWith("/student/interview")) return ["Cách trả lời theo chuẩn STAR?", "Xem lịch sử các phiên"]
  if (pathname.startsWith("/student/cv")) return ["Làm sao để tải lên CV?", "CV hỗ trợ định dạng nào?"]
  if (pathname.startsWith("/student/history")) return ["Cách lọc lịch sử phỏng vấn?", "Mở trang phân tích CV"]
  return ["Làm sao để bắt đầu phân tích CV?", "Hướng dẫn phỏng vấn thử"]
}

export function ChatPanel() {
  const { isOpen, messages, isThinking, isExecutingAction, activeAction, pathname, userRole, error, sendMessage, clearChat, toggleChat } = useAssistant()
  const busy = isThinking || isExecutingAction || activeAction !== null
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement
    inputRef.current?.focus({ preventScroll: true })
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [isOpen])

  useEffect(() => {
    const input = inputRef.current
    if (!input || !isOpen) return
    input.style.height = "0px"
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`
  }, [draft, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "instant" })
  }, [messages, isThinking, error, isOpen])

  const submitMessage = () => {
    if (!draft.trim() || busy) return
    const text = draft.trim()
    setDraft("")
    void sendMessage(text)
    inputRef.current?.focus({ preventScroll: true })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitMessage()
    }
  }

  if (!isOpen) return null

  return (
    <section
      id="assistant-chat-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="assistant-chat-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); toggleChat() }
      }}
      className="fixed bottom-24 right-6 z-50 flex h-[600px] max-h-[min(80dvh,calc(100dvh-7rem))] w-[420px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card text-card-foreground shadow-2xl animate-in fade-in-0 slide-in-from-bottom-2 duration-200 print:hidden"
    >
      <header className="flex shrink-0 items-start gap-3 border-b border-line bg-linear-to-r from-blue-soft/80 to-violet-soft/60 px-4 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-blue to-violet text-white">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="assistant-chat-title" className="font-heading text-sm font-bold leading-snug">Trợ lý hướng dẫn EDU-17</h2>
          <p className="mt-1 truncate text-[11px] text-ink-2" title={`Trang: ${pathname}`}>Trang: {pathname}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" disabled={isExecutingAction} aria-label="Xoá lịch sử chat" title="Xoá lịch sử chat" onClick={() => { clearChat(); setDraft(""); inputRef.current?.focus() }}>
            <Trash2 aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Thu nhỏ trợ lý" title="Thu nhỏ" onClick={toggleChat}><Minus aria-hidden /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Đóng trợ lý" title="Đóng" onClick={toggleChat}><X aria-hidden /></Button>
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full min-h-36 flex-col items-center justify-center gap-3 px-3 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-soft text-violet"><Sparkles className="size-6" aria-hidden /></span>
            <h3 className="font-heading text-base font-bold">Bạn cần hướng dẫn gì?</h3>
            <p className="max-w-72 text-sm leading-relaxed text-ink-2">Hỏi về CV, phân tích kỹ năng, phỏng vấn STAR hoặc cách sử dụng trang hiện tại.</p>
          </div>
        )}
        <div role="log" aria-label="Tin nhắn với trợ lý" aria-live="polite" aria-relevant="additions" aria-busy={isThinking} className="space-y-4">
          {messages.map((message) => (
            <article key={message.id} className={cn("flex flex-col gap-1", message.sender === "user" ? "items-end" : "items-start")}>
              <span className="px-1 text-[11px] font-medium text-ink-3">{message.sender === "user" ? "Bạn" : "Trợ lý"}</span>
              <div className={cn("max-w-full rounded-2xl px-3.5 py-3 text-sm leading-relaxed wrap-anywhere", message.sender === "user" ? "max-w-[90%] rounded-tr-sm bg-blue text-on-blue" : "w-full rounded-tl-sm border border-line bg-card")}>
                {message.sender === "user" ? <p className="whitespace-pre-wrap">{message.content}</p> : (
                  <>
                    <AssistantMarkdown content={message.content} userRole={userRole} />
                    {message.sources && <SourceAccordion sources={message.sources} userRole={userRole} />}
                    {message.actions && <ActionBadges actions={message.actions} />}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {isThinking && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-ink-3"><LoaderCircle className="size-4 animate-spin" aria-hidden />Trợ lý đang suy nghĩ…</p>}
        {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-bad-soft p-3 text-xs text-bad"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>}
      </div>

      <footer className="shrink-0 border-t border-line bg-surface/40 px-4 pb-3 pt-3">
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Câu hỏi gợi ý">
          {suggestionsFor(pathname).map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => { void sendMessage(suggestion) }} className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-[11px] text-ink-2 transition-colors hover:border-blue/30 hover:bg-blue-soft hover:text-blue disabled:cursor-not-allowed disabled:opacity-50">{suggestion}</button>)}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); submitMessage() }} className="flex items-end gap-2 rounded-xl border border-line bg-card p-2 focus-within:border-blue/40 focus-within:ring-2 focus-within:ring-blue/10">
          <label htmlFor="assistant-chat-input" className="sr-only">Tin nhắn cho trợ lý</label>
          <Textarea ref={inputRef} id="assistant-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={8000} placeholder="Hỏi trợ lý một câu…" className="max-h-36 min-h-10 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0" />
          <Button type="submit" size="icon-lg" disabled={!draft.trim() || busy} aria-label="Gửi tin nhắn" className="rounded-lg"><SendHorizontal className="size-4" aria-hidden /></Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-ink-3">Enter để gửi · Shift + Enter để xuống dòng</p>
      </footer>
    </section>
  )
}
