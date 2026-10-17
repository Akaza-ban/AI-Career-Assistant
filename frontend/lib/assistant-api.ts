import { ApiError } from "@/lib/api-error"
import { API_BASE_URL, isLive } from "@/lib/config"
import type { ActionStatus, AssistantRunPayload, AssistantStreamEvent, AssistantEventName, ChatMessage, ChatRequestPayload, ChatResponsePayload } from "@/types/assistant"

export interface AssistantStatusResponse {
  is_live: boolean
  status: "live" | "offline"
  provider: string
  model: string
  message?: string
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/v1/assistant${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      credentials: "include",
    })
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new ApiError(0, "Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.", "network_error")
  }

  if (!response.ok) {
    const shouldRedirect = typeof isLive === "function" ? isLive("auth") : true
    if (response.status === 401 && shouldRedirect && typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login")
    }
    let detail = `Yêu cầu thất bại (${response.status}).`
    let code: string | undefined
    try {
      const body: unknown = await response.json()
      if (typeof body === "object" && body !== null) {
        if ("detail" in body && typeof body.detail === "string") detail = body.detail
        if ("code" in body && typeof body.code === "string") code = body.code
      }
    } catch {
      // Non-JSON error responses use the HTTP status message above.
    }
    throw new ApiError(response.status, detail, code)
  }
  return response
}

export async function sendMessage(payload: ChatRequestPayload, signal?: AbortSignal): Promise<ChatResponsePayload> {
  const response = await request(
    "/chat",
    { method: "POST", body: JSON.stringify(payload), signal },
  )
  const body = (await response.json()) as ChatResponsePayload | AssistantRunPayload
  if ("turn_id" in body) return body
  if (body.status === "done") {
    const history = await getConversationHistory(body.conversation_id, signal)
    const answer = history.find((message) => message.sender === "assistant" && message.run_id === body.id)
    if (answer?.turn_id && answer.intent) {
      return {
        conversation_id: body.conversation_id, turn_id: answer.turn_id, run_id: body.id,
        message: answer.content, intent: answer.intent, sources: answer.sources ?? [], actions: [],
        cards: answer.cards, chips: answer.chips,
      }
    }
  }
  throw new ApiError(409, body.status === "running"
    ? "Lượt trả lời đang chạy. Hãy chờ rồi thử lại."
    : "Lượt trả lời đã kết thúc. Hãy gửi một tin nhắn mới.", `run_${body.status}`)
}

export async function getAssistantStatus(signal?: AbortSignal): Promise<AssistantStatusResponse> {
  const response = await request("/status", { method: "GET", cache: "no-store", signal })
  return (await response.json()) as AssistantStatusResponse
}

export async function confirmAction(actionId: string, status: ActionStatus, signal?: AbortSignal): Promise<void> {
  await request("/action/confirm", {
    method: "POST",
    body: JSON.stringify({ action_id: actionId, status }),
    signal,
  })
}

export async function submitFeedback(turnId: string, rating: number, comment?: string): Promise<void> {
  if (rating !== 1 && rating !== -1) throw new RangeError("Đánh giá phải là 1 hoặc -1.")
  await request("/feedback", {
    method: "POST",
    body: JSON.stringify({ turn_id: turnId, rating, comment }),
  })
}

/** Huỷ đánh giá đã chọn (bấm lại nút thích / không thích). */
export async function deleteFeedback(turnId: string): Promise<void> {
  await request(`/feedback/${encodeURIComponent(turnId)}`, { method: "DELETE" })
}

export async function getConversationHistory(conversationId: string, signal?: AbortSignal): Promise<ChatMessage[]> {
  const response = await request(`/conversations/${encodeURIComponent(conversationId)}/history`, {
    method: "GET", cache: "no-store", signal,
  })
  return (await response.json()) as ChatMessage[]
}


const STREAM_EVENTS = new Set<AssistantEventName>(["route", "status", "token", "citations", "card", "ui_action", "notice", "final", "error", "heartbeat"])

export async function cancelRun(runId: string): Promise<AssistantRunPayload> {
  return (await request(`/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" })).json()
}

async function recoverRun(body: AssistantRunPayload, signal?: AbortSignal): Promise<ChatResponsePayload> {
  const history = await getConversationHistory(body.conversation_id, signal)
  const answer = history.find((message) => message.sender === "assistant" && message.run_id === body.id)
  if (body.status === "done" && answer?.turn_id && answer.intent) {
    return { conversation_id: body.conversation_id, turn_id: answer.turn_id, run_id: body.id,
      message: answer.content, intent: answer.intent, sources: answer.sources ?? [], cards: answer.cards,
      chips: answer.chips, actions: [], ui_actions: [] }
  }
  throw new ApiError(409, "This run has already been received. Load its saved history.", `run_${body.status}`)
}

/** Fetch streams over POST; a dropped stream is recovered through history, never replayed. */
export async function streamMessage(payload: ChatRequestPayload, onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal): Promise<ChatResponsePayload> {
  let response: Response
  try {
    response = await request("/chat", { method: "POST", body: JSON.stringify(payload), signal,
      headers: { Accept: "text/event-stream" } })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 406 || error.status === 415)) return sendMessage(payload, signal)
    throw error
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const body = await response.json() as ChatResponsePayload | AssistantRunPayload
    return "turn_id" in body ? body : recoverRun(body, signal)
  }
  if (!response.body) throw new ApiError(0, "The server returned an empty stream.", "empty_stream")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let final: ChatResponsePayload | undefined
  const parse = (block: string) => {
    let event = "message"
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""))
    }
    if (!STREAM_EVENTS.has(event as AssistantEventName) || !data.length) return
    const value: unknown = JSON.parse(data.join("\n"))
    if (!value || typeof value !== "object" || !("run_id" in value) || !("conversation_id" in value)
      || typeof value.run_id !== "string" || typeof value.conversation_id !== "string") throw new Error("Invalid assistant event")
    const frame = { event: event as AssistantEventName, data: value as AssistantStreamEvent["data"] }
    onEvent(frame)
    if (event === "error") throw new ApiError(503, typeof frame.data.message === "string" ? frame.data.message : "Assistant unavailable.", "stream_error")
    if (event === "final") {
      if (typeof frame.data.turn_id !== "string" || typeof frame.data.message !== "string") throw new ApiError(409, "Run interrupted.", "run_cancelled")
      final = frame.data as unknown as ChatResponsePayload
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        parse(buffer.slice(0, match.index))
        buffer = buffer.slice(match.index + match[0].length)
      }
      if (done) break
    }
    if (buffer.trim()) parse(buffer)
    if (!final) throw new ApiError(0, "The stream ended before the answer was saved.", "incomplete_stream")
    return final
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
