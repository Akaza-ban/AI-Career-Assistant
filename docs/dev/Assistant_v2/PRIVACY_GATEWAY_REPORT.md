# Assistant privacy and LLM implementation — rev 4.1

Implemented architecture sections 4 and 13 by extending T0's existing boundary.
No second gateway, masker service, accounting table, provider client module,
NER adapter, router, vault or thinking feature was introduced.

## Reuse and changes

| Existing component | Implementation |
|---|---|
| `providers/gateway.py`, `ProviderScope`, `GatewayChat`, embeddings | Added a mask-only scope with no vault construction or placeholder/original mapping. Its short-lived detection dictionary supports repeated identifiers and full-payload egress scanning, then is cleared. Legacy product vault behavior remains separate. |
| Privacy detectors, folding, identity variants, regex and installed Underthesea | Reused all detection layers. Filename probes preserve offsets without altering contact punctuation. Exact identity/regex spans take precedence over overlapping broad NER boundaries in messages. No new model or downloads. |
| `privacy/masker.py` | Added one-way `mask_only`, reused literal-bracket escaping, and added a bounded-state `PlaceholderFilter`/neutral-word guard. Arbitrary `[[...]]`, including incomplete output placeholders, becomes `bạn` (`you` is supported by the primitive). No assistant restoration API. |
| Existing `LlmClient` | Kept SDK-backed recorded responses, timeout/backoff, tool fragment accumulation and usage. Physical SDK construction/dispatch moved into gateway-owned `RawChatTransport`; the client imports neither provider SDKs nor HTTP libraries. |
| `services/llm.py` | Added the assistant factory and adapted the existing cached health probe to raw-client mode. Existing product helpers stay compatible. |
| Provider usage and telemetry policy | Reused `ProviderUsage`, `_start`/`_finish`, tariff/unknown-cost flags, per-attempt rows, inherited-trace suppression and safe diagnostics. Accounting rows are assistant operational telemetry under section 2.2; no business table or alternate ledger was added. |
| Settings | Reused all existing required gateway/masking/timeout/retry/accounting/tracing settings. Changed only the thinking default/example to disabled. Assistant scopes force non-thinking and temperature zero, reject explicit thinking, and drop reasoning output/replay fields. |

The assistant masks the last two exchanges, query, retrieved guide data and any
model-facing labels. Arbitrary `page_state` is excluded: it may contain CV/JD
bodies, feedback or transcripts. Outbound page context contains a validated
page/role hint, with user/selected-CV IDs removed and URL queries stripped.
Server-built labels/sources remain server-owned and do not pass through output
restoration. Raw tool-result literals are escaped as inbound data.

Tool definitions are server-owned protocol text: regex, known identities,
detected dictionaries and full-payload egress still apply, while NER is disabled
for schema titles/descriptions to prevent words such as `message` becoming
names. User-derived messages/tool results continue to use all existing detection
layers. JSON tool arguments are masked structurally to preserve their syntax.

## Reachable call sites

| Assistant entry/call site | Final boundary |
|---|---|
| `/assistant/chat` → `AssistantAgent.respond` → generation | Mask-only scope → existing `LlmClient` → gateway raw SDK transport. Existing injected recording backends still use `GatewayChat` under the same mask-only policy. |
| `/assistant/status` | Existing cached health service in assistant/raw mode → same gateway, non-thinking, bounded timeout and no retries. |
| Retrieval query / document embeddings | Existing `AssistantEmbeddingService` → `encode_e5` or hashing → `embedding_call`; mask-only is enforced even for standalone embedding consumers. |
| HTTP reindex / assistant indexer CLI | Same E5/hashing gateway path. Model-weight provisioning sends no user text. |

**Unmigrated assistant model call sites: none found.** The repository static test
has no SDK/HTTP exception for `llm_client.py`. Its existing reviewed exceptions
remain limited to local vector/NER adapters and the protected development-log
uploader. OCR/STT/TTS and unrelated product generation are outside this task.
Legacy explicit thinking/replay and vault APIs remain available to legacy
consumers; assistant scopes cannot enable or invoke them.

## Message-style privacy results

Measured locally with existing Underthesea 9.5.0 CPU NER; see
[`eval/pii/results/messages.json`](../../../eval/pii/results/messages.json) for
source/dataset hashes and measurement time. The 724 fixtures are synthetic drafts
derived from 72 existing synthetic identities, with additional punctuation cases.
Known authenticated identities are supplied where applicable; these are not
unassisted NER-only or real-user quality numbers.

| Kind | Gold entities | Strict recall | Precision |
|---|---:|---:|---:|
| Email | 73 | 100% | 100% |
| Phone | 73 | 100% | 100% |
| ID/passport | 90 | 100% | 100% |
| Person | 432 | 100% | 97.30% |
| Address | 72 | 100% | 100% |
| DOB / URL / handle | 72 / 72 / 74 | 100% each | 100% each |

