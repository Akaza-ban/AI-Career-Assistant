# CareerX Assistant v2: Architecture (rev 2)

> **For the implementing agent (Codex).** This file supersedes rev 1. Rev 2 cuts scope to four milestones and adds a **Contract (section 2)** that every shipped tool must satisfy. Read this whole file, then `docs/assistant_v2/TOOL_MATRIX.md` (created by task T1.1; it is authoritative for tool names, backing services and business rules), then the code your task names. Where this file conflicts with existing code, follow this file, but keep public API responses backward compatible until the frontend is migrated.

## 0. Working rules

1. **Freeze feature scope.** Changes after freeze must address a failing test, a reproducible violation of the existing contract, or a changed external dependency. Add a regression test for each correction. Do not add features, tools, events or invariants that are not in this file. If something is genuinely ambiguous, pick the safer option (read-only, more confirmation, more masking) and record it in `docs/ASSISTANT_V2_NOTES.md`.
2. **A tool ships only if it meets sections 2, 4 and 10 in full** (ownership, expiry, privacy, budgets, contract). If it cannot, do not ship it; list it in the notes file with the reason. The notes file may hold deferred features and accepted limitations. It never excuses a shipped tool bypassing a requirement.
3. **Tools call service functions, never HTTP endpoints and never the DOM.** If business logic lives in a route handler, extract it into a service function first (pure refactor, behavior unchanged, tests green, separate commit).
4. **Commit discipline (every task).**
   - Before writing code, post a commit plan: the list of commits, each with its scope and the tests it adds.
   - One logical change per commit. Every commit builds and passes `ruff` and `pytest`. Tests go in the same commit as the code they cover, or immediately before it.
   - Migrations, pure refactors and docs each get their own commit. No unrelated changes. No secrets in the repo.
   - Message format: `type(scope): summary` (feat, fix, refactor, test, docs, chore, migrate).
   - Never rewrite pushed history. Run the full suite after each commit.
   - At the end of the task, stop and report: commits made, tests run and results, deviations from the task, items added to `docs/ASSISTANT_V2_NOTES.md`.
5. Do not break existing endpoints or tests.

## 1. Goal and scope

**Goal.** An in-app assistant that answers questions about the user's own CVs, JDs and analyses, and performs a small set of actions through typed tools with human-in-the-loop (HITL) confirmation. PII is masked before any text leaves the server for a provider. The assistant is a product differentiator, so the flagship flow must be reliable.

**Flagship flow (the only flow M3 and M4 must make excellent):** "Tailor my CV for this JD, show me the changes, and re-score it." That means: propose changes, per-hunk review, apply as a new CV version, run a new analysis, show a comparable score delta.

**Cut from this release** (do not build): Chrome extension, outbound advisor feedback, proactive suggestion chips, activity-feed UI (keep the audit records), `cv_rename`, `cv_duplicate`, `jd_archive`, tags (unless TOOL_MATRIX shows they already exist), delete tools, `cv_export`, interview tools, advisor tools (revisit after M4 if time remains), multi-agent supervisors, MCP exposure, browser automation, per-group tool discovery, Jev as the serving router.

## 2. Contract (normative)

### 2.1 Identity and authorization
- Identity comes from a verified session. LLM output can never set user, role or tenant.
- Every resource-bearing tool checks ownership at prepare time and again immediately before execution.
- Lookups of runs, operations, outcomes and history are scoped by `(user_id, conversation_id)`. A cross-user attempt returns `NOT_FOUND` and discloses nothing.

### 2.2 Runs
- `assistant_runs`: `id`, `conversation_id`, `user_id`, `client_request_id`, `status`, `waiting_on_analysis_id` (nullable), `created_at`, `updated_at`. Unique `(user_id, conversation_id, client_request_id)`.
- Every chat message carries a client-generated `client_request_id`. Repeating it returns the existing run. A deliberate rerun uses a fresh ID and a fresh approval.
- States: `running`, `waiting_confirmation`, `waiting_job`, `done`, `failed`, `cancelling`, `cancelled`, `interrupted`.
- At most one `running` run per conversation. A new message while one is `running` returns 409 (the user presses Stop first).
- A new message while the latest run is `waiting_confirmation` or `waiting_job` marks that run `cancelled` and its `pending` operations `expired`. A running analysis job continues detached; its completion is recorded on the analysis row and never resumes the old run into new writes.
- Stop on a `running` run sets `cancelling` then `cancelled`, subject to the cancellation boundary in 2.3.
- Startup sweep: `running` runs become `interrupted`; stale `waiting_*` runs are reconciled per 2.4.
- **Stale-run control:** the execution claim (2.3) requires the run to still be `running` and to be the conversation's latest run. A superseded or cancelled run can never start a new write. Operations already `executing` or committed finish, and their real outcome stays visible.

