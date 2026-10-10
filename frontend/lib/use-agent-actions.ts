'use client';

import { useEffect } from "react"
import type { ClientPageContext } from "@/types/assistant"

export type AgentPageContext = Pick<ClientPageContext, "selected_cv_id" | "page_state">

export interface ResetViewParams {
  clear_filters: boolean
  close_modals: boolean
}

export interface AgentPageHandlers {
  fillFilter?: (name: string, value: string | number) => boolean
  openModal?: (id: string) => boolean
  resetView?: (params: ResetViewParams) => void
  prepareHighlight?: (selector: string) => void
  getContext?: () => AgentPageContext
}

export interface AgentPageEventDetail {
  filter_name?: string
  value?: string | number
  modal_id?: string
  clear_filters?: boolean
  close_modals?: boolean
  handled: boolean
}

/** Acknowledge only commands supported by the currently mounted page. */
export function useAgentActions({ fillFilter, openModal, resetView, prepareHighlight, getContext }: AgentPageHandlers): void {
  useEffect(() => {
    const fill = (event: Event) => {
      const detail = (event as CustomEvent<AgentPageEventDetail>).detail
      if (detail.filter_name && detail.value !== undefined) {
        detail.handled ||= fillFilter?.(detail.filter_name, detail.value) ?? false
      }
    }
    const open = (event: Event) => {
      const detail = (event as CustomEvent<AgentPageEventDetail>).detail
      if (detail.modal_id) detail.handled ||= openModal?.(detail.modal_id) ?? false
    }
    const reset = (event: Event) => {
      const detail = (event as CustomEvent<AgentPageEventDetail>).detail
      if (resetView) {
        resetView({ clear_filters: detail.clear_filters ?? true, close_modals: detail.close_modals ?? true })
        detail.handled = true
      }
    }
    const prepare = (event: Event) => {
      const { selector } = (event as CustomEvent<{ selector: string }>).detail
      prepareHighlight?.(selector)
    }
    const context = (event: Event) => {
      if (getContext) Object.assign((event as CustomEvent<AgentPageContext>).detail, getContext())
    }
    window.addEventListener("agent:fill_filter", fill)
    window.addEventListener("agent:open_modal", open)
    window.addEventListener("agent:reset_view", reset)
    window.addEventListener("agent:prepare_highlight", prepare)
    window.addEventListener("agent:page_context", context)
    return () => {
      window.removeEventListener("agent:fill_filter", fill)
      window.removeEventListener("agent:open_modal", open)
      window.removeEventListener("agent:reset_view", reset)
      window.removeEventListener("agent:prepare_highlight", prepare)
      window.removeEventListener("agent:page_context", context)
    }
  }, [fillFilter, openModal, resetView, prepareHighlight, getContext])
}
