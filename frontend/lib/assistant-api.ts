import { ApiError } from "@/lib/api-error"
import { API_BASE_URL } from "@/lib/config"
import type { ActionStatus, AssistantRunPayload, ChatMessage, ChatRequestPayload, ChatResponsePayload } from "@/types/assistant"

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
    if (response.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
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