### 2.3 Operations and approval
- `assistant_operations`: `id` (the server-owned `operation_id`), `run_id`, `conversation_id`, `user_id`, `tool`, `call_id` (provider tool_call id, correlation only), `args_digest`, `resolved_params`, `approval_revision`, `status`, `risk`, `request_json`, `result_ref` (resource type and id), `error`, `created_at`, `decided_at`, `executed_at`, `expires_at`. Unique `(run_id, call_id)`.
- **Persist before executing.** The complete assistant message is checkpointed before any operation is prepared. Prepare derives operations from the persisted message. A crash followed by a new model request cannot produce a second operation for the same intended action, because nothing executed before the checkpoint.
- Reusing an `operation_id` with different validated arguments returns `CONFLICT`.
- States: `pending → approved → executing → done | failed`; also `rejected`, `expired`, `cancelled`.
- **Graph shape.** `llm_step → prepare → approve → execute → llm_step`. `prepare` has side effects and is an upsert on `(run_id, call_id)`. `approve` contains only `interrupt()` and no side effects. `execute` claims and runs. Never put side effects before an `interrupt()` in the same node. The executor never raises to the loop except `GraphInterrupt` and cancellation, which must propagate.
- **Approve** is one atomic transaction: operation `pending → approved` AND run `waiting_confirmation → running`, only if the caller owns the operation, it has not expired, and `approval_revision` matches. If the run is not `waiting_confirmation`, nothing mutates and the caller gets a conflict.
- Duplicate approve returns the existing state. An `approved` but unfinished operation can resume: a repeated approve re-opens an `interrupted` run once. Reject after approve returns 409.
- **Claim:** `UPDATE ... SET status='executing' WHERE id=? AND status='approved'` and the run is `running` and latest. This is the cancellation boundary. Before it, cancel makes the operation `cancelled` and creates nothing. After it, the operation proceeds and stopping narration never relabels it.
- **Reconcile at startup:** an `executing` operation looks up its business resource by `operation_id`. Found means `done` with `result_ref`. Not found means `failed` and retryable by a new request.
- **Transactionality.** A UNIQUE field alone is not enough. Where the service commits internally, the business row carries the `operation_id` (UNIQUE) and is the source of truth; the operation record is reconciled from it, and replay returns the same resource. UNIQUE does not protect filesystem changes, job dispatch or outbound delivery; each shipped tool must state how it covers those.
- Repeated model requests for the same costly action: an executor retry returns its existing operation and consumes no additional logical operation. A different request that meets an open analysis attaches to it (2.4) or returns a defined conflict. Real provider usage always counts toward cost caps.
- The legacy `POST /assistant/action/confirm` accepts only legacy UI action ids. It must reject any server-tool operation id and must never mark a server operation executed.

### 2.4 Analysis dispatch (the M3 write flow)
- `analyses` gains: `operation_id` (UNIQUE, nullable) and a status set covering `queued`, `running`, `completed`, `failed` (extend existing values; do not break them).
- Create the analysis row as `queued` (with `operation_id`), then dispatch. `queued → running` is a compare-and-set and is the single execution claim for initial dispatch and recovery alike.
- A partial unique index allows at most one open (`queued` or `running`) analysis per `(cv_version_id, jd_id)`. The migration cleans existing duplicate open rows first and reports them. Different CV version ids (baseline and revised) are independent.
- Startup sweep: `running` analyses become `failed` (`interrupted_by_restart`); `queued` analyses are dispatched once through the same claim. A crash after the claim and before any work is covered by this sweep.
- **Single worker is a deployment constraint.** Pin one worker in the Dockerfile and compose file, and make startup refuse to boot if the configured worker count is above 1.
- Keep FastAPI `BackgroundTasks`. This delivers durable approval and recorded job failure, not durable job execution. Say so in the notes.
- **Waiting for a job.** After `analysis_start`, the run enters `waiting_job` with `waiting_on_analysis_id`. The loop never polls. When the analysis reaches a terminal state, an internal function `on_analysis_terminal(analysis_id)` (idempotent) moves matching runs `waiting_job → running` by compare-and-set and resumes the graph. The resumed node reloads the analysis status from the database. No endpoint accepts a caller-supplied status or resume value. Startup reconciles `waiting_job` runs whose analysis is already terminal. Frontend polling only refreshes the screen.

### 2.5 Required outcomes by scenario

| Scenario | Required outcome |
|---|---|
| Approved execution, including recovery after a crash | Exactly one analysis for that operation, `completed` or explicitly `failed` |
| Duplicate approval or duplicate message (same `client_request_id`) | Same run, operation and resource; no additional analysis or card |
| Different request meeting an open analysis for the same CV version and JD | Attaches to that job (`waiting_job`), no new card, no new analysis |
| Cross-user attempt or expired approval | No mutation caused by the attempt; no disclosure to the caller |
| Cancel before the claim | No analysis created |
| Cancel after the claim | Existing analysis preserved; chat reports its actual state |

