import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"

const source = readFileSync(new URL("../lib/assistant-api.ts", import.meta.url), "utf8")
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})

function load(responses) {
  const calls = []
  const exports = {}
  class ApiError extends Error {
    constructor(status, message, code) { super(message); this.status = status; this.code = code }
  }
  vm.runInNewContext(outputText, {
    exports,
    require: (name) => name === "@/lib/api-error" ? { ApiError } : { API_BASE_URL: "https://api.test/" },
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { ok: true, json: async () => responses.shift() }
    },
  })
  return { api: exports, calls }
}

test("history uses the owner-scoped history endpoint, cookies and no cache", async () => {
  const messages = [{ id: "turn:assistant", sender: "assistant", content: "Saved" }]
  const { api, calls } = load([messages])
  assert.equal(await api.getConversationHistory("id/with space"), messages)
  assert.equal(calls[0].url, "https://api.test/api/v1/assistant/conversations/id%2Fwith%20space/history")
  assert.equal(calls[0].init.credentials, "include")
  assert.equal(calls[0].init.cache, "no-store")
})

test("message preserves its client request ID", async () => {
  const response = { turn_id: "turn", run_id: "run", message: "Saved" }
  const { api, calls } = load([response])
  assert.equal(await api.sendMessage({ message: "Hello", client_request_id: "request" }), response)
  assert.equal(JSON.parse(calls[0].init.body).client_request_id, "request")
})

test("completed duplicate recovers its answer without replaying actions", async () => {
  const { api, calls } = load([
    { id: "run", conversation_id: "conversation", status: "done" },
    [{ id: "turn:assistant", turn_id: "turn", sender: "assistant", run_id: "run", content: "Saved", intent: "action" }],
  ])
  const answer = await api.sendMessage({ message: "Hello", client_request_id: "request" })
  assert.equal(answer.message, "Saved")
  assert.equal(answer.run_id, "run")
  assert.equal(answer.intent, "action")
  assert.equal(answer.actions.length, 0)
  assert.equal(calls.length, 2)
})

test("running and cancelled duplicates are handled as explicit run states", async () => {
  for (const status of ["running", "cancelled"]) {
    const { api } = load([{ id: "run", conversation_id: "conversation", status }])
    await assert.rejects(api.sendMessage({ message: "Hello", client_request_id: "request" }),
      (error) => error.status === 409 && error.code === `run_${status}`)
  }
})