Preservation false positives: **skills 0/144, employers 0/72, schools 0/72,
cities/countries 0/72**. Overall precision: 98.76%; 12 extra PERSON detections
remain outside those preservation annotations. All numeric gates pass without
threshold changes. Annotations remain `needs_human_review`; no universal PII
guarantee, CV shipping approval, live-provider quality or vendor/DPA acceptance
is implied.

The actual masker is checked on every fixture. A recording-provider leak test
runs the assistant graph with real local NER, query embedding, inherited trace
callbacks, raw identifiers in query/history, and planted page-state body text.
It asserts zero identifiers in any recorded request/log/trace, zero inherited
trace events, no vault construction, and no body/transcript sentinels outbound.
Masking-disabled/unavailable/error cases dispatch nothing and return a friendly
error. Planted identifiers in prepared payloads or schema keys are blocked.

## Provider contracts and validation

Rev 4.1 contract (1) uses a non-thinking stream and system prompt; (4) records a
timeout, rate-limit retry/backoff and successful usage; (5) blocks planted
email/phone/name identifiers before any provider request/accounting row. These
are provider-shaped offline fixtures, not captures proving live model quality.

Focused validation passed: 289 assistant integration/guardrail/client tests;
101 gateway/privacy/client regressions; 16 eval/leak/provider/static tests.
The complete offline suite at `bd0fca7` finished with **685 passed, 17 failed,
7 skipped**. All 17 failing test IDs reproduced on the pre-task `c385b50`
revision in an isolated source copy, retaining the three pre-existing user test
edits. The final native-E5 payload correction subsequently passed 33 focused
gateway/static/E5 regressions. See
[`suite_comparison.json`](../../../eval/pii/results/suite_comparison.json).

Assistant API integration runs used a reduced
password work factor only inside an isolated temporary-database process;
the password test that explicitly requires 32768 retained its normal work factor.
Production authentication was unchanged. An earlier fast-suite attempt produced
one harness-only failure in that assertion; it was corrected and is excluded
from the final 17. Normal-work-factor gateway/privacy checks passed separately.
Initial normal-work-factor full-suite `-x` reproduced T0's account-registration
failure after 20 passes.

| Confirmed pre-existing failure group | Count |
|---|---:|
| Accounts: session identity, demo password, missing `storage_limit_mb` | 3 |
| Demo-header auth, verified login/session behavior | 6 |
| Private JD recommendation isolation | 1 |
| Missing OCR dependencies / Soniox model default | 2 |
| Seeded account count (four versus three) | 1 |
| Undefined `get_roadmap_info` in comparison/roadmap endpoints | 4 |

Ruff passes for every changed Python file. Repository-wide Ruff still has the
same three pre-task errors: `get_roadmap_info` undefined at
`src/api/analysis.py:41,349`, and unused `datetime.date` in `src/db/seed.py:2`.
Diff whitespace and final dataset/source hashes pass. The commit-policy
deviation is therefore explicit: focused checks pass, while existing unrelated
global failures remain; no unrelated source repair was folded into this task.

Implementation commits: `9681cbf` config; `9dfc7db` mask-only primitives;
`8c98495` gateway; `49018bd` assistant/raw client; `a63b902` exception contexts;
`bd0fca7` evaluation/contracts; `3d767df` native embedding payload scan.
The documentation commit adds this report and the final verification evidence.

## Limitations and decisions

- Assistant content/tool deltas are buffered until the complete upstream response
  passes masking, placeholder replacement and egress checks. This prevents leaks
  across arbitrary chunk boundaries, but delays the first outward delta until
  generation completes. The HTTP assistant contract remains compatible; low
  latency incremental delivery is a later streaming task.
- This repository snapshot has no result-facts resolver/tool path. No result
  fact payloads are introduced here. Section 7.5 field allowlisting and numeric
  grounding remain with that feature; this task makes no release claim for it.
- The router and its settings, agent limits, timezone and result settings were
  not expanded. Existing daily-token-cap configuration remains present; no new
  reservation/quota subsystem was added to this accounting task.
- `TRACE_BACKEND` is retained, automatic capture is disabled, and diagnostics
  are suppressed rather than exporting raw data. No new trace exporter or vendor
  retention/training promise is claimed. The existing DPA review/product-copy
  acceptance remains an external release decision, including before result facts
  are sent to any vendor.
- Single-worker deployment remains the documented limitation. Existing legacy
  action/public response schemas are preserved pending later assistant migration.
- Protected hooks/logs and pre-existing user edits are preserved. A separate
  corrective commit removes hidden raw exception contexts from masking/provider
  cleanup failures. A second makes the complete native E5 input, including task
  prefixes, part of the last egress scan. Both have regression tests; these are
  the two extra implementation commits beyond the approved sequence.