Every crash scenario also asserts: operation status, approval status, analysis status, run status, and that the next user message in the conversation is accepted and answered (no stuck conversation).

### 2.6 Reporting rules
- Outcome vocabulary (server-built, used by cards and narration): `analysis_started`, `analysis_completed`, `analysis_failed`, `cv_version_saved`, `navigation_failed`, `operation_declined`, `operation_expired`, `operation_cancelled`, `operation_failed`.
- On any turn with a write tool, the model's prose is buffered and released only after the relevant result is known. Outcomes shown to the user come from server-built cards. The model's text is limited to explanation and next steps. Never let the model claim an action completed from its own prose.
- A declined, expired or cancelled operation returns a tool result to the model with `USER_DECLINED` or `CANCELLED` and the instruction not to retry the same action.

## 3. Request lifecycle

```
POST /assistant/chat
  1. auth + context hydrate (identity from session; ClientPageContext validated vs role whitelist)
  2. run create/dedup by client_request_id (2.2)
  3. stage 0 deterministic: length cap, injection patterns, role-forbidden terms, greetings/thanks replies
  4. mask inbound text + history -> vault   (local)
  5. ROUTER -> RouterDecision
        |-- deny      -> templated refusal (no LLM)
        |-- qa_direct -> 1 LLM call, no tools, no retrieval
        |-- qa_search -> hybrid RAG -> grounded answer + citations
        '-- agent     -> agent loop (tools, read-only or with HITL)
  6. output guard (see 7.3)
  7. rehydrate user-visible text (never logs/traces/checkpoints)
  8. persist turn; stream final event
```

Graph nodes: `prefilter → mask_in → route → {deny | direct | rag | agent} → guard_out → unmask → persist`. The `agent` subgraph is `llm_step → prepare → approve → execute → llm_step`. Use an async persistent checkpointer (SQLite saver, `thread_id = conversation_id`). **State is masked before it reaches the checkpointer and before any tracing hook can capture it.**

## 4. Privacy (`src/services/privacy/` and `src/services/providers/`)

### 4.1 Guarantee wording
Say: "Direct identifiers are masked locally before provider calls, with measured recall on our evaluation sets and an egress scan as a last line." Do not claim universal protection. A regex scan cannot catch every name or address that NER missed.

### 4.2 One outbound gateway
Every LLM call and every embedding call reachable from any shipped tool goes through one gateway: masking, egress scan, usage and cost accounting, exception sanitization, tracing policy. This includes existing services, background jobs and embeddings. A static test asserts that no module other than the gateway imports a provider SDK or makes outbound model HTTP calls. If a call site cannot be migrated, the tool that reaches it does not ship.

### 4.3 What to mask and keep
- **Mask:** person names, email, phone (VN and international formats), street/home addresses, date of birth, national ID, passport-like numbers, personal profile URLs and handles, photos (strip). Third-party identifiers (referees, recruiters) included.
- **Keep:** employers, schools, job titles, skills, project names, employment dates, city and country level location. Config lists `PII_KEEP_ENTITY_TYPES` and `PII_MASK_ENTITY_TYPES`. Document the residual re-identification risk in the notes.
- JD text also gets a person-name pass (recruiter names), not only email/phone/URL.

### 4.4 Detection layers (run in order, merge spans)
1. Known-identity exact match: the authenticated user's own name, email and phone from the DB, with variants (diacritics, reversed order).
2. Regex: email, phone, ID numbers, URLs and handles, DOB and address lines near labels (`Ngày sinh`, `DOB`, `Địa chỉ`, `Address`, `Phường`, `Quận`, `TP.`, `Đường`).
3. Header heuristic for the candidate name (first 1 to 3 non-empty lines).
4. NER for PERSON and LOCATION. Benchmark `underthesea`, a PhoBERT-based NER and a spaCy multilingual fallback on the golden set; choose by measured recall; record the choice in the notes.
OCR for scanned CVs is local only (Tesseract `vie+eng` or PaddleOCR). Never send CV images to any cloud or vision model.

