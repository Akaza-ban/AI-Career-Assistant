'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { cancelRun, getConversationHistory, streamMessage } from "@/lib/assistant-api"
import { dispatchAgentAction, dispatchUIActions } from "@/lib/action-dispatcher"
import type { AgentPageContext } from "@/lib/use-agent-actions"
import { ElementHighlighter } from "@/components/assistant/element-highlighter"
import type { AgentAction, AssistantCard, AssistantChip, ChatMessage, ClientPageContext, SourceCitation, UserRole } from "@/types/assistant"

export interface AssistantContextValue {
  isOpen: boolean
  messages: ChatMessage[]
  conversationId: string | null
  isThinking: boolean
  activeAction: AgentAction | null
  isExecutingAction: boolean
  pathname: string
  userRole: UserRole
  error: string | null
  /** Bộ chọn của phần tử trợ lý đang chỉ trên trang; khung chat thu gọn để không che phần tử đó. */
  highlightSelector: string | null
  sendMessage: (text: string, chip?: AssistantChip) => Promise<void>
  stop: () => void
  /** Gửi lại câu hỏi cuối khi lần gửi trước lỗi. */
  retryLast: () => void
  clearChat: () => void
  toggleChat: () => void
  openChat: () => void
  closeChat: () => void
  dismissHighlight: () => void
  executeAction: (action: AgentAction) => void
}

export const AssistantContext = createContext<AssistantContextValue | null>(null)

function cacheConversation(storageKey: string, conversationId: string | null): void {
  try {
    if (conversationId) window.localStorage.setItem(storageKey, conversationId)
    else window.localStorage.removeItem(storageKey)
  } catch {
    // Chat remains usable when browser storage is unavailable.
  }
}

function createConversationStore(storageKey: string) {
  let id: string | null = null
  let initialized = false
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot(): string | null {
      if (!initialized) {
        initialized = true
        try {
          id = window.localStorage.getItem(storageKey)
        } catch {
          // Storage is optional; keep the conversation in memory instead.
        }
      }
      return id
    },
    getServerSnapshot: (): null => null,
    set(nextId: string | null): void {
      initialized = true
      id = nextId
      cacheConversation(storageKey, nextId)
      listeners.forEach((listener) => listener())
    },
  }
}

