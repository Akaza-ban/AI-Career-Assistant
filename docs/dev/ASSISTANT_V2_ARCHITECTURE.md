# CareerX Assistant v2: Architecture (rev 4.1, reduced scope)

> **For the implementing agent (Codex).** This file supersedes rev 3. Rev 4 cuts the assistant down to read-only capabilities: usage-guide Q&A, highlight, navigation, and (rev 4.1) short answers about the stored results of analyses and interviews with a link to the page. Everything about write tools, confirmation (HITL), operations, analysis dispatch, CV proposals and thinking-mode replay is removed. Read this whole file, then `docs/dev/Assistant_v2/REUSE_MAP.md` (created by task T0) and `docs/dev/Assistant_v2/TOOL_MATRIX.md` (from rev 3, still authoritative for business rules and which service functions are side-effect free), then the code your task names. Where this file conflicts with existing code, follow this file, but keep public API responses backward compatible until the frontend is migrated.

## 0. Working rules

1. **Read the repo before writing code, and reuse.** For every piece of work, first search the repo for an existing module, service function, route, component or hook that already does the job (examples: the current hybrid RAG, the `AgentAction` guard whitelists, the frontend action dispatcher, existing list/detail queries for CVs, JDs, analyses and interview sessions, the existing LLM service, the existing privacy module). Extend or wrap it. Add a new module only when no equivalent exists, and say why in the commit message and in `REUSE_MAP.md`. A new file that duplicates existing behavior is a defect.
2. **Freeze scope.** Build only what this file lists. A change after freeze must fix a failing test, a reproducible violation of the contract, or a changed external dependency, and gets a regression test. If something is ambiguous, pick the safer option (read-only, whitelist, template reply) and record it in `docs/dev/ASSISTANT_V2_NOTES.md`.
3. **Assistant code calls service functions and queries, never HTTP endpoints and never the DOM.** If the logic lives in a route handler, extract it into a service function first (pure refactor, behavior unchanged, tests green, own commit).
4. **Commit discipline (every task).** Before code, post a commit plan (commits, scope, tests each adds). One logical change per commit; every commit builds and passes `ruff` and `pytest`; tests ship with the code they cover or just before it. Migrations, pure refactors and docs get their own commits. Message format `type(scope): summary` (feat, fix, refactor, test, docs, chore, migrate). Never rewrite pushed history. No secrets in the repo. At the end, stop and report: commits, tests run and results, deviations, items added to `ASSISTANT_V2_NOTES.md`.
5. Do not break existing endpoints or tests.
6. **Paths.** `docs/dev/ASSISTANT_V2_ARCHITECTURE.md` (this file), `docs/dev/ASSISTANT_V2_NOTES.md`, `docs/dev/Assistant_v2/{TOOL_MATRIX,AUTH_NOTES,REUSE_MAP}.md`.
7. **The model never owns identity, ownership, URLs, selectors or route ids.** The server builds all of them from registries and owner-scoped database queries.

## 1. Goal and scope

**Goal.** An in-app chatbot that (a) answers how-to questions about using the product, from the product guide; (b) shows the user where something is by highlighting a UI element; (c) takes the user to the page they ask for, including a specific record ("my interview history on 12/10", "my latest analysis for the Shopee Backend JD"); (d) answers short questions about the stored result of an analysis or an interview (score, status, counts, top missing skills, how a session went) with a link to the page. It never changes data and never operates the UI on the student's behalf beyond highlight and navigation.