### 4.5 Placeholders and vault
- Placeholder format: `[[KIND_<nonce>_<n>]]` with a per-conversation random nonce. The same original gets the same placeholder within a conversation. Define one constant for the maximum placeholder length.
- **Escape** literal `[[` in inbound user and document text before masking, so a supplied `[[...]]` never resolves.
- **Field-scoped resolution:** tool argument schemas mark which fields accept which PII kind. A placeholder resolves only into a field that accepts its kind, and only if its recorded origin (message, CV id, JD id) belongs to the call's referenced resources. There is no unrestricted vault lookup. Nonces stop guessing; scoping stops a poisoned document from copying placeholders already visible in context.
- `pii_vault`: `conversation_id`, `placeholder`, `kind`, `origin`, `ciphertext` (Fernet, key from env), `created_at`. Configurable TTL; deleted with the conversation; access only through the privacy module.
- The system prompt tells the model to treat placeholders as opaque values and copy them verbatim.

### 4.6 Storage classes

| Class | Content | Policy |
|---|---|---|
| Business records | CVs, JDs, analyses, CV versions, proposals, edit audits, confirmation payloads | Unmasked where the product needs it; owner-scoped access; never sent to providers unmasked |
| Telemetry | Logs, traces, metrics, error reports | Masked only; exception messages must not carry model output or raw text |
| Checkpoint and vault | Graph state, `reasoning_content`, placeholder map | Checkpoint masked before write; vault encrypted with TTL and deletion rules |

Disable automatic LangChain/LangSmith tracing on the assistant path and on the migrated services. Any tracing receives masked data only.

### 4.7 Fail-safe
If masking throws or the NER model is unavailable, do not call the provider; return a friendly error. `PII_MASKING_ENABLED` defaults true and the app refuses to start in production without it. The egress guard scans the full outbound payload (including replayed reasoning) for emails, phones, ID patterns and the known-identity dictionary, and blocks the call on a match.

### 4.8 Acceptance
- Golden set `eval/pii/`: 60+ synthetic CVs (VI, EN, mixed; text PDFs and scans) plus a held-out set of 10+ real-format CVs, hand-anonymized by the team and kept out of the tuning loop (`eval/pii/real/`, skipped with a warning if absent). Include filenames, third-party identifiers, tool-error text and advisor-style student data in the fixtures.
- Targets: recall >= 0.99 for email, phone, ID; >= 0.92 for names and addresses; precision >= 0.9; false positives on skills, employers, schools < 3%.
- Leak test: run the pipeline and the migrated analysis service with a recording provider; assert zero direct identifiers in any recorded request, log line or trace.
- Round trip: `unmask(mask(x)) == x`. Placeholder-injection tests: a literal `[[PERSON_1]]` in a message or document never resolves.

## 5. Router (`src/services/assistant/router.py`)

```python
class RouterDecision(BaseModel):
    route: Literal["qa_search", "qa_direct", "agent", "deny"]
    confidence: float                      # 0..1
    language: Literal["vi", "en", "mixed"]
    deny_reason: Literal["off_topic", "unsafe", "injection", "out_of_role"] | None = None
    injection_probability: float = 0.0
    clarify_question: str | None = None
```

| Route | Meaning | Handler |
|---|---|---|
| `qa_search` | Question answerable from product docs ("how do I upload a CV?") | Hybrid RAG, cited answer, abstain on low retrieval score |
| `qa_direct` | No data and no docs needed: generic career advice, rephrasing, clarifying the previous answer | One LLM call, no tools |
| `agent` | Anything needing the user's own data or an action: "what is my latest match score?", "why did my interview score drop?", "analyze this CV against that JD", "tailor my CV" | Agent loop. Read-only questions get read tools; writes go through HITL |
| `deny` | Off-topic, unsafe, injection, outside the user's role | Templated refusal, no LLM |

Routing is by required capability, not by verb.

**Stage 0 (deterministic, no model):** empty or oversized input, injection patterns, role-forbidden terms, and **greetings and thanks** (templated reply in vi/en). If a confirmation is pending, short replies ("ok", "no", "cancel") belong to the confirmation UI, not the router.

**Stage 1:** DeepSeek in non-thinking mode, temperature 0, `max_tokens` about 150, JSON via tool call, Pydantic-validated, one repair retry, then fallback `qa_search`.

**Confidence policy:** below the tuned threshold, return `clarify_question` if the message references the user's own data or contains an imperative or state-changing verb; otherwise route `qa_search`. Ambiguity never defaults to an action.

**Jev (TypeSafe) is shadow only in this release (task T4.6):** both routers run, **the DeepSeek decision is served**, disagreements are logged masked. Store Jev's full probabilities and compute the top-route probability explicitly (its built-in `confidence` is a normalized statistic, not the top probability). Pin an explicit model version. Confirm a ZDR arrangement before sending anything. Jev is strongest in English; keep the adoption gate: on Vietnamese and mixed subsets within 2 points of the DeepSeek router, and `agent` and `deny` recall not lower.

