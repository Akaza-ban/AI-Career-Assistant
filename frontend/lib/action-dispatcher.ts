import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { confirmAction } from "@/lib/assistant-api"
import { resolveAssistantRoute, resolveUIElement, resolveUIRoute } from "@/lib/assistant-navigation"
import type { AgentPageEventDetail } from "@/lib/use-agent-actions"
import type { AgentAction, UIAction, UserRole } from "@/types/assistant"

interface DispatchOptions {
  role?: UserRole
  confirmed?: boolean
  signal?: AbortSignal
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Tham số ${name} không hợp lệ.`)
  return value
}

async function waitUntil<T>(read: () => T | null, signal?: AbortSignal): Promise<T> {
  const deadline = Date.now() + 5000
  do {
    signal?.throwIfAborted()
    const result = read()
    if (result !== null) return result
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50))
  } while (Date.now() < deadline)
  throw new Error("Không tìm thấy trang hoặc thành phần cần thao tác.")
}

function findElement(selector: string, signal?: AbortSignal): Promise<Element> {
  return waitUntil(() => {
    const element = document.querySelector(selector)
    return element && element.getClientRects().length > 0 ? element : null
  }, signal)
}

function findHighlightElement(selector: string, signal?: AbortSignal): Promise<Element> {
  return waitUntil(() => {
    const element = document.querySelector(selector)
    if (element && element.getClientRects().length > 0) return element
    window.dispatchEvent(new CustomEvent("agent:prepare_highlight", { detail: { selector } }))
    return null
  }, signal)
}

async function dispatchPageEvent(name: string, params: Omit<AgentPageEventDetail, "handled">, signal?: AbortSignal): Promise<void> {
  // A route may have committed before its client component registers listeners.
  await waitUntil(() => {
    const detail: AgentPageEventDetail = { ...params, handled: false }
    window.dispatchEvent(new CustomEvent(name, { detail }))
    return detail.handled ? true : null
  }, signal)
}

/** Execute only after the confirmation flow grants consent for state-changing actions. */
export async function dispatchAgentAction(
  action: AgentAction | UIAction,
  router: AppRouterInstance,
  setHighlightSelector: (selector: string | null, tooltip?: string, durationMs?: number) => void,
  options: DispatchOptions = {},
): Promise<boolean> {
  const role = options.role ?? (window.location.pathname.startsWith("/advisor") ? "advisor" : "student")
  const navigate = async (route: string, query?: unknown) => {
    const safeRoute = resolveAssistantRoute(route, role)
    if (!safeRoute) throw new Error("Trang được đề xuất chưa khả dụng cho vai trò hiện tại.")
    const search = new URLSearchParams()
    if (query !== undefined) {
      if (typeof query !== "object" || query === null || Array.isArray(query)) throw new Error("Tham số query không hợp lệ.")
      for (const [key, value] of Object.entries(query)) {
        if (typeof value !== "string") throw new Error("Giá trị query phải là chuỗi.")
        search.set(key, value)
      }
    }
    setHighlightSelector(null)
    router.push(`${safeRoute}${search.size ? `?${search}` : ""}`)
    await waitUntil(() => window.location.pathname === safeRoute && window.location.search === (search.size ? `?${search}` : "") ? true : null, options.signal)
  }

  if ("type" in action) {
    try {
      options.signal?.throwIfAborted()
      if (action.type === "navigate") {
        const route = resolveUIRoute(action, role)
        if (!route) throw new Error("Trang không hợp lệ cho vai trò hiện tại.")
        await navigate(route)
      } else if (action.type === "highlight") {
        const target = resolveUIElement(action.element_id, role)
        if (!target || window.location.pathname !== target.route) throw new Error("Thành phần chưa khả dụng trên trang này.")
        await findHighlightElement(target.selector, options.signal)
        setHighlightSelector(target.selector)
      } else {
        throw new Error("Loại hành động không được hỗ trợ.")
      }
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể hiển thị vị trí cần tìm.")
      return false
    }
  }

  // Pending confirmation is not an execution failure and must not be logged as one.
  if ((action.requires_confirmation || action.action_type === "START_ANALYSIS") && !options.confirmed) {
    toast.info("Vui lòng xác nhận trước khi thực hiện hành động này.")
    return false
  }
  try {
    options.signal?.throwIfAborted()
    switch (action.action_type) {
      case "NAVIGATE_PAGE":
        await navigate(requiredString(action.params.route, "route"), action.params.query)
        break
      case "HIGHLIGHT_ELEMENT": {
        const selector = requiredString(action.params.selector, "selector")
        const duration = action.params.duration_ms
        if (duration !== undefined && (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0)) throw new Error("Thời gian highlight không hợp lệ.")
        await findHighlightElement(selector, options.signal)
        setHighlightSelector(selector, typeof action.params.tooltip === "string" ? action.params.tooltip : action.description_vi, duration as number | undefined)
        break
      }
      case "FILL_FILTER": {
        const name = requiredString(action.params.filter_name, "filter_name")
        const value = action.params.value
        if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("Giá trị bộ lọc không hợp lệ.")
        await dispatchPageEvent("agent:fill_filter", { filter_name: name, value }, options.signal)
        toast.success(`Đã cập nhật bộ lọc: ${name}`)
        break
      }
      case "OPEN_MODAL":
        await dispatchPageEvent("agent:open_modal", { modal_id: requiredString(action.params.modal_id, "modal_id") }, options.signal)
        break
      case "START_ANALYSIS": {
        if (role !== "student") throw new Error("Chỉ sinh viên có thể bắt đầu phân tích CV.")
        const cvId = requiredString(action.params.cv_id, "cv_id")
        const jdId = requiredString(action.params.jd_id, "jd_id")
        const analysis = await api.createGapAnalysis({ cv_version_id: cvId, jd_id: jdId })
        await navigate(`/student/analysis/${encodeURIComponent(analysis.id)}`)
        break
      }
      case "SELECT_STUDENT": {
        if (role !== "advisor") throw new Error("Chỉ cố vấn có thể chọn sinh viên.")
        const id = requiredString(action.params.student_id, "student_id")
        // Verify the student is accessible before changing the view.
        await api.getAdvisorStudent(id)
        await navigate(`/advisor/students/${encodeURIComponent(id)}`)
        break
      }
      case "SCROLL_TO": {
        if (action.params.position === "top" || action.params.position === "bottom") {
          window.scrollTo({ top: action.params.position === "top" ? 0 : document.documentElement.scrollHeight, behavior: "smooth" })
        } else {
          const element = await findElement(requiredString(action.params.selector, "selector"), options.signal)
          element.scrollIntoView({ behavior: "smooth", block: "center" })
        }
        break
      }
      case "RESET_VIEW": {
        for (const key of ["clear_filters", "close_modals"] as const) {
          if (action.params[key] !== undefined && typeof action.params[key] !== "boolean") throw new Error(`Tham số ${key} không hợp lệ.`)
        }
        await dispatchPageEvent("agent:reset_view", {
          clear_filters: action.params.clear_filters as boolean | undefined,
          close_modals: action.params.close_modals as boolean | undefined,
        }, options.signal)
        setHighlightSelector(null)
        toast.info("Đã khôi phục trạng thái xem mặc định")
        break
      }
      default:
        throw new Error("Loại hành động không được hỗ trợ.")
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Không thể thực hiện hành động tự động.")
    try {
      await confirmAction(action.id, "failed")
    } catch {
      toast.error("Chưa cập nhật được trạng thái hành động về máy chủ.")
    }
    return false
  }

  try {
    await confirmAction(action.id, "executed")
  } catch {
    // The UI action succeeded; do not relabel it as failed if only logging failed.
    toast.error("Đã thực hiện hành động nhưng chưa cập nhật được trạng thái về máy chủ.")
  }
  return true
}

export const executeAgentAction = dispatchAgentAction

/** Reuse the dispatcher waits; stop before highlight if navigation fails. No acknowledgements. */
export async function dispatchUIActions(
  actions: UIAction[],
  router: AppRouterInstance,
  setHighlightSelector: (selector: string | null, tooltip?: string, durationMs?: number) => void,
  options: DispatchOptions = {},
): Promise<boolean> {
  for (const action of actions) {
    if (!await dispatchAgentAction(action, router, setHighlightSelector, options)) return false
  }
  return true
}
