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
import { confirmAction, sendMessage as sendAssistantMessage } from "@/lib/assistant-api"
import { dispatchAgentAction, dispatchUIActions } from "@/lib/action-dispatcher"
import { AgentActionRunner } from "@/lib/agent-action-runner"
import type { AgentPageContext } from "@/lib/use-agent-actions"
import { ActionConfirmationDialog } from "@/components/assistant/action-confirmation-dialog"
import { ElementHighlighter } from "@/components/assistant/element-highlighter"
import type { AgentAction, ChatMessage, ClientPageContext, UserRole } from "@/types/assistant"

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
  sendMessage: (text: string) => Promise<void>
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
  const [activeAction, setActiveAction] = useState<AgentAction | null>(null)
  const [isExecutingAction, setIsExecutingAction] = useState(false)
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
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
  const runner = useMemo(() => new AgentActionRunner({
    execute: (action, confirmed, signal) => dispatchAgentAction(action, router, setHighlightSelector, { role: userRole, confirmed, signal }),
    report: confirmAction,
    onPending: (action) => { setActiveAction(action); setConfirmationError(null) },
    onBusy: setIsExecutingAction,
  }), [router, setHighlightSelector, userRole])

  useEffect(() => () => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
    runner.reset()
  }, [runner])

  const confirmActiveAction = useCallback(async () => {
    setConfirmationError(null)
    try {
      await runner.confirm()
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      setConfirmationError(cause instanceof Error ? cause.message : "Không thể xác nhận hành động. Hãy thử lại.")
    }
  }, [runner])

  const rejectActiveAction = useCallback(async () => {
    setConfirmationError(null)
    try {
      await runner.reject()
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return
      setConfirmationError(cause instanceof Error ? cause.message : "Không thể huỷ hành động. Hãy thử lại.")
    }
  }, [runner])

  const clearChat = useCallback(() => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
    lastRequestId.current = null
    runner.reset()
    conversation.set(null)
    setMessages([])
    setIsThinking(false)
    setIsExecutingAction(false)
    setActiveAction(null)
    setHighlight(null)
    setError(null)
  }, [conversation, runner])

  const executeAction = useCallback((action: AgentAction) => {
    void runner.enqueue([action], true).catch(() => toast.error("Không thể thực hiện hành động tự động."))
  }, [runner])

  const sendMessage = useCallback(async (text: string, requestId?: string): Promise<void> => {
    const content = text.trim()
    if (!content || pendingRequest.current || runner.activeAction || runner.isBusy) return

    const controller = new AbortController()
    const clientRequestId = requestId ?? crypto.randomUUID()
    lastRequestId.current = clientRequestId
    pendingRequest.current = controller
    setIsThinking(true)
    setError(null)
    setMessages((previous) => [...previous, {
      id: crypto.randomUUID(),
      sender: "user",
      content,
      created_at: new Date().toISOString(),
    }])

    const pageContext: AgentPageContext = {}
    window.dispatchEvent(new CustomEvent("agent:page_context", { detail: pageContext }))
    const context: ClientPageContext = {
      current_url: `${pathname}${window.location.search}`,
      route: pathname,
      user_role: userRole,
      ...pageContext,
    }

    try {
      const currentConversationId = conversation.getSnapshot()
      const response = await sendAssistantMessage({
        message: content,
        client_request_id: clientRequestId,
        ...(currentConversationId ? { conversation_id: currentConversationId } : {}),
        context,
      }, controller.signal)
      // Clearing chat or leaving this role invalidates a response already in flight.
      if (pendingRequest.current !== controller) return

      conversation.set(response.conversation_id)
      setMessages((previous) => [...previous, {
        id: response.turn_id,
        sender: "assistant",
        content: response.message,
        created_at: new Date().toISOString(),
        actions: response.actions,
        ui_actions: response.ui_actions,
        sources: response.sources,
      }])
      if (response.ui_actions?.length) {
        setIsExecutingAction(true)
        try {
          await dispatchUIActions(response.ui_actions, router, setHighlightSelector, { role: userRole, signal: controller.signal })
        } finally {
          if (pendingRequest.current === controller) setIsExecutingAction(false)
        }
      } else {
        await runner.enqueue(response.actions)
      }
    } catch (cause) {
      if (pendingRequest.current !== controller || controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : "Không thể gửi tin nhắn. Vui lòng thử lại.")
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null
        setIsThinking(false)
      }
    }
  }, [conversation, pathname, router, runner, setHighlightSelector, userRole])

  const retryLast = useCallback(() => {
    const last = messages.at(-1)
    if (!last || last.sender !== "user") return
    setMessages((previous) => previous.slice(0, -1))
    void sendMessage(last.content, lastRequestId.current ?? undefined)
  }, [messages, sendMessage])

  const highlightSelector = highlight?.selector ?? null
  const value = useMemo<AssistantContextValue>(() => ({
    isOpen, messages, conversationId, isThinking, activeAction, isExecutingAction, pathname, userRole, error,
    highlightSelector, sendMessage, retryLast, clearChat, toggleChat, openChat, closeChat, dismissHighlight, executeAction,
  }), [
    isOpen, messages, conversationId, isThinking, activeAction, isExecutingAction, pathname, userRole, error,
    highlightSelector, sendMessage, retryLast, clearChat, toggleChat, openChat, closeChat, dismissHighlight, executeAction,
  ])

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {highlight && <ElementHighlighter key={highlight.id} {...highlight} onDismiss={dismissHighlight} />}
      <ActionConfirmationDialog action={activeAction} busy={isExecutingAction} error={confirmationError} onConfirm={confirmActiveAction} onReject={rejectActiveAction} />
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