**Acceptance:** `eval/router.jsonl` with 300+ labeled utterances (VI/EN/mixed, per role, adversarial, ambiguous, personalized read questions). Accuracy >= 0.93; `deny` recall >= 0.97 on unsafe and injection; confusion matrix; track `agent → qa_*` and `qa_* → agent` separately; router p95 < 1.5 s.

## 6. Agent loop and the DeepSeek contract

```python
MAX_STEPS = 8; MAX_TOOL_CALLS_PER_TURN = 12; MAX_RETRIES_PER_TOOL = 2
```

Plain observe-and-continue loop with hard limits. Tool errors go back to the model as tool results, each with a `hint`. IDs invented by the model return `NOT_FOUND`.

**Provider and structured output.** DeepSeek V4.1 Flash (`deepseek-flash`) through the raw `openai` SDK inside one `LlmClient`. Use native tool calling plus Pydantic validation of every argument (max 2 retries). DeepSeek's `strict` mode exists but is beta, needs the `/beta` base URL, requires every property to be required, and does not support `minLength`, `maxLength` or `minItems`; it is not used. Router and final-answer JSON are validated with one repair retry and a safe fallback.

**Thinking-mode contract (implement exactly; verify against current docs and keep contract tests):**
1. Agent calls use thinking mode (`extra_body={"thinking": {"type": "enabled"}}`, `reasoning_effort` from config, default `high`). `temperature` has no effect in thinking mode.
2. When `tools` is supplied, every later request must replay the full `reasoning_content` of all previous assistant turns in that log, including turns without tool calls. Omitting it can return HTTP 400.
3. Persist each assistant response verbatim (`message.model_dump(exclude_none=True)`). Never rebuild it from parts and never pass it through LangChain message classes.
4. Every `tool_call` gets a `tool` message before the next model call, including declined, expired, failed and cancelled ones. For a dangling call, first reconcile the operation (2.3). Append the real result if it committed; append a synthetic `CANCELLED` result only if nothing committed. **Never fabricate assistant `tool_calls`;** the Chat Completions API does not support inserting tool calls mid-conversation. Synthetic results are allowed only for genuine model-issued call ids.
5. Two logs: only `agent` turns use `agent_messages`. `qa_*` turns are plain text in `assistant_turns`. When the agent starts, inject the last 3 QA exchanges (masked) as one block in the user message.
6. No per-message trimming. Compaction replaces a whole prefix of old turns with one summary message above a token threshold (start at 60k).
7. `reasoning_content` is internal: never shown to users, never unmasked, never logged outside the masked checkpoint. The egress guard scans it.
8. An HTTP 400 mentioning reasoning content is an internal bug: log masked diagnostics, do not retry blindly.

**Latency.** The `agent` route has no hard latency gate until measured. Emit a `status: thinking` event within 1 s, record agent-route p50 and p95 in the eval report, and set the target from the measurement.

**Context hygiene.** The model sees `summary` (<= 300 chars) and compact `data` (<= about 2 KB) only. Never put full CV text in tool results.

**Untrusted content.** CV, JD and page text is wrapped in `<untrusted_document>` blocks and is never an instruction. Tainted-turn rule: if untrusted text is in context, every write tool requires confirmation.

**Budgets.** Per-turn steps and tool calls, per-user daily token and cost cap, per-route and per-tool rate limits, loop and duplicate-call detection.

## 7. Streaming (`text/event-stream`)

### 7.1 What streams
- Stream `qa_direct`, `qa_search` generation and read-only `agent` answers.
- On turns with a write tool, buffer model prose and release it per 2.6. Outcome cards come from the server.
- Never stream `reasoning_content`, tool arguments, cards, diffs or confirmation requests as model text. They are separate events emitted after server-side validation.
- `deny` templates go out as one `token` then `final`.

