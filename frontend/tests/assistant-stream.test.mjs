import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"
import vm from "node:vm"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
function compile(path, imports) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  vm.runInNewContext(outputText, { exports, require: imports, TextDecoder, Set })
  return exports
}

function api(responses) {
  const calls = []
  class ApiError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code } }
  const exports = {}
  // Compile with a fetch double so framing and transport paths execute unchanged.
  const { outputText } = ts.transpileModule(readFileSync(new URL("../lib/assistant-api.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  vm.runInNewContext(outputText, { exports, TextDecoder, Set,
    require: (name) => name === "@/lib/api-error" ? { ApiError } : { API_BASE_URL: "https://api.test" },
    fetch: async (url, init) => { calls.push({ url, init }); return responses.shift() },
  })
  return { exports, calls }
}
const payload = { message: "Hello", client_request_id: "same-request" }
const final = { run_id: "run", conversation_id: "conv", turn_id: "turn", message: "Xin chào", actions: [], sources: [], intent: "qa" }
function wire(event, data) { return `event: ${event}\r\ndata: ${JSON.stringify({ run_id: "run", conversation_id: "conv", ...data })}\r\n\r\n` }
function stream(text, split = 1) {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream({
    start(controller) { for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.slice(i, i + split)); controller.close() },
  }), { headers: { "content-type": "text/event-stream" } })
}

test("POST SSE handles UTF-8/CRLF boundaries and ignores unknown events", async () => {
  const text = wire("route", { route: "smalltalk" }) + wire("reasoning_content", { text: "private" })
    + wire("token", { text: "Xin chào" }) + wire("final", final)
  for (const split of [1, 2, 3, 7, 256]) {
    const { exports, calls } = api([stream(text, split)])
    const events = []
    const answer = await exports.streamMessage(payload, (event) => events.push(event))
    assert.equal(answer.message, "Xin chào")
    assert.deepEqual(events.map((event) => event.event), ["route", "token", "final"])
    assert.equal(calls[0].init.headers.Accept, "text/event-stream")
    assert.equal(calls[0].init.credentials, "include")
    assert.equal(JSON.parse(calls[0].init.body).client_request_id, "same-request")
  }
})

test("JSON response and negotiated fallback retain the same request ID", async () => {
  const { exports, calls } = api([new Response(JSON.stringify(final), { headers: { "content-type": "application/json" } })])
  assert.equal((await exports.streamMessage(payload, () => {})).turn_id, "turn")
  assert.equal(calls.length, 1)
  const fallback = api([new Response("", { status: 406 }), new Response(JSON.stringify(final))])
  assert.equal((await fallback.exports.streamMessage(payload, () => {})).turn_id, "turn")
  assert.equal(fallback.calls.length, 2)
  assert.equal(JSON.parse(fallback.calls[1].init.body).client_request_id, "same-request")
})

test("incomplete/error streams never resend a message", async () => {
  for (const text of [wire("token", { text: "partial" }), wire("error", { message: "Unavailable" })]) {
    const { exports, calls } = api([stream(text)])
    await assert.rejects(exports.streamMessage(payload, () => {}))
    assert.equal(calls.length, 1)
  }
})

test("duplicate SSE request recovers history without replaying saved actions", async () => {
  const { exports, calls } = api([
    new Response(JSON.stringify({ id: "run", conversation_id: "conv", status: "done" })),
    new Response(JSON.stringify([{ id: "saved", sender: "assistant", turn_id: "turn", run_id: "run", content: "Saved", intent: "qa", ui_actions: [{ type: "highlight", element_id: "x" }] }])),
  ])
  const answer = await exports.streamMessage(payload, () => assert.fail("Do not replay events"))
  assert.equal(answer.message, "Saved")
  assert.equal(answer.ui_actions.length, 0)
  assert.equal(calls.length, 2)
})

test("Stop uses the authenticated cancellation endpoint", async () => {
  const { exports, calls } = api([new Response(JSON.stringify({ id: "run", status: "cancelled" }))])
  await exports.cancelRun("run/1")
  assert.equal(calls[0].url, "https://api.test/api/v1/assistant/runs/run%2F1/cancel")
  assert.equal(calls[0].init.method, "POST")
  assert.equal(calls[0].init.credentials, "include")
})

const navigation = { resolveAssistantRoute: (href) => href === "/student/cv" ? href : null }
const { AssistantMarkdown } = compile("../components/assistant/assistant-markdown.tsx", (name) => {
  if (name === "@/lib/assistant-navigation") return navigation
  if (name === "next/link") return { default: ({ href, children }) => React.createElement("a", { href }, children) }
  return require(name)
})

test("partial markdown escapes HTML and keeps links inactive until final", () => {
  for (const content of ["<script>alert(1)</script>", "[click](javascript:alert(1))", "**partial", "[open](/student/cv)"]) {
    const html = renderToStaticMarkup(React.createElement(AssistantMarkdown, { content, userRole: "student", isStreaming: true }))
    assert.ok(!html.includes("<script>"))
    assert.ok(!html.includes("<a "))
  }
  const html = renderToStaticMarkup(React.createElement(AssistantMarkdown, { content: "**Complete**", userRole: "student" }))
  assert.ok(html.includes("<strong>Complete</strong>"))
})
