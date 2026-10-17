# T1.4 — outbound provider gateway

All inventoried hosted model and embedding dispatches now live in `src/services/providers/gateway.py`. No LlmClient or new agent features were added. Existing caller results remain business records: the JSON caller restores allowed resource-scoped placeholders before matching, grounding and persistence; original CV evidence lines and line numbers remain authoritative.

## Migrated inventory

| Path | Gateway integration |
| --- | --- |
| `src/config.py` — `Settings.get_chat_model` | Returns `GatewayChat`; hosted SDK construction stays inside the gateway. |
| `src/services/llm.py` — `get_llm`, health ping, `invoke_json` | Gateway facade, cached health probes, masked requests, scoped business JSON restoration; parse errors never include output or retain JSON decoder documents. |
| `src/agents/gap_analysis/nodes/retrieve_context.py` | Pasted-JD fields masked before trusted prompt rendering; parsed requirements restored for business use. |
| `src/agents/gap_analysis/nodes/compare_gap.py` | CV/requirements/retrieval fields masked before numbered prompt rendering; JSON values masked without damaging syntax; original evidence retained. |
| `src/services/gap_analysis.py` | Background scope loaded from the stored analysis owner and CV/JD references; original source documents prime the identity dictionary before truncation. |
| `src/services/jd_recommendation.py` | Recommendation embedding query, career advice and parallel multi-JD scoring all use the gateway; API scopes come from verified users. |
| `src/services/jd_store.py` | OpenAI document/query embeddings, injected embedding adapters, local FastEmbed/Chroma inference, Chroma indexing/search and startup indexing. Every Chroma embedding function is explicitly gateway-owned; telemetry disabled. |
| `src/services/assistant/embedding.py`, `vector_store.py`, `indexer.py` | E5/hashing query and document embeddings use gateway dispatch. Local SDK weight loading lives in the gateway; download requests contain model configuration only. Chroma stays a local persistence adapter with no implicit embeddings. |
| `src/services/assistant/agent.py`, `src/api/assistant.py` | Structured generation, quoted history/page/source fields and whole graph execution protected. Raw fields are masked before XML rendering; user-visible message restoration occurs inside the scope. Model thought is never logged or restored. Health and reindex calls are attributed to the verified initiating user. |
| `src/agents/interview/nodes/score_answer.py`, `src/services/interview.py` | Scoring and retry use `invoke_json`; owner scope from verified submission; validation failures log fixed diagnostics. |
| `eval/run_rag_eval.py` | Judge/generator factories return gateway facades; structured judge dispatch and embedding scoring use the same boundary. |
| `scripts/demo_gap_analysis.py`, `scripts/demo_mock_interview.py`, assistant indexer CLI | Gateway runtime bootstrap initializes local privacy and only the usage table; does not reseed business data or mark other jobs failed. Demo graph calls are untraced. |

**Not migrated: none of the inventoried model/embedding call sites.** Non-model exclusions are reviewed in `tests/provider_import_allowlist.json`: two local Chroma adapters, local privacy NER, and the protected development-log uploader. There are no hosted-provider SDK or model HTTP exceptions. OCR/local CV extraction and keyword-only RAG do not dispatch models. Logging hooks and `.ai-log/` are untouched.

## Boundary and storage rules

- Masking is mandatory even for local embedding adapters. Disabled/uninitialized/broken privacy or unavailable accounting blocks dispatch. API errors are friendly 503 responses; existing analysis/interview fallbacks retain their business rules.
- Egress scans the complete final SDK request, including schemas, kwargs, tool messages and replayed reasoning, for email/phone/ID patterns and authenticated/detected identities. Narrow explicit detections are retained alongside broader NER spans so a bare name cannot leak at another occurrence. An additional dictionary pass covers fields visited before an identity was discovered.
- `PreparedPayload` is a server-side marker bound to its originating scope. Only trusted prompt/XML rendering of already-masked fields uses it. Final regex/dictionary masking and egress scanning still run; clients cannot supply this marker through JSON.
- Transient job/turn vaults encrypt originals, use random nonces and HMAC lookup indexes, enforce kind/origin/TTL scopes, and clear at scope exit. They are not checkpointed. Existing graphs have no checkpointer. Future persistent conversation graphs must use the persistent privacy vault and mask state before checkpointing.
- Automatic LangChain/LangSmith tracing, inherited callbacks, debug/verbose output and trace parents are disabled inside gateway and migrated graphs. SDK/storage diagnostic bodies, traceback data and logging extras are suppressed before logging handlers/exporters receive them, including SDK worker threads.
- Provider/JSON/schema errors expose fixed messages and safe stage labels. Reasoning/thought fields stay masked. Provider responses and raw HTTP error bodies never enter exception messages.
- The NER acronym exclusions `JD`, `JSON`, `API` preserve contract syntax and technical skills; explicit identity/name-label detection still takes priority.

## Usage and cost

`provider_usage` contains one durable row per physical attempt: opaque internal user ID, operation, status, input/output tokens, usage-known flag, USD cost and cost-known flag. Successful, failed, timed-out/cancelled and background attempts are covered. Startup/unauthenticated CLI work uses `system`; request and background work uses verified/stored ownership. Health cache hits do not dispatch or add charges.

SDK retries and model caching are disabled; gateway-owned transient retries preserve retry behavior while recording each attempt separately. Existing node logical-call counters remain separate from physical attempts.

Finite numeric provider-reported charges take priority. Otherwise configure deployment tariffs via `PROVIDER_INPUT_USD_PER_MILLION`, `PROVIDER_OUTPUT_USD_PER_MILLION`, `PROVIDER_EMBEDDING_USD_PER_MILLION`. Non-default chat-model overrides remain unpriced unless their provider reports the charge. Defaults are unknown, never asserted free. Local inference is known zero provider cost. Missing usage/price remains explicit; ledger failure blocks dispatch. No prices are guessed or hardcoded.

## Verification and measured delta

- Static source guard scans `src`, `scripts`, `eval`: provider SDK imports, dynamic imports, model REST surfaces and unreviewed HTTP dispatch. The non-model allowlist includes a justification for every exception; guard negative controls cover bypass patterns.
- Gateway units cover full-payload/reasoning scans, privacy failure, scoped/literal placeholder round trips, broader/narrower name spans, JSON errors, logging extras, inherited tracing, real LangChain structured transport, provider-reported charges and physical retry accounting.
- `tests/test_provider_leaks.py` uses the actual configured local NER and recording providers on all 72 annotated synthetic golden CV texts plus golden JDs. It requires both analysis provider calls to complete, stored evidence/revisions to restore originals, zero annotated identifiers in requests/logs/traces, and owner/system attribution for analysis, JD queries and startup indexing. A separate real background-job test verifies persisted JD parses and analysis evidence plus positive configured charges.
- Measured analysis score delta: **0.0 percentage points on all 72 CVs**, against unchanged rule anchors with the deterministic recording-provider harness. Existing analysis tests remain the regression gate. This is not a live-provider semantic-quality measurement; no paid provider calls were used.

This task does not waive the separate privacy detector shipping gates or human review of the synthetic set. The previous privacy benchmark/held-out-set status is unchanged; `eval/pii/real` has no reviewed CVs. Masking recall is measured, not a universal identifier-protection claim.