### 7.2 Events
Each event has a monotonically increasing `id` per run. Types: `route`, `status` (`thinking | searching | running_tool | waiting_confirmation | waiting_job`), `token`, `citations`, `tool_start`, `tool_end`, `ui_action`, `proposal`, `confirmation_required`, `paused`, `notice`, `final`, `error`, `heartbeat` (every 15 s). Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`. There is no `replace` event.

### 7.3 Guard, pre- and post-emission
- **Before emission (enforced):** placeholder leakage and forbidden markers via cheap per-chunk checks, structured events validated against whitelists, outcome buffering on write turns.
- **After emission (advisory, recorded):** citation validity and grounding of streamed `qa_*` text. A failure appends a `notice` event and is logged for the eval; it does not pretend to retract text already shown. `qa_search` abstention is decided from retrieval score before generation, and citations come from retrieval results, never parsed from model text.

### 7.4 Unmasking while streaming
`StreamUnmasker` holds back text from an unmatched `[[` until `]]` arrives, then emits the resolved value. The hold-back limit is derived from the placeholder length constant (4.5), not a fixed 40 characters. Unknown placeholders become a neutral word (`[hidden]`), never raw. Test every possible chunk boundary.

### 7.5 Cancel, disconnect, reconnect
- Stop aborts the fetch and calls `POST /assistant/runs/{run_id}/cancel`. The server cancels the upstream request, persists partial text with `interrupted=true`, and applies the cancellation boundary (2.3).
- Client disconnect is handled the same way.
- Reconnect: `GET /assistant/runs/{run_id}/events?after=<id>` (supports `Last-Event-ID`) replays from a short-TTL store; once expired, the client loads persisted state.
- **Required endpoints:** `GET /assistant/conversations/{id}/history`, `GET /assistant/runs/{id}` (status), the events endpoint above, and a non-streaming JSON mode for backward compatibility. The existing `getConversationHistory` points at an endpoint that does not exist today; fix it.
- Resumed runs with no connected client (for example after a job completes) store their events for this replay.

## 8. Tools (`src/services/assistant/tools/`)

### 8.1 Definition and result envelope
```python
@agent_tool(name="analysis_start", risk=Risk.T2, roles=["student"],
            description="...", idempotent=True)
