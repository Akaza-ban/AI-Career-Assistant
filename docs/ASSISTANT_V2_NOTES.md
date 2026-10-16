# Assistant v2: T1.5 and M1 gate (2026-10-14)

## T1.3 revalidation on current HEAD (2026-10-14)

T1.3's extraction, four detector layers, masking/escaping, scoped Fernet vault,
TTL/deletion, standalone migration and 72-CV synthetic harness already exist.
This follow-up adds bounded edit-distance matching of authenticated names for
OCR corruption, with seven regression cases. See the
[implementation and validation notes](dev/ASSISTANT_V2_NOTES.md#t13-revalidation--2026-10-14).
Provider wiring and streaming unmasking are outside this change.

The fresh [CPU benchmark](../eval/pii/results/t1_3_current.json) was started at
`2026-10-14T12:07:25Z` using local model weights, portable Tesseract 5.5.3 and
`vie+eng` data. All **72 PDFs extracted successfully**: 36 text PDFs and 36 scans,
24 CVs per language (VI/EN/mixed), plus 18 auxiliary fixtures and annotated
filenames. No cloud OCR or hosted inference was used. The report records source
and dataset hashes; previous reports are retained as historical evidence.

NER-only strict metrics, without the other three layers or preservation filters:

| NER | PERSON recall | PERSON precision | ADDRESS recall | ADDRESS precision | PERSON+ADDRESS micro recall |
|---|---:|---:|---:|---:|---:|
| underthesea 9.5.0, packaged CRF | 76.50% | 12.73% | 0.00% | 0.00% | **57.37%** |
| PhoBERT `Phuc2005/pii-phobert-base-ner`, revision `fc4d654b9906dafb34ea670b9b14c2360e4d3be3` | 6.41% | 18.29% | 0.00% | 0.00% | 4.81% |
| spaCy 3.8.16, `xx_ent_wiki_sm` 3.8.0 | 45.30% | 38.13% | 0.00% | 0.00% | 33.97% |

**Selected: underthesea**, by the highest measured PERSON+ADDRESS micro recall.
Its standalone precision is poor; all four layers and preservation filters remain
required. The model loads once at startup, CPU only; inference/model failures
raise typed errors rather than silently switching models or returning raw text.

Full selected pipeline, with an empty known-identity dictionary for the benchmark:

| Entity | Raw recall | Raw precision | PDF/OCR recall | PDF/OCR precision |
|---|---:|---:|---:|---:|
| EMAIL | 100.00% | 100.00% | 100.00% | 100.00% |
| PHONE | 100.00% | 100.00% | 100.00% | 100.00% |
| ID | 100.00% | 100.00% | 100.00% | 100.00% |
| PERSON | 98.72% | 93.90% | 97.44% | 93.44% |
| ADDRESS | 100.00% | 100.00% | 100.00% | 100.00% |
| DOB | 100.00% | 100.00% | 98.61% | 100.00% |
| URL | 100.00% | 100.00% | 100.00% | 100.00% |
| HANDLE | 100.00% | 100.00% | 100.00% | 100.00% |

False positives on skills, employers and schools: **0%** in both modes. All
requested numeric targets pass for the selected pipeline on this draft set;
the thresholds are unchanged. OCR metrics measure masking of aligned extracted
text, not perfect transcription. The benchmark has no supplied identities and
does not measure the new fuzzy identity pass; that pass has regression tests.

**Shipping gate: FAIL**, and benchmark exit code is **1**. The synthetic data
remain `needs_human_review`; held-out real-format count is **0**, with the required
empty-directory warning. Team annotation review and 10+ supplied real-format CVs
remain necessary. No real CVs were invented and no target was waived.

Independent privacy tests: **56 passed, 1 application-lifespan test deselected**;
privacy/eval Ruff, changed-file formatting, compilation and diff checks pass.
Normal pytest cannot collect because current HEAD declares `AuthSession` twice
for `auth_sessions`; vault/migration/startup tests are therefore not revalidated.
Full Ruff also has six pre-existing auth/roadmap/seed merge errors. These are
reported rather than counted as passes or changed as part of privacy work.
No new commits were made because the repository requires full-suite/lint success
before committing. Original T1.3 commits remain in history, including standalone
migration `a9c3309`. User architecture/prompt edits and protected hooks/logs were
left untouched.

Previous foundation notes remain in [the development notes](dev/ASSISTANT_V2_NOTES.md).
This task explicitly requests this report at `docs/ASSISTANT_V2_NOTES.md`.

## Implementation

`src/services/providers/llm_client.py` provides one raw `AsyncOpenAI` client over
T1.4's scope, masking, egress, telemetry and durable usage primitives. The agent
path does not use LangChain chat/message wrappers. The static boundary now permits
the raw SDK only in the gateway and this client; other providers remain prohibited
in the client. Existing legacy gateway callers are unchanged.

`chat()` returns the exact `message.model_dump(exclude_none=True)` dictionary,
including unknown provider extensions, reasoning and tool calls. `chat_stream()`
emits internal `ContentDelta`, `ReasoningDelta`, `ToolCallDelta(index, arguments,
id, name)` and `Done(message)` events. It accumulates raw argument strings by
index, orders completed calls by index, and retains reasoning and content.
`parse_tool_arguments()` accepts only a completed message and returns decoded
objects without changing the original strings. Pydantic argument schema validation
belongs to the later tool executor.

Reasoning/tool events are internal and must not be forwarded to user SSE or logged.
Use `aclose()` on the client and on an abandoned stream. Cancellation and stream
closure close the upstream response and finish its ledger row. No incomplete
stream emits Done. SDK retries are disabled; client retries transient failures and
timeouts with exponential backoff, with one ledger row per physical attempt. It
never retries a stream after delivering a delta or an HTTP 400 reasoning error.
Provider exception bodies are suppressed; only status and fixed diagnostic text
escape. Accounting finishes before Done is released.

Thinking is selected per call through `extra_body`, with effort from settings.
Temperature is omitted in thinking mode. Agent/router model names, timeouts,
retries and all remaining section 14 settings are environment driven. `WORKERS`
above one fails settings validation. Daily caps, graph budgets and router backend
are settings only here; their enforcement belongs to later milestones.

The full outbound body, including schemas and replayed reasoning, passes the
egress scan before every attempt. Raw user/system input is escaped and masked;
assistant replay is required to already be masked and is rejected if masking
would change it. Callers can provide `scope.prepared(masked_messages)` for a fully
masked checkpoint log. Keep the same authorized privacy scope when using its
transient tokens; persistent conversation-vault/checkpoint integration is M2.
Never restore reasoning or tool arguments through unrestricted vault lookup.

Configured provider tariffs cover the configured agent/router models. Unknown
prices remain unknown; provider-reported charges take priority. Recorded calls
use `recorded_chat` ledger rows with fixture token counts and known zero actual
provider charges. They do not count as paid production model usage.

## Provider contracts and limits

CI exercises JSON/SSE protocol fixtures through the real SDK's HTTP parser with
an in-memory transport. The fixtures are **synthetic protocol examples**, clearly
labeled; no live captures or provider-quality claims are invented. They cover:

1. Three thinking tool calls plus final answer with full verbatim replay.
2. A non-tool assistant turn followed by a tool turn, retaining both reasonings.
3. A missing-reasoning HTTP 400, with safe diagnostics and no retry.
4. Exact persisted-message parity for equivalent streaming/non-streaming payloads.
5. LangGraph's actual checkpoint serializer, persisted to SQLite and loaded again.
6. Dispatch refusal for dangling calls, then acceptance after genuine call ids
   have corresponding results. This is a client boundary test, not service recovery.
7. Non-thinking router request options and timeout. Actual router fallback is absent.

Live variants have marker `provider_live`. The nightly/manual workflow uses a
`DEEPSEEK_API_KEY` repository secret and sets `LLM_API_KEY`/`LLM_BASE_URL` explicitly.
Local opt-in: set `RUN_PROVIDER_LIVE=1`, `LLM_API_KEY`, and
`LLM_BASE_URL=https://api.deepseek.com`, then run
`python -m pytest tests/test_provider_contracts.py -m provider_live --assert=plain`.
Missing credentials fail the opt-in run. A relaxed missing-reasoning requirement
is reported as a skip for contract review. Live stream parity compares one
generation with that same completed message decoded through the non-stream SDK;
independent generations need not produce identical reasoning.

No live API calls were run in this task. Full async graph checkpoint save/load,
real operation reconciliation and production router timeout/fallback are explicitly
skipped as later integration work. They cannot pass the complete section 11 gate.

DeepSeek's official [thinking-mode documentation](https://api-docs.deepseek.com/guides/thinking_mode/)
was checked: requests containing tools replay reasoning from every prior assistant
turn, including non-tool turns. Strict mode is not enabled.

## M1 gate

| Required item | Result | Evidence / remaining work |
|---|---|---|
| Matrix reviewed and merged | **FAIL** | Matrix exists in feature-branch commit `843ac82`; absent from local `main` and `origin/main`. No verified review/merge evidence. |
| Cross-user isolation and X-Demo-Role removal | **PASS** | Real HTTP two-student isolation and verified-session/header-forgery regression tests passed. The header cannot authenticate or change identity. |
| Privacy section 4.8 targets | **FAIL** | Fresh benchmark exits 1. Selected underthesea raw-text numeric targets pass; document targets fail with 36 extraction failures, PhoBERT is unavailable, annotations need human review, and held-out real count is 0 (requires 10+). |
| Gateway static and analysis-service leak tests | **PASS** | Static boundary, gateway tests and recording-provider real-analysis tests passed, including the synthetic golden set. This is measured fixture coverage, not universal protection. |
| Provider section 11 contracts | **FAIL** | Client protocol regressions pass; real API unrun, graph checkpoint/operation reconciliation/router fallback integrations remain skipped. Fixtures are synthetic, not live captures. |

**M1 overall: FAIL.** No gate requirement is waived. The graph, router and tools
were not implemented as part of T1.5.

Fresh privacy evidence: [M1 benchmark JSON](m1_privacy_benchmark.json). The benchmark
command was `python -m eval.pii.run --documents --output docs/m1_privacy_benchmark.json`.
This rerun preserves the previous benchmark instead of overwriting it. Held-out
evaluation warns and skips when its directory is empty; no real CVs were invented.

## Validation and commit scope

Focused identity/gateway/leak/client run: **120 passed, 7 skipped**. After the final
escaping/retry regressions, focused configuration/client tests pass **13 tests**.
The full backend suite after implementation commit `1609d16` passes **607 tests,
7 skipped** (360.48 seconds). The skips are six opt-in live API cases and one
explicit future integration gate. Ruff on `src tests`, formatting checks on all
new Python files, and `git diff --check` pass.

The privacy rerun exits 1; Tesseract is not available in the command environment,
so all 36 scan extraction attempts fail. PhoBERT's configured local model is
unavailable. These local prerequisites compound the missing review/held-out-data
gates; the previous privacy report is retained and is not treated as this rerun.

The suggested six commits are consolidated into one provider-boundary implementation
commit (settings, client and its non-streaming/streaming/recorded/contract tests)
and a separate documentation commit. The three client modes share one
transport/accounting lifecycle and are verified together. No protected hooks/logs
or unrelated user files are included.
