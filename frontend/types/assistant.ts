export type UserRole = "student" | "advisor"
export type UIAction =
  | { type: "highlight"; element_id: string }
  | { type: "navigate"; route_id: string; params: Record<string, string> }

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

export interface AssistantCard {
  ref: string
  label: string
  route_id: string
  params: Record<string, string>
  sublabel?: string | null
  kind?: "link" | "facts"
  facts?: Record<string, string | number | null>
}

export interface AssistantChip {
  label: string
  route: "navigate" | "locate" | "howto"
  slots: Record<string, string | boolean | null>
  route_id?: string | null
  params?: Record<string, string>
}

export interface ChatMessage {
  client_request_id?: string
  cards?: AssistantCard[]
  chips?: AssistantChip[]
  notices?: string[]
  id: string
  sender: "user" | "assistant"
  content: string
  created_at: string
  ui_actions?: UIAction[]
  actions?: AgentAction[]
  sources?: SourceCitation[]
  is_streaming?: boolean
  run_id?: string | null
  turn_id?: string
  interrupted?: boolean
  intent?: "qa" | "action" | "hybrid"
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
  client_request_id: string
  context: ClientPageContext
  chip?: AssistantChip
}

export interface ChatResponsePayload {
  cards?: AssistantCard[]
  chips?: AssistantChip[]
  conversation_id: string
  turn_id: string
  run_id?: string
  message: string
  intent: "qa" | "action" | "hybrid"
  ui_actions?: UIAction[]
  actions: AgentAction[]
  sources: SourceCitation[]
}

export interface AssistantRunPayload {
  id: string
  conversation_id: string
  client_request_id: string
  route: string
  status: "running" | "done" | "failed" | "cancelled" | "interrupted"
  created_at: string
  updated_at: string
}

export type AssistantEventName = "route" | "status" | "token" | "citations" | "card" | "ui_action" | "notice" | "final" | "error" | "heartbeat"
export interface AssistantStreamEvent {
  event: AssistantEventName
  data: Record<string, unknown> & { run_id: string; conversation_id: string }
}