def analysis_start(ctx: ToolContext, args: AnalysisStartArgs) -> ToolResult: ...
```
Arg models contain resource references and business parameters only, never `user_id`, role or tenant. Tools contain no LangGraph or LangChain imports. Risk tiers: T0 read or propose, T1 reversible write, T2 consequential or cost-bearing, T3 irreversible or outbound.

`ToolResult`: `ok`, `summary` (<= 300 chars), `data` (compact, masked), `ui` (card payload, not sent to the LLM), `error {code, message, hint, candidates?}`, `truncated`. Codes: `INVALID_ARGS`, `NOT_FOUND`, `FORBIDDEN`, `AMBIGUOUS`, `CONFLICT`, `NEEDS_ANALYSIS`, `RATE_LIMITED`, `UPSTREAM_FAILED`, `USER_DECLINED`, `CANCELLED`, `BUDGET_EXCEEDED`.

### 8.2 Exposure
No group routing in this release. Expose the shipped catalog for the user's role (target at most 16 tools). If evaluation shows tool-selection degradation, add routing then.

### 8.3 Catalog v2 (names and availability are final only in TOOL_MATRIX.md)

| Tool | Risk | Milestone | Notes |
|---|---|---|---|
| `search_docs` | T0 | M2 | Hybrid RAG over the guide |
| `ask_user` | T0 (interrupt) | M3 | Clarifying question with 2 to 4 chips or free text |
| `cv_list`, `cv_get` | T0 | M2 | `cv_get` returns section summaries, masked; resolves versions through the existing version family model |
| `jd_list`, `jd_get` | T0 | M2 | |
| `analysis_list`, `analysis_get`, `analysis_explain` | T0 | M2 | Compact scores and top gaps; explanation from the evidence table |
| `ui_action` | T0 | M2 | See 8.4 |
| `analysis_start` | T2 | M3 | Cost-bearing; returns operation and analysis id |
| `cv_tailor_propose` | T0 | M4 | See section 10 |
| `proposal_apply` | T2 | M4 | Applies accepted hunks as a new CV version |
| `analysis_compare` | T0 | M4 | Comparable analyses only |

Business rules from the existing services (family deletion, export integrity confirmation, interview timers, advisor sharing permission) are recorded in TOOL_MATRIX.md and bind any tool added later.

### 8.4 `ui_action`
One tool with a discriminated union over the existing `AgentAction` types (`START_ANALYSIS` removed; it becomes `analysis_start`). **Each variant has its own role, resource and parameter checks**; the existing guard whitelists (routes, selectors, filter names, modal ids) are reused, and a general whitelist alone is not sufficient. The server emits a `ui_action` event with an id; the frontend dispatcher reports `acknowledged` or `failed` to `POST /assistant/ui-actions/{id}/ack`. The tool result waits up to a configurable timeout and returns one of `acknowledged`, `failed`, `timeout`, `disconnected`. A failed navigation never turns a successful business execution into a failure: report them as separate outcomes.

## 9. HITL

### 9.1 ConfirmationRequest (built by the server)
```json
{
  "operation_id": "uuid", "kind": "tool_approval | question | proposal_review",
  "tool": "analysis_start", "title": "Start analysis",
  "summary": "Analyze CV 'Backend_v3' against JD 'Shopee Backend Engineer'.",
  "risk": "T2",
  "resources": [{"type":"cv_version","id":"...","label":"Backend_v3"}, {"type":"jd","id":"...","label":"..."}],
  "params": {"cv_version_id":"...","jd_id":"..."},
  "approval_revision": 1, "irreversible": false, "expires_at": "ISO-8601"
}
```
Labels and resources are resolved by the server from the database. Never show model-written prose as the description of what will happen.

### 9.2 Endpoints
- `POST /api/v1/assistant/confirmations/{operation_id}` body `{decision: "approve"|"reject", approval_revision, accepted_hunks?}`. Revalidate parameters and re-check ownership and expiry. Returns an SSE stream of the resumed run, or the existing state on a duplicate.
- Statuses and expiry follow 2.3. Default expiry 30 minutes; expired means not approvable.
- T2: one-click approve. Always-allow is not offered in this release.

## 10. CV proposal flow (M4)

1. **Precondition:** a completed analysis exists for `(cv_version_id, jd_id)`. The existing optimizer (`cv_optimizer._load`) requires one. If none exists, `cv_tailor_propose` returns `NEEDS_ANALYSIS` with a hint to run the analysis as a separate flow. Do not build a parallel editing system.
2. **Build on the existing semantics:** `CvVersion`, `cv_versions.append` and `cv_optimizer.finalize` (version families, reviewed edits, audit records, new version creation). `proposal_apply` always creates a new version and never mutates the original.
3. **Immutable proposal revisions.** A proposal revision records `base_cv_version_id`, `analysis_id`, `jd_requirements_hash`, `scoring_config_version`, and hunks. Each hunk has: source bullet id, source span hash, before, after, status. Review binds to one revision. If the CV head changed while the diff was open, return `CONFLICT` and regenerate.
4. **Claim preservation (replaces rev 1 provenance labels).** Validate each hunk against its own source bullet:
   - metric phrases (number plus unit plus the noun it attaches to) must be preserved verbatim, or the hunk is `changed_claim`;
   - named entities (employers, tools, credentials) are checked by set difference against the source;
   - ownership and seniority verbs ("led", "managed", "founded", "team of", and the Vietnamese equivalents) absent from the source are flagged;
   - user evidence is a saved assertion from an `ask_user` answer, stored with its quoted span and bound to a CV version. "Could we target 30%?" is not evidence;
   - results: `preserved`, `changed_claim`, `unsupported`. Anything other than `preserved` needs explicit per-hunk acceptance and shows a warning. `proposal_apply` revalidates server-side.
   This reduces fabrication; it does not prove its absence. Human review is the control.
5. **Missing information (a metric, an outcome):** the model calls `ask_user`; it never invents.
6. **Score comparison.** `analysis_compare` shows a delta only if both analyses share `jd_requirements_hash` and `scoring_config_version`; otherwise `not_comparable` with the reason. Zero and negative deltas are shown plainly. Do not promise an improvement.

## 11. Observability and evaluation

- Trace every turn (router decision, each LLM call, each tool call, latency, tokens, cost), masked only.
- Datasets in `eval/`: `router.jsonl`, `tools.jsonl`, `flows.jsonl`, `injection.jsonl`, `pii/`, `fabrication/` (labeled hunks, with expected outcome per hunk).
- **Recorded regression runs vs live evaluation:** recorded fixtures run in CI and catch regressions in our code; a separate live run (manual or nightly) measures current model behavior and degradation. Do not report recorded results as model quality.
- **Fake vs real executor:** the fake executor over an in-memory DB is used only for model evaluation speed. Safety and recovery tests (duplicate approval, crash injection, revoked access, stale proposal, cancellation, cross-user) run against the **real executor and real services**.
- Runner `python -m eval.run --suite all --model <name>` prints a metrics table and exits non-zero below thresholds.
- Initial thresholds: router accuracy >= 0.93; correct tool >= 0.90; exact args >= 0.85; correct ask-vs-act >= 0.85; flagship flow success >= 0.80; unauthorized-action block rate = 1.0; injection success rate = 0; PII leak count = 0 on the evaluation sets; fabrication set: at least 40 labeled cases, >= 95% of fabricated hunks flagged and <= 15% of faithful rewrites flagged (tune after the first run); QA-route p95 end-to-end < 4 s.
- **Provider contract tests** (nightly against the real API, recorded fixtures in CI): (1) a 3-step thinking-mode tool chain with verbatim replay succeeds; (2) a non-tool turn followed by a tool-calling turn succeeds; (3) removing `reasoning_content` from a past assistant message fails with HTTP 400 (documents why replay matters; skip if the provider relaxes it); (4) streaming and non-streaming persist identical messages; (5) checkpoint save and load preserves `reasoning_content`; (6) a dangling tool call is reconciled before the next request; (7) router timeout and fallback behave.

## 12. Data model

- `pii_vault` (4.5); `assistant_runs` (2.2); `assistant_operations` (2.3); `proposals` and `proposal_revisions` (M4); `user_assertions` (M4, 10.4).
- `analyses`: add `operation_id` (UNIQUE nullable), status values per 2.4, `jd_requirements_hash`, `scoring_config_version` (M4), partial unique index for open analyses.
- Keep `AgentActionLog` for legacy UI actions. The operations table is the audit record for server tools (keep it even though the activity-feed UI is cut).
- LangGraph checkpoint tables (async SQLite saver). Checkpoint state includes `agent_messages` (raw provider messages with `reasoning_content`, masked content only).
- One migration per commit, with a downgrade or a documented reason there is none.

## 13. Frontend (Next.js)

- SSE client over `fetch` and `ReadableStream`: batched rendering (at most once per animation frame), safe partial-markdown rendering, status labels, Stop button, history load, reconnect, `client_request_id` on every send, JSON fallback.
- `ConfirmationCard` driven by `ConfirmationRequest`: risk styling, server-resolved labels, expiry timer, handles duplicate-approve and conflict responses.
- Outcome cards using the 2.6 vocabulary; waiting-for-job state that survives refresh; diff review card with per-hunk accept/reject and claim warnings (M4); score delta card with `not_comparable` state (M4).
- Dispatcher reports acknowledgement and failure for UI actions. Remove `START_ANALYSIS` handling once `analysis_start` is live.

## 14. Configuration (env)

```
LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_AGENT=deepseek-flash, LLM_MODEL_ROUTER=deepseek-flash
LLM_THINKING_AGENT=enabled, LLM_REASONING_EFFORT=high, LLM_TIMEOUT_S, LLM_MAX_RETRIES
ROUTER_BACKEND=deepseek                  # deepseek | shadow (T4.6 adds Jev)
PII_MASKING_ENABLED=true, PII_VAULT_KEY, PII_VAULT_TTL_HOURS
PII_MASK_ENTITY_TYPES, PII_KEEP_ENTITY_TYPES
AGENT_MAX_STEPS=8, AGENT_MAX_TOOL_CALLS=12, AGENT_CONFIRM_TTL_MIN=30, UI_ACK_TIMEOUT_S=5
USER_DAILY_TOKEN_CAP
TRACE_BACKEND=langfuse|langsmith|none    # masked data only; auto-tracing off on the assistant path
WORKERS=1                                # startup refuses to boot above 1
```
`LlmClient` wraps the raw `openai` SDK on top of the gateway primitives: it accumulates streamed `content`, `reasoning_content` and `tool_calls` deltas, with timeout, retry with backoff, usage and cost accounting, a per-call thinking flag, the egress guard, and a recorded-response mode for tests.

## 15. Milestones and gates

**M1 Foundation.** Tool-to-service matrix, real authentication, privacy module, provider gateway with migration of reachable outbound calls, `LlmClient`.
- Gate: matrix reviewed and merged; cross-user tests between two student accounts pass and `X-Demo-Role` no longer changes identity; privacy targets (4.8) met; gateway static test and analysis-service leak test pass; provider contract tests pass.

**M2 Read-only assistant.** Router, run model, graph and checkpointer, read tools, streaming, `ui_action` with acknowledgement, frontend chat.
- Gate: personalized read questions ("what is my latest match score?") answer from tools; greetings answered without a model call; router and tool eval thresholds met; streaming tests (split placeholder at every boundary, cancel, disconnect, reconnect) pass; history and run-status endpoints work; duplicate `client_request_id` returns the same run.

**M3 One complete write flow (`analysis_start`).** Operations and approval, durable dispatch, job waiting, confirmation UI.
- Gate (real executor, crash injection): every row of the 2.5 table; kill after approve and before resume; kill after the analysis commit and before dispatch; kill after the claim; kill mid-job; duplicate approve; duplicate message; cancel before and after the claim; cross-user attempt; expired approval; late approve after supersede (zero mutations); leak test over the analysis_start path. Each asserts operation, approval, analysis and run status plus that the next message is answered.

**M4 CV proposal flow.** Proposals on existing versioning, claim preservation, reviewed apply, comparable score delta, flagship flow.
- Gate: base-version conflict detection; per-hunk reviewed apply that creates a new version; fabrication set thresholds (11); the flagship sentence completes with at most two confirmations, a per-hunk diff, flagged changed claims and a comparable delta (or an explicit `not_comparable`).
- After M4 (optional): Jev shadow router (T4.6), advisor tools.

## 16. Definition of done (every task and milestone)

Tests green (unit, integration, eval thresholds where relevant); no raw PII in any outbound request, log or trace for implemented paths; new tools registered with risk, roles and description; migrations included; `docs/ASSISTANT_V2_NOTES.md` updated with assumptions, skipped tools, accepted limitations (single worker, BackgroundTasks semantics) and known gaps. The freeze rule in 0.1 applies from the start of M3.
