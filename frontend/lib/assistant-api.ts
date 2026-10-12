import { ApiError } from "@/lib/api-error"
import { API_BASE_URL } from "@/lib/config"
import type { ActionStatus, ChatMessage, ChatRequestPayload, ChatResponsePayload, UserRole } from "@/types/assistant"

export interface AssistantStatusResponse {
  is_live: boolean
  status: "live" | "offline"
  provider: string
  model: string
  message?: string
}

function currentRole(): UserRole {
  const pathname = typeof window === "undefined" ? "" : window.location.pathname
  return pathname === "/advisor" || pathname.startsWith("/advisor/") ? "advisor" : "student"
}

async function request(path: string, init?: RequestInit, role: UserRole = currentRole()): Promise<Response> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/v1/assistant${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Demo-Role": role,
        ...init?.headers,
      },
      credentials: "include",
    })
  } catch (error) {
    if (init?.signal?.aborted) throw error
    throw new ApiError(0, "Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.", "network_error")
  }

  if (!response.ok) {
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
    payload.context.user_role,
  )
  return (await response.json()) as ChatResponsePayload
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

/** Proposed history route; the current backend does not expose this endpoint yet. */
export async function getConversationHistory(conversationId: string): Promise<ChatMessage[]> {
  const response = await request(`/conversations/${encodeURIComponent(conversationId)}/messages`)
  return (await response.json()) as ChatMessage[]
}
