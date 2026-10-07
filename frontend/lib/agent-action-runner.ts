import type { AgentAction } from "@/types/assistant"

interface ActionRunnerHandlers {
  execute: (action: AgentAction, confirmed: boolean, signal: AbortSignal) => Promise<boolean>
  report: (actionId: string, status: "confirmed" | "rejected", signal: AbortSignal) => Promise<void>
  onPending: (action: AgentAction | null) => void
  onBusy: (busy: boolean) => void
}

/** Keep response actions in order across a human confirmation pause. */
export class AgentActionRunner {
  private queue: AgentAction[] = []
  private completed = new Set<string>()
  private controller = new AbortController()
  private busy = false
  private pending: AgentAction | null = null

  constructor(private handlers: ActionRunnerHandlers) {}

  get isBusy(): boolean { return this.busy }
  get activeAction(): AgentAction | null { return this.pending }

  private setBusy(busy: boolean): void {
    this.busy = busy
    this.handlers.onBusy(busy)
  }

  private setPending(action: AgentAction | null): void {
    this.pending = action
    this.handlers.onPending(action)
  }

  reset(): void {
    this.controller.abort()
    this.controller = new AbortController()
    this.queue = []
    this.completed.clear()
    this.setPending(null)
    this.setBusy(false)
  }

  async enqueue(actions: AgentAction[], replayReadOnly = false): Promise<void> {
    for (const action of actions) {
      if (replayReadOnly && !action.requires_confirmation && action.action_type !== "START_ANALYSIS") {
        this.completed.delete(action.id)
      }
      if (!this.completed.has(action.id) && !this.queue.some((queued) => queued.id === action.id)) {
        this.queue.push(action)
      }
    }
    await this.drain()
  }

  private async drain(): Promise<void> {
    if (this.busy || this.pending) return
    const signal = this.controller.signal
    this.setBusy(true)
    try {
      while (this.queue.length && !signal.aborted) {
        const action = this.queue[0]
        if (action.requires_confirmation || action.action_type === "START_ANALYSIS") {
          this.setPending(action)
          return
        }
        const executed = await this.handlers.execute(action, false, signal)
        if (signal.aborted) return
        this.queue.shift()
        this.completed.add(action.id)
        if (!executed) { this.queue = []; return }
      }
    } finally {
      if (!signal.aborted) this.setBusy(false)
    }
  }

  async confirm(): Promise<void> {
    const action = this.pending
    if (!action || this.busy) return
    const signal = this.controller.signal
    this.setBusy(true)
    try {
      // Persist consent before a state-changing request can begin.
      await this.handlers.report(action.id, "confirmed", signal)
      if (signal.aborted) return
      const executed = await this.handlers.execute(action, true, signal)
      if (signal.aborted) return
      this.queue.shift()
      this.completed.add(action.id)
      this.setPending(null)
      if (!executed) this.queue = []
    } finally {
      if (!signal.aborted) this.setBusy(false)
    }
    await this.drain()
  }

  async reject(): Promise<void> {
    const action = this.pending
    if (!action || this.busy) return
    const signal = this.controller.signal
    this.setBusy(true)
    try {
      await this.handlers.report(action.id, "rejected", signal)
      if (signal.aborted) return
      this.completed.add(action.id)
      // Later actions may depend on the rejected operation.
      this.queue = []
      this.setPending(null)
    } finally {
      if (!signal.aborted) this.setBusy(false)
    }
  }
}