function AssistantSession({ children, pathname, userRole }: {
  children: ReactNode
  pathname: string
  userRole: UserRole
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversation] = useState(() => createConversationStore(`edu17:assistant:conversation:${userRole}`))
  const conversationId = useSyncExternalStore(
    conversation.subscribe, conversation.getSnapshot, conversation.getServerSnapshot,
  )
  const [isThinking, setIsThinking] = useState(false)
  const activeAction = null
  const [isExecutingAction, setIsExecutingAction] = useState(false)
  const [highlight, setHighlight] = useState<{ id: string; selector: string; tooltip?: string; durationMs?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingRequest = useRef<AbortController | null>(null)
  const lastRequestId = useRef<string | null>(null)

  const toggleChat = useCallback(() => setIsOpen((open) => !open), [])
  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const dismissHighlight = useCallback(() => setHighlight(null), [])
  const setHighlightSelector = useCallback((selector: string | null, tooltip?: string, durationMs?: number) => {
    setHighlight(selector ? { id: crypto.randomUUID(), selector, tooltip, durationMs } : null)
  }, [])
  const runId = useRef<string | null>(null)
  const stopping = useRef(false)
  const loadedConversation = useRef<string | null>(null)
  const lastContent = useRef<{ text: string; chip?: AssistantChip } | null>(null)

  useEffect(() => {
    if (!conversationId || loadedConversation.current === conversationId) return
    const controller = new AbortController()
    void getConversationHistory(conversationId, controller.signal).then((history) => {
      if (!controller.signal.aborted && !pendingRequest.current) {
        loadedConversation.current = conversationId
        setMessages(history.map((message) => ({ ...message, id: message.turn_id && message.sender === "assistant" ? message.turn_id : message.id })))
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Cannot load saved history.")
    })
    return () => controller.abort()
  }, [conversationId])

  useEffect(() => () => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
    lastRequestId.current = null
  }, [])

  const stop = useCallback(() => {
    const controller = pendingRequest.current
    if (!controller) return
    stopping.current = true
    if (runId.current) {
      void cancelRun(runId.current).catch(() => {}).finally(() => controller.abort())
    } else controller.abort()
  }, [])

  const clearChat = useCallback(() => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
    lastRequestId.current = null
    loadedConversation.current = null
    runId.current = null
    conversation.set(null)
    setMessages([])
    setIsThinking(false)
    setIsExecutingAction(false)
    setHighlight(null)
    setError(null)
  }, [conversation])

  const executeAction = useCallback((action: AgentAction) => {
    if (!["NAVIGATE_PAGE", "HIGHLIGHT_ELEMENT"].includes(action.action_type)) return
    void dispatchAgentAction(action, router, setHighlightSelector, { role: userRole })
      .catch(() => toast.error("Cannot perform this action."))
  }, [router, setHighlightSelector, userRole])

  const sendMessage = useCallback(async (text: string, chip?: AssistantChip, requestId?: string): Promise<void> => {
    const content = text.trim()
    if (!content || pendingRequest.current) return
    const controller = new AbortController()
    const clientRequestId = requestId ?? crypto.randomUUID()
    lastRequestId.current = clientRequestId
    lastContent.current = { text: content, chip }
    pendingRequest.current = controller
    stopping.current = false
    runId.current = null
    setIsThinking(true)
    setError(null)
    const temporaryId = `assistant:${clientRequestId}`
    let answer: ChatMessage = { client_request_id: clientRequestId, id: temporaryId, sender: "assistant", content: "", created_at: new Date().toISOString(), is_streaming: true }
    let animation: number | null = null
    let stopped = false
    const render = () => {
      animation = null
      if (lastRequestId.current !== clientRequestId) return
      const snapshot = { ...answer }
      setMessages((previous) => previous.map((message) => message.id === temporaryId ? snapshot : message))
    }
    const schedule = () => { if (animation === null) animation = requestAnimationFrame(render) }
    setMessages((previous) => [...previous.filter((message) => message.client_request_id !== clientRequestId), {
      client_request_id: clientRequestId, id: `user:${clientRequestId}`, sender: "user", content, created_at: new Date().toISOString(),
    }, { ...answer }])

    const pageContext: AgentPageContext = {}
    window.dispatchEvent(new CustomEvent("agent:page_context", { detail: pageContext }))
    const context: ClientPageContext = {
      current_url: `${pathname}${window.location.search}`, route: pathname, user_role: userRole, ...pageContext,
    }
    const remember = (id: string) => {
      loadedConversation.current = id
      conversation.set(id)
    }
    try {
      const currentConversationId = conversation.getSnapshot()
      const response = await streamMessage({ message: content, client_request_id: clientRequestId,
        ...(currentConversationId ? { conversation_id: currentConversationId } : {}), context, ...(chip ? { chip } : {}),
      }, ({ event, data }) => {
        if (pendingRequest.current !== controller) return
        runId.current = data.run_id
        remember(data.conversation_id)
        answer.run_id = data.run_id
        if (event === "token" && typeof data.text === "string") answer.content += data.text
        if (event === "citations" && Array.isArray(data.sources)) answer.sources = data.sources as SourceCitation[]
        if (event === "card") {
          if (data.card && typeof data.card === "object") answer.cards = [...(answer.cards ?? []), data.card as AssistantCard]
          if (Array.isArray(data.chips)) answer.chips = data.chips as AssistantChip[]
        }
        if (event === "notice" && typeof data.message === "string") answer.notices = [...(answer.notices ?? []), data.message]
        if (event === "final" && data.interrupted === true) stopped = true
        if (["token", "citations", "card", "notice"].includes(event)) schedule()
      }, controller.signal)
      if (pendingRequest.current !== controller) return
      remember(response.conversation_id)
      answer = { ...answer, id: response.turn_id, turn_id: response.turn_id, run_id: response.run_id,
        content: response.message, sources: response.sources, ui_actions: response.ui_actions,
        cards: response.cards, chips: response.chips, is_streaming: false }
      schedule()
      if (!controller.signal.aborted && !stopped && !stopping.current && response.ui_actions?.length) {
        setIsExecutingAction(true)
        await dispatchUIActions(response.ui_actions, router, setHighlightSelector, { role: userRole, signal: controller.signal })
      }
    } catch (cause) {
      if (pendingRequest.current !== controller) return
      answer = { ...answer, is_streaming: false, interrupted: true }
      schedule()
      if (!controller.signal.aborted && !stopped) setError(cause instanceof Error ? cause.message : "Cannot send message.")
      const id = conversation.getSnapshot()
      if (id && runId.current) {
        try {
          const history = await getConversationHistory(id)
          if (pendingRequest.current === controller) {
            const saved = history.find((message) => message.sender === "assistant" && message.run_id === runId.current)
            if (saved) answer = { ...answer, ...saved, id: saved.turn_id ?? saved.id, is_streaming: false }
          }
        } catch { /* Keep the guarded partial answer already on screen. */ }
      }
    } finally {
      schedule()
      if (pendingRequest.current === controller) {
        pendingRequest.current = null
        setIsThinking(false)
        setIsExecutingAction(false)
      }
    }
  }, [conversation, pathname, router, setHighlightSelector, userRole])

  const retryLast = useCallback(() => {
    if (lastContent.current) void sendMessage(lastContent.current.text, lastContent.current.chip, lastRequestId.current ?? undefined)
  }, [sendMessage])

  const highlightSelector = highlight?.selector ?? null
  const value = useMemo<AssistantContextValue>(() => ({
    isOpen, messages, conversationId, isThinking, activeAction, isExecutingAction, pathname, userRole, error,
    highlightSelector, sendMessage, stop, retryLast, clearChat, toggleChat, openChat, closeChat, dismissHighlight, executeAction,
  }), [
    isOpen, messages, conversationId, isThinking, activeAction, isExecutingAction, pathname, userRole, error,
    highlightSelector, sendMessage, stop, retryLast, clearChat, toggleChat, openChat, closeChat, dismissHighlight, executeAction,
  ])

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {highlight && <ElementHighlighter key={highlight.id} {...highlight} onDismiss={dismissHighlight} />}
    </AssistantContext.Provider>
  )
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const userRole: UserRole = pathname === "/advisor" || pathname.startsWith("/advisor/") ? "advisor" : "student"
  // Preserve chat across pages in the same role; isolate state when switching roles.
  return <AssistantSession key={userRole} pathname={pathname} userRole={userRole}>{children}</AssistantSession>
}

/** Dùng ở chỗ có thể nằm ngoài AssistantProvider (ví dụ khu quản trị không có trợ lý). */
export function useOptionalAssistant(): AssistantContextValue | null {
  return useContext(AssistantContext)
}

export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext)
  if (!context) throw new Error("useAssistant phải nằm trong AssistantProvider")
  return context
}
