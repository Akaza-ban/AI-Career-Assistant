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
import { resolveAssistantRoute } from "@/lib/assistant-navigation"
import type { AgentAction, ChatMessage, ClientPageContext, UserRole } from "@/types/assistant"

export interface AssistantContextValue {
  isOpen: boolean
  messages: ChatMessage[]
  conversationId: string | null
  isThinking: boolean
  activeAction: AgentAction | null
  pathname: string
  userRole: UserRole
  error: string | null
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void
  toggleChat: () => void
  executeAction: (action: AgentAction) => void
  setActiveAction: (action: AgentAction | null) => void
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
  const [error, setError] = useState<string | null>(null)
  const pendingRequest = useRef<AbortController | null>(null)

  useEffect(() => () => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
  }, [])

  const toggleChat = useCallback(() => setIsOpen((open) => !open), [])

  const clearChat = useCallback(() => {
    pendingRequest.current?.abort()
    pendingRequest.current = null
    conversation.set(null)
    setMessages([])
    setIsThinking(false)
    setActiveAction(null)
    setError(null)
  }, [conversation])

  const executeAction = useCallback((action: AgentAction) => {
    // Stateful actions and DOM actions are handed to the Day 3 dialog / dispatcher.
    if (action.requires_confirmation || action.action_type !== "NAVIGATE_PAGE") {
      setActiveAction(action)
      return
    }
    const route = resolveAssistantRoute(action.params.route, userRole)
    if (!route) {
      toast.error("Trang được đề xuất chưa khả dụng cho vai trò hiện tại.")
      return
    }
    const query = new URLSearchParams()
    if (typeof action.params.query === "object" && action.params.query !== null) {
      for (const [key, value] of Object.entries(action.params.query)) {
        if (typeof value === "string") query.set(key, value)
      }
    }
    router.push(`${route}${query.size ? `?${query.toString()}` : ""}`)
    void confirmAction(action.id, "executed").catch(() => {
      toast.error("Đã chuyển trang nhưng chưa cập nhật được trạng thái hành động.")
    })
  }, [router, userRole])

  const sendMessage = useCallback(async (text: string): Promise<void> => {
    const content = text.trim()
    if (!content || pendingRequest.current) return

    const controller = new AbortController()
    pendingRequest.current = controller
    setIsThinking(true)
    setError(null)
    setMessages((previous) => [...previous, {
      id: crypto.randomUUID(),
      sender: "user",
      content,
      created_at: new Date().toISOString(),
    }])

    const context: ClientPageContext = {
      current_url: `${pathname}${window.location.search}`,
      route: pathname,
      user_role: userRole,
    }

    try {
      const currentConversationId = conversation.getSnapshot()
      const response = await sendAssistantMessage({
        message: content,
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
        sources: response.sources,
      }])
      setActiveAction((current) => current ?? response.actions.find((action) => action.requires_confirmation) ?? null)
      const navigation = response.actions.find((action) => action.action_type === "NAVIGATE_PAGE" && !action.requires_confirmation)
      if (navigation) executeAction(navigation)
    } catch (cause) {
      if (pendingRequest.current !== controller || controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : "Không thể gửi tin nhắn. Vui lòng thử lại.")
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null
        setIsThinking(false)
      }
    }
  }, [conversation, executeAction, pathname, userRole])

  const value = useMemo<AssistantContextValue>(() => ({
    isOpen, messages, conversationId, isThinking, activeAction, pathname, userRole, error,
    sendMessage, clearChat, toggleChat, executeAction, setActiveAction,
  }), [
    isOpen, messages, conversationId, isThinking, activeAction, pathname, userRole, error,
    sendMessage, clearChat, toggleChat, executeAction,
  ])

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const userRole: UserRole = pathname === "/advisor" || pathname.startsWith("/advisor/") ? "advisor" : "student"
  // Preserve chat across pages in the same role; isolate state when switching roles.
  return <AssistantSession key={userRole} pathname={pathname} userRole={userRole}>{children}</AssistantSession>
}

export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext)
  if (!context) throw new Error("useAssistant phải nằm trong AssistantProvider")
  return context
}
