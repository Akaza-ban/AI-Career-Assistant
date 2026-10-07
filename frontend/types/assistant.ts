export type UserRole = "student" | "advisor"
export type ActionStatus = "confirmed" | "executed" | "rejected" | "failed"

export type ActionType =
  | "NAVIGATE_PAGE"
  | "HIGHLIGHT_ELEMENT"
  | "FILL_FILTER"
  | "OPEN_MODAL"
  | "START_ANALYSIS"
  | "SELECT_STUDENT"
  | "SCROLL_TO"
  | "RESET_VIEW"

export interface AgentAction {
  id: string
  action_type: ActionType
  params: Record<string, unknown>
  requires_confirmation: boolean
  confirmation_message?: string | null
  description_vi: string
}

export interface SourceCitation {
  title: string
  route?: string
  section?: string
  snippet?: string
  chunk_id?: string
  selector?: string | null
}

export interface ChatMessage {
  id: string
  sender: "user" | "assistant"
  content: string
  created_at: string
  actions?: AgentAction[]
  sources?: SourceCitation[]
  is_streaming?: boolean
}

export interface ClientPageContext {
  current_url: string
  route: string
  user_role: UserRole
  user_id?: string
  selected_cv_id?: string
  page_state?: Record<string, unknown>
}

export interface ChatRequestPayload {
  message: string
  conversation_id?: string
  context: ClientPageContext
}

export interface ChatResponsePayload {
  conversation_id: string
  turn_id: string
  message: string
  intent: "qa" | "action" | "hybrid"
  actions: AgentAction[]
  sources: SourceCitation[]
}