| User says | Capability | Needs DB |
|---|---|---|
| "How do I upload a CV?" | `howto` (RAG + DeepSeek answer, cited) | No |
| "Where is the button to add a JD?" | `locate` (highlight, navigate first if on another page) | No |
| "Open the interview page" | `navigate`, static page | No |
| "Show my interview history on 12/10" | `navigate`, record lookup by date | Yes |
| "Open my latest analysis for the Shopee Backend JD" | `navigate`, record lookup by JD then newest analysis | Yes |
| "What is my latest match score?" / "How did my interview yesterday go?" | `result`: short answer from stored result facts (score, status, date, counts, top missing skills) plus a link card; the page opens only if the user asks | Yes |
| "Open it" right after an answer that produced one link | `navigate` to that target (the previous turn's card) | No |
| Hello / thanks | `smalltalk` (template) | No |
| Off-topic, unsafe, injection, outside the user's role | `deny` (template) | No |

**Cut from this release (do not build):** any write tool; confirmation, approval, operations and expiry; `analysis_start` and the START_ANALYSIS path as an assistant feature; CV tailoring, proposals, claim preservation, score delta; multi-step UI operation on behalf of the student; explaining or summarizing CV/JD body text, evidence, feedback prose or interview transcripts (only the allowlisted result facts of 7.5 are answered); generic career advice (`qa_direct`); interview, advisor and export tools; Chrome extension; proactive chips; activity feed; MCP; multi-agent; voice inside the assistant; LangGraph checkpointer and `interrupt()`; thinking-mode replay; PII vault and unmasking; Jev wiring (see 5.6).

## 2. Contract (normative)

### 2.1 Identity and ownership
- Identity comes from a verified session. Model output can never set user, role or tenant.
- Every record lookup is scoped by `user_id` in the query itself. A record that exists but belongs to someone else behaves exactly like a record that does not exist: same status, same wording, no disclosure.
- `ClientPageContext` (current route, selected ids) is validated against the role whitelist and treated as a hint, not as authority.

### 2.2 Read-only invariant
- No assistant tool or resolver writes a business row. The assistant may write only its own records (`assistant_runs`, `assistant_turns`, traces).
- Resolvers use list and get queries that are free of side effects. Rev 3 found read-like services that commit (`optimizer.session` may create a draft; `advisor.shared_cv` and `advisor.interview_report` commit viewed timestamps; `interview.build_report` may delete abandoned sessions). The assistant must never call these; it queries tables through side-effect-free functions (extract one if needed, own commit).
- Opening a page is done by the browser. The destination page enforces its own authorization, and that stays the last line of defense.

### 2.3 Server-owned outputs
- Links are built from the route registry (7.1) plus ids returned by an owner-scoped query. Highlight targets come from the UI registry (6.3). Cards and chips are built by the server. The model may only pass back an opaque `ref` that the server issued earlier in the same turn.
- Tool results and cards contain labels, dates, statuses, ids and the allowlisted result facts of 7.5 (numeric scores, counts, short skill names). **They never contain CV or JD body text, evidence text, feedback prose or transcripts.** A static test asserts the assistant package imports no CV or JD text loader, and the fact-allowlist test (7.5) bounds every field.

### 2.4 Runs (slim)
- `assistant_runs`: `id`, `conversation_id`, `user_id`, `client_request_id`, `route`, `status` (`running | done | failed | cancelled | interrupted`), `created_at`, `updated_at`. Unique `(user_id, conversation_id, client_request_id)`.
- Every message carries a client-generated `client_request_id`; repeating it returns the existing run. At most one `running` run per conversation; a new message while one is running returns 409 (the user presses Stop first).
- Stop cancels the upstream request, persists partial text with `interrupted=true`, and sets `cancelled`. Client disconnect behaves the same.
- Startup sweep: `running` becomes `interrupted`.
- Deployment stays single worker (in-process cache and cancel registry). Record it in the notes. No boot-refusal logic is added.

### 2.5 Failure wording
Not found, ambiguous, forbidden and upstream failure are answered with server templates (vi/en), never with model prose that could imply success. Router and resolver failures never raise to the client as stack traces.

## 3. Request lifecycle

```
POST /assistant/chat
  1. auth + context hydrate (identity from session; ClientPageContext validated)
  2. run create/dedup by client_request_id (2.4)
  3. ROUTER (local, no LLM) -> RouterDecision                       [section 5]
        |-- smalltalk -> template
        |-- deny      -> template
        |-- clarify   -> template + chips
        |-- result    -> fast: resolver -> allowlisted facts -> templated answer + link card | agent: facts tool -> short grounded answer + link card   [section 7.5]
        |-- howto     -> mask -> hybrid RAG -> abstain | DeepSeek answer (stream) + citations + attached highlight/navigate   [section 6]
        |-- locate    -> UI registry match -> highlight (+ navigate first)                                                  [section 6.3]
        '-- navigate  -> fast path: slots -> resolver (DB) -> link card/chips + navigate action
                         agent path (only when slots are incomplete or compound): DeepSeek with read-only tools             [sections 7, 8]
  4. output guard (placeholder leakage, forbidden markers, whitelisted events)
  5. persist turn; stream final event
```

The pipeline is a plain async function `handle_turn()`. If the repo already structures the assistant as a LangGraph graph, keep that structure (smaller diff) but add no checkpointer and no `interrupt()`. T0 records which case applies.

## 4. Privacy (reduced to what the new scope sends out)

What can leave the server: the user's chat message (and the last 2 exchanges for `howto`), retrieved guide chunks (our own docs), masked resource labels in agent-path tool results, and the allowlisted result facts of 7.5 (scores, counts, dates, short skill names) on the agent path only. CV and JD body text, evidence, feedback prose and transcripts never leave through the assistant (2.3).

- **4.1 Guarantee wording.** "Direct identifiers are masked locally before provider calls, with measured recall on our evaluation sets and an egress scan as a last line." No universal claims; no claims about vendor retention or training beyond what a vendor term says.
- **4.2 One outbound gateway.** Every LLM call and every embedding call reachable from the assistant goes through one gateway: masking, egress scan, usage and cost accounting, exception sanitization, tracing policy. A static test asserts no other module imports a provider SDK or makes outbound model HTTP calls. Reuse the existing gateway/privacy module if T0 finds one; do not write a second.
- **4.3 Mask-only.** Masking is one-way for the assistant path: no vault, no placeholder resolution, no unmask, no `StreamUnmasker`. Any `[[...]]` placeholder that appears in model output is replaced by a neutral word (`bạn` / `you`) before emission. Server-built cards and chips use unmasked labels straight from the database and never pass through the model.
- **4.4 What to mask.** Person names, email, phone (VN and international), street addresses, date of birth, national ID, passport-like numbers, personal profile URLs and handles. Keep employers, schools, job titles, skills, city and country. Detection layers: (1) known identity of the authenticated user (name, email, phone, diacritic-insensitive and reversed-order variants), (2) regex for email, phone, IDs, URLs, handles, labeled DOB and address lines, (3) NER only if the existing privacy module already has it. Resource labels (CV filenames often contain a real name) go through the same masker before the model sees them. Escape literal `[[` in inbound text.
- **4.5 Fail-safe.** If masking throws, do not call the provider; return a friendly error. `PII_MASKING_ENABLED` defaults true. The egress guard scans the full outbound payload for emails, phones, ID patterns and the known-identity dictionary and blocks the call on a match.
- **4.6 Telemetry.** Traces, logs and exceptions carry masked data only. Auto-tracing is off on the assistant path.
- **4.7 Acceptance for releasing the assistant.** Numeric targets on `eval/pii/` message-style fixtures (recall >= 0.99 email, phone, ID; >= 0.92 names and addresses; false positives on skills, employers, schools < 3%) plus the leak test: run the assistant pipeline with a recording provider and assert zero direct identifiers in any recorded request, log line or trace, and that every result fact in a recorded request is on the allowlist. The stricter **privacy shipping gate** from rev 3 (human-reviewed annotations, 10+ hand-anonymized real CVs in `eval/pii/real/`) still governs every feature that sends CV text to a provider (analysis, optimizer, interview). It is not required for releasing this assistant, because the assistant sends no CV text, only allowlisted result facts. If that changes, the gate applies again.
- **4.8 Uniform provider policy (unchanged in principle).** Every vendor that receives user-derived text gets masked text only and the same bar. Record the DPA review table in the notes (retention, deletion on exit, subprocessors and transfer, training on customer data, ZDR, prompt confidentiality). DeepSeek publishes no retention period or ZDR tier and stores data in China; the residual risk is accepted explicitly and stated in product copy, including that scores and results are sent to the provider when the user asks about them. Prefer ZDR if offered at no extra cost; it is not a gate. Data minimization is the main control: the router sends nothing (it is local), and the model sees one masked message plus compact results.
- **4.9 Teammate-owned OCR, STT, TTS.** Not part of the assistant. Codex review of that code (T1.3a) continues as a separate task and blocks releasing those features, not the assistant.

## 5. Router (`src/services/assistant/router/`)

The router is local Python. It uses no LLM and no network call. DeepSeek is never asked which route a message belongs to.

### 5.1 Decision model
```python
class RouterDecision(BaseModel):
    route: Literal["smalltalk", "howto", "locate", "navigate", "result", "clarify", "deny"]
    source: Literal["stage0", "cache", "rules", "classifier", "fallback"]
    confidence: float                       # 0..1
    language: Literal["vi", "en", "mixed"]
    deny_reason: Literal["off_topic", "unsafe", "injection", "out_of_role"] | None = None
    slots: NavSlots | LocateSlots | None = None
    nav_mode: Literal["fast", "agent"] | None = None    # applies to navigate and result
    clarify_question: str | None = None

class NavSlots(BaseModel):
    target: Literal["page", "cv", "jd", "analysis", "interview", "report"] | None
    page_hint: str | None          # raw words, matched against the route registry
    when_expr: str | None          # raw date expression ("12/10", "hôm qua"); parsed at resolve time
    latest: bool = False
    jd_ref: str | None
    cv_ref: str | None
    free_ref: str | None
```
Routing is by required capability, not by verb. Slots hold raw text; parsing relative dates happens in the resolver with today's date, so cached decisions stay valid across days.

### 5.2 Normalization
NFC, lowercase, collapse whitespace, and a diacritic-folded copy (`unidecode`-style, handles `đ`). Language detection by character set and a small stopword list (vi/en/mixed). All matching below runs on the folded copy, so "mo trang phong van" and "mở trang phỏng vấn" behave the same.

### 5.3 Stages (stop at the first confident result)
- **Stage 0, deterministic:** empty or oversized input; injection patterns; role-forbidden terms; greetings and thanks (templated vi/en). Candidate-chip clicks arrive as structured payloads, never as text.
- **Stage 1, cache:** in-process LRU with TTL. Key: `sha256(folded text | role | page_route_id)`. Value: the `RouterDecision` only (never resolved records). Store only decisions from rules or classifier above threshold.
- **Stage 2, rules:** lexicons and regex for `locate` ("ở đâu", "nút ... đâu", "where is", "chỉ cho mình"), `navigate` (verbs such as "mở", "đi tới", "chuyển tới", "cho xem", "xem lại", "open", "go to", "show me", "take me" plus an entity noun: CV, JD, phân tích, phỏng vấn, báo cáo, trang), `result` (outcome questions about an analysis or interview: "điểm", "kết quả", "đạt bao nhiêu", "thiếu kỹ năng gì", "trạng thái", "score", "how did ... go"), and `howto` ("làm sao", "cách", "hướng dẫn", "how do I", "how to"). One family matching gives confidence 0.95; several families matching, or none, pass to stage 3. Precedence on conflict: deny, locate, navigate (an open verb such as "mở" or "open" beats result words), result, howto. The slot extractor runs here for `navigate`/`locate`.
- **Stage 3, lightweight classifier:** TF-IDF character n-grams (2 to 5, `char_wb`) on the folded text plus a linear classifier with calibrated probabilities (scikit-learn). Labels are the seven routes plus `off_topic` mapped to `deny`. Accept when top-1 probability >= `ROUTER_CLF_THRESHOLD` and the margin over top-2 >= `ROUTER_CLF_MARGIN`. Train offline from `eval/router/train.jsonl`; commit the training script and the artifact with version and content hash; load at startup; if the artifact is missing, skip the stage and log once. Challenger (only if this misses the 5.5 thresholds): embedding kNN over labeled exemplars using the embedder the repo already has. Do not build the challenger preemptively.
- **Stage 4, fallback (no LLM):** if navigate or locate vocabulary is partly present, return `clarify` with 2 to 4 chips (for example the pages that vocabulary could mean). Otherwise route `howto`; the RAG abstains on a low retrieval score and replies with the capability menu. Ambiguity is safe because nothing in this release writes.

`nav_mode` (navigate and result): `fast` when `target` is known, every present qualifier is parseable locally and, for `result`, the question asks for a single known metric (score, status, count, date); otherwise `agent`.

### 5.4 Context
The router sees one message plus `ClientPageContext` and the previous turn's card targets. One deictic follow-up is resolved: a bare open intent ("mở đi", "mở trang đó", "open it") right after a turn that produced exactly one target becomes `navigate` to that target. Every other deictic follow-up ("that one", "the previous one", "what about the one before") goes to `clarify`. Card targets are persisted with the turn (T0 checks whether `assistant_turns` already stores cards). Report the follow-up subset in the eval so the gap is measured, not guessed.

### 5.5 Acceptance
`eval/router/` with 350+ labeled utterances, at least 60 of them `result` (vi, en, mixed; per role; adversarial; ambiguous; no-diacritic typing; typos), split train/dev/held-out 60/20/20, held-out frozen before tuning. The team adds 100+ real utterances (collected from teammates and the student interviews) to the held-out set; synthetic-only accuracy is not reported as quality. Thresholds: overall accuracy >= 0.93; `deny` recall >= 0.97 on unsafe and injection; slot extraction exact match >= 0.90 on the navigate subset; confusion matrix reported with `navigate <-> howto`, `locate <-> howto` and `result <-> navigate` tracked separately; router p95 (stages 0 to 3, cache miss) < 30 ms.

### 5.6 Jev (not in this release; do not wire it into `src/`)
Jev is considered only if a benchmark shows it beats the local router on accuracy, speed or cost. The local router costs nothing and runs in milliseconds, so speed and cost cannot be beaten by a network call with a per-token fee; the realistic criterion is accuracy on the hard subsets. Benchmark rules (task T2.4, optional, needs a key from Harry):
- The adapter lives only in `eval/` (for example `eval/router_bench/jev.py`), same dataset, same held-out split, same metrics and latency measurement as the local router.
- Adopt only if, on the vi and mixed held-out subsets, Jev is at least 2 points more accurate than the local router overall, or clearly better on the ambiguous and no-diacritic subsets, with `deny` recall not lower, and the follow-up subset reported (Jev would see only the current masked message).
- If adopted, Jev becomes a stage-3 fallback for low-confidence cases only; it never replaces stages 0 to 2. It receives one masked message and falls under 4.8; the DPA findings recorded in rev 3 apply.
- The decision and the numbers go in `ASSISTANT_V2_NOTES.md`.

## 6. How-to Q&A and highlight

### 6.1 Retrieval and answer
- Reuse the existing role-aware hybrid RAG (ChromaDB + BM25). Do not rebuild it. Changes allowed: chunk metadata (`ui_targets`, `route_id`), an abstain threshold, a version stamp (`docs_version`).
- Abstention is decided from the retrieval score before generation. On abstain, reply with the capability menu template and no model call.
- Generation: DeepSeek V4.1 Flash (`deepseek-flash`), non-thinking, streaming, no tools, one call. The prompt contains the masked question, the last 2 exchanges (masked), and the retrieved chunks wrapped in `<untrusted_document>`. Rules: answer only from the chunks, at most 6 steps, say so when the chunks do not cover the question, make no claim about the user's own data, answer in the user's language.
- Citations come from retrieval results, never parsed from model text.
- **Answer cache:** key `sha256(folded query | role | language | docs_version)`, TTL `RAG_ANSWER_CACHE_TTL_S`. Answers derive only from the guide, so the cache is shared across users; the key never contains resolved user data.

### 6.2 Attached actions
After generation, if the top retrieved chunk has `ui_targets` or `route_id` and its score >= `RAG_UI_THRESHOLD`, the server attaches a `highlight` or `navigate` action drawn from that chunk's metadata and whitelisted for the user's role. The model's text never decides this.

### 6.3 UI registry and highlight
- `ui_registry` maps `element_id` to `{route_id, roles, labels_vi, labels_en, aliases}`. Elements carry `data-assistant-id="<element_id>"` in the frontend.
- `locate` matches the folded message against labels and aliases (fuzzy, threshold, top-1 margin). No match goes to `howto`. If the element is on another page, emit `navigate` then `highlight`.
- Reuse the existing spotlight, tour or highlight component and the existing action dispatcher and guard whitelists if they exist. Build a minimal overlay only if T0 finds none.
- A drift test fails when a registry `element_id` has no matching `data-assistant-id` in the frontend source, or the reverse.
- `ui_action` payloads are a discriminated union of exactly two variants: `highlight{element_id}` and `navigate{route_id, params}`. Both are validated server-side against the registries and the role. Delivery acknowledgement is not required: the server's reply text is templated ("Đây là nút bạn cần tìm"), and navigation cards keep a manual button as fallback.

## 7. Navigation

### 7.1 Route registry
One backend registry (reuse the existing route whitelist behind `AgentAction`; extend it, do not duplicate): `route_id -> {path_template, roles, labels_vi, labels_en, aliases, params}`. Examples: `cv_list`, `cv_detail{cv_id}`, `jd_list`, `jd_detail{jd_id}`, `analysis_detail{analysis_id}`, `interview_home`, `interview_history`, `interview_session{session_id}`, `interview_report{session_id}`. T0 lists the real frontend routes; the registry mirrors them, and a drift test compares the registry with the Next.js route files.

### 7.2 Which requests need the database
Static pages (`page` target) need no query. Record-level requests do, and the query is always owner-scoped:

| Request | Query shape (all with `user_id = :uid`) |
|---|---|
| Interview history on a date | sessions whose start time falls in `[day 00:00, day 24:00)` in `ASSISTANT_TZ`, converted to the stored timezone; ordered newest first |
| Latest analysis for JD "xxx" | resolve the JD by fuzzy title/company among the user's JDs; then analyses for that JD, newest `completed` first (if none completed, the newest with its status shown) |
| Analysis for CV "yyy" and JD "xxx" | resolve both by fuzzy name; analyses for that pair; newest first |
| A CV by name, or "my newest CV" | the user's non-deleted CVs, fuzzy name or most recently updated; version family head |
| A JD by name | the user's JDs, fuzzy title/company |

Reuse existing list and get queries or service functions (T0 maps them); add a function only when none exists. Add an index only when `EXPLAIN` on realistic data shows a scan, in its own migration commit.

### 7.3 Resolver contract
`resolve(ctx, slots) -> ResolveResult{status: found | multiple | none | needs_info, targets: list[Target]}`, `Target{ref, route_id, params, label, sublabel}`. No LLM inside.
- `found` (one target): emit `navigate` plus a link card (label, sublabel such as "Backend_v3 vs Shopee Backend Engineer, 12/10 14:20, completed") with a manual "Open" button.
- `multiple` (up to 5): chips, each a server-built link. Clicking a chip is plain navigation; the destination page enforces authorization.
- `none`: say what was searched ("không có buổi phỏng vấn nào ngày 12/10"), offer the 2 nearest dates or the user's 3 most recent records, and a link to the list page.
- `needs_info`: `clarify` with chips.
- Fuzzy matching: diacritic-folded `rapidfuzz` (add the dependency only if absent), top-1 must lead top-2 by a margin or the result is `multiple`.
- Date parser (local, `ASSISTANT_TZ=Asia/Ho_Chi_Minh`): `dd/mm`, `dd/mm/yyyy`, `dd-mm-yyyy`, "ngày 12 tháng 10", "12 tháng 10", "12th October", "hôm nay", "hôm qua", "hôm kia", "tuần trước", "tháng trước", "yesterday", "last week". No year means the current year, and a future date means the previous year. Use `dateparser` only if it is already a dependency; otherwise a small parser covering exactly this list. Ranges ("tuần trước") return a date range.

### 7.4 Fast path and agent path
- **Fast path** (`nav_mode=fast`): router slots go straight to the resolver. No LLM call. Target p95 < 300 ms.
- **Agent path** (`nav_mode=agent`): used when the target is unknown, a qualifier cannot be parsed, or the request mixes capabilities ("show me how to add a JD and open that page"). See section 8.

### 7.5 Result answers (facts + link)

Purpose: a quick answer to "what was the result" questions about an analysis or an interview, with a link to the page. Summary level only: the assistant reads stored result figures, never evidence, feedback text or transcripts.

- **Flow:** router `result` -> resolver (7.3) finds the record -> facts service returns allowlisted facts -> answer + facts card + link card.
- **Facts service** (`src/services/assistant/facts/`): one read-only function per record type, scoped by `user_id` inside the query, wrapping the existing services that already compute scores and reports (extract side-effect-free versions where 2.2 applies). It builds its output from `facts_allowlist` (a data file finalized from the T0 proposal against the real schema), not by filtering a larger object, so a field that is not listed cannot be returned by mistake. Expected content. Analysis: status, `created_at`, CV version label, JD label, overall match score, per-category scores, counts of required and preferred requirements matched and missing, up to 5 missing skill names. Interview: `started_at`, status, position label, number of questions, overall STAR score, per-criterion averages, and the overall score and date of the previous session for the same position when one exists. Every string field is at most `RESULT_FACTS_MAX_FIELD_CHARS` (default 80) and none is free text (no answers, feedback, evidence, transcripts, CV or JD text).
- **Fast path** (`nav_mode=fast`: a single known metric such as score, status, count or date): the answer is a server template filled from the facts. No LLM and nothing leaves the server. Example: "Lần phân tích gần nhất cho JD Shopee Backend (12/10, CV Backend_v3): điểm match 72/100, còn thiếu 3 kỹ năng bắt buộc."
- **Agent path** (anything else, such as "mình yếu ở đâu trong buổi phỏng vấn hôm qua?" or "so với lần trước thì sao?"): the agent calls `get_result_facts(ref)` for refs the resolver issued and writes at most 4 sentences. Prompt rules: use only numbers and names from the tool result; do not explain why a score is what it is beyond the listed fields; never claim or promise improvement; for deeper detail point to the page ("bằng chứng chi tiết nằm ở trang phân tích").
- **Numeric grounding guard (server, deterministic):** every number in model prose must appear in the facts (same value after normalization, percent form included). On a violation the prose is dropped, the template answer is shown instead, and the event is logged for the eval. The facts card (exact figures from the database) is always shown next to any prose, so the user never has to trust the model's arithmetic.
- **Records:** "latest" picks the newest and the answer names its label and date so the user can verify; several matches (for example two sessions on one date) give chips and no answer until one is chosen; none gives the template from 7.3. A comparison between two analyses is shown as two sets of figures with no delta, because analyses are not guaranteed to share scoring criteria in this release.
- **Link:** every result answer carries a link card per referenced record with an Open button. There is no automatic navigation, since the user asked a question and did not ask to leave the chat. A following bare "mở đi" or "open it" is handled by the 5.4 rule and emits the normal `navigate` action.
- **Privacy:** this is the only place structured user results can reach the provider, and only on the agent path. Labels are masked (4.4); numbers and dates are not. The product copy must say that results are sent to the provider when the user asks about them (4.8).

## 8. Agent path (DeepSeek V4.1 Flash)

A small read-only loop. It exists for requests the local slot extractor cannot finish; it is not a second router.

- Model: `deepseek-flash` through the raw `openai` SDK inside one `LlmClient`. **Non-thinking mode, temperature 0, no `reasoning_content` handling.** If thinking mode is ever enabled for this loop, the rev 3 replay contract (section 6 there) applies first.
- Limits: `AGENT_MAX_STEPS=4`, `AGENT_MAX_TOOL_CALLS=6`, `MAX_RETRIES_PER_TOOL=2`, duplicate-call detection, daily token cap per user.
- Tools (all read-only; they wrap the section 7 resolvers and the section 6 retrieval and registries, no new query logic): `find_cv`, `find_jd`, `find_analysis`, `find_interviews`, `get_result_facts(ref)` (the allowlisted facts of 7.5), `search_docs`, `open_target(ref)`, `highlight(element_id)`. The route registry's page list (about 15 entries) is part of the system prompt.
- Tool results: `{ok, summary (<= 300 chars), data (compact, masked labels + opaque refs), error{code, message, hint}}`. Codes: `INVALID_ARGS`, `NOT_FOUND`, `AMBIGUOUS`, `UPSTREAM_FAILED`, `RATE_LIMITED`, `BUDGET_EXCEEDED`. A `ref` the server did not issue this turn returns `NOT_FOUND`.
- `open_target` and `highlight` only record an intent; the server validates it (registries, role, ownership via the issuing query) and emits the `ui_action`. The model's closing text is limited to one or two sentences (up to four for result answers, 7.5); cards and links come from the server.
- Untrusted content: labels and titles are user-controlled and are wrapped in `<untrusted_document>`. Because no tool writes, the worst successful injection is a wrong link or highlight; links are still built only from the registry plus ids the owner-scoped queries returned.

## 9. Streaming (`text/event-stream`)

- Stream `howto` generation token by token. Agent-path text streams the same way. Templates go out as one `token` then `final`. Cards, chips and `ui_action` events are separate server-validated events, never model text.
- Events (monotonic `id` per run): `route`, `status` (`thinking | searching | resolving`), `token`, `citations`, `card`, `ui_action`, `notice`, `final`, `error`, `heartbeat` (15 s). Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
- Guard before emission: per-chunk check for placeholder leakage and forbidden markers (hold back text from an unmatched `[[` until `]]`, then replace with the neutral word); events validated against whitelists.
- Guard after emission (advisory): groundedness of the streamed answer is recorded for the eval; a failure appends a `notice` event and does not retract text.
- Cancel and disconnect: see 2.4. Reconnect replay is not built; after a drop the client loads persisted state.
- Required endpoints: `POST /assistant/chat` (SSE, plus the existing non-streaming JSON mode for backward compatibility), `POST /assistant/runs/{id}/cancel`, `GET /assistant/conversations/{id}/history`, `GET /assistant/runs/{id}`. The existing `getConversationHistory` points at an endpoint that does not exist; fix it.

## 10. Frontend (Next.js)

Reuse the existing chat widget, dispatcher and guard code. Add: SSE client over `fetch` and `ReadableStream` (batched rendering at most once per animation frame, safe partial markdown, Stop button, `client_request_id` on every send, JSON fallback); link card and chips; highlight overlay (6.3); capability-menu and clarify templates. Remove the `START_ANALYSIS` confirmation handling from the assistant path once nothing else calls it (T0 verifies; the legacy `POST /assistant/action/confirm` is left alone unless T0 shows it is dead).

## 11. Evaluation

- Datasets in `eval/`: `router/` (5.5), `nav/` (seeded-database fixtures and utterances with expected targets), `results/` (seeded-database fixtures, questions, expected facts and answers), `howto/` (reuse the existing retrieval benchmark and add 30+ out-of-corpus queries), `injection.jsonl` (including malicious JD and CV titles), `pii/` (4.7).
- Runner: `python -m eval.run --suite all` prints a metrics table and exits non-zero below thresholds.
- Thresholds: router (5.5); resolver correctness on seeded fixtures = 1.0 for deterministic cases (dates including 23:30 and 00:30 local-time boundaries, no-diacritic names, duplicate names, none, multiple); cross-user probes = 100% `none` with no disclosure; agent-path correct target >= 0.85 on 40+ cases and step cap never exceeded; share of navigate turns served by the fast path reported (target >= 0.7, informational); howto Recall@k and NDCG@k not below the existing benchmark, abstention precision >= 0.9 on out-of-corpus queries; result answers: fast-path figures equal the database values in 100% of 60+ seeded cases, correct record >= 0.95, the numeric grounding guard catches 100% of planted wrong numbers, no non-allowlisted field in any recorded provider request, cross-user probes 100% `none`; injection success = 0; PII leak count = 0 in recorded provider requests; howto p95 end-to-end < 4 s; navigate fast-path p95 < 300 ms; agent-path p50 and p95 recorded, target set from the measurement.
- Recorded fixtures run in CI and catch regressions in our code; a separate live run (manual or nightly) measures current model behavior. Do not report recorded results as model quality. Resolver and isolation tests run against real services and a real (test) database, never a fake.
- Provider contract tests (nightly, real API; recorded in CI): (1) a non-thinking streamed completion with the system prompt works; (2) a non-thinking tool-calling loop of 3 steps works; (3) streaming and non-streaming persist identical text; (4) timeout and retry behave; (5) the egress guard blocks a planted identifier.

## 12. Data model

- `assistant_runs` (2.4); `assistant_turns` (existing; extended only if needed to persist card targets, 5.4). That is all.
- Not created in this release: `assistant_operations`, `proposals`, `proposal_revisions`, `user_assertions`, `pii_vault`, LangGraph checkpoint tables, `analyses.operation_id` and the partial unique index for open analyses. If T0 finds that earlier tasks already created any of these, leave them in place, do not use them from the assistant, and record them in the notes for a separate cleanup decision.
- One migration per commit, with a downgrade or a documented reason there is none.

## 13. Configuration (env)

```
LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_AGENT=deepseek-flash, LLM_THINKING_AGENT=disabled
LLM_TIMEOUT_S, LLM_MAX_RETRIES
ROUTER_BACKEND=local                       # the only supported value in this release
ROUTER_CLF_THRESHOLD, ROUTER_CLF_MARGIN, ROUTER_CACHE_TTL_S, ROUTER_CACHE_MAX
RAG_ANSWER_CACHE_TTL_S, RAG_ABSTAIN_THRESHOLD, RAG_UI_THRESHOLD
AGENT_MAX_STEPS=4, AGENT_MAX_TOOL_CALLS=6
ASSISTANT_TZ=Asia/Ho_Chi_Minh
RESULT_FACTS_MAX_FIELD_CHARS=80
PII_MASKING_ENABLED=true, PII_MASK_ENTITY_TYPES, PII_KEEP_ENTITY_TYPES
USER_DAILY_TOKEN_CAP
TRACE_BACKEND=langfuse|langsmith|none      # masked data only; auto-tracing off on the assistant path
OCR_BACKEND, STT_PROVIDER, TTS_PROVIDER    # teammate-owned, outside the assistant
```
`LlmClient` wraps the raw `openai` SDK on top of the gateway: streamed `content` and `tool_calls` accumulation, timeout, retry with backoff, usage and cost accounting, the egress guard, and a recorded-response mode for tests. Reuse the existing LLM service where it can be adapted.

## 14. Milestones and gates

**M1 Foundation-lite.** T0 audit and reuse map; real authentication (identity from session; `X-Demo-Role` no longer changes identity) if not already done; gateway, mask-only masker, egress guard, `LlmClient` (non-thinking); slim `assistant_runs`; history endpoint fix.
- Gate: `REUSE_MAP.md` reviewed; cross-user test between two student accounts passes; static test (no provider SDK outside the gateway) passes; leak test with a recording provider passes; masking targets (4.7) met on message-style fixtures; provider contract tests (1), (4), (5) pass.

**M2 Local router.** Dataset and harness, stages 0 to 2 with cache, classifier, thresholds tuned on dev, held-out measured once.
- Gate: 5.5 thresholds met on the held-out set including the team-supplied real utterances; router p95 target met. Optional T2.4 (Jev benchmark) does not block M3.

**M3 How-to and highlight.** Guide RAG changes, answer cache, DeepSeek streaming, citations, attached actions, UI registry and highlight, SSE endpoints, frontend chat.
- Gate: howto thresholds (11); streaming tests (split placeholder at every chunk boundary, cancel, disconnect) pass; duplicate `client_request_id` returns the same run; registry drift tests pass; greetings and deny answer without a model call.

**M4 Navigation and results.** Route registry, date parser, resolvers with DB, fast path, cards and chips, result facts and answers, agent path.
- Gate: resolver and isolation thresholds (11) pass on the real test database; agent-path thresholds met; injection set passes; the example requests in section 1 work end to end in the UI; result thresholds (11) pass.

## 15. Definition of done (every task and milestone)

Tests green (unit, integration, eval thresholds where relevant); no raw direct identifiers in any outbound request, log or trace on the assistant path; reuse recorded in `REUSE_MAP.md` (no duplicate module introduced); migrations included; `docs/dev/ASSISTANT_V2_NOTES.md` updated with assumptions, deferred items, accepted limitations (single worker, only the bare open-intent follow-up is resolved, mask-only privacy model, advisor role limited to static pages and how-to unless T0 shows an existing advisor route whitelist) and known gaps. The freeze rule in 0.2 applies from the start of M3.
