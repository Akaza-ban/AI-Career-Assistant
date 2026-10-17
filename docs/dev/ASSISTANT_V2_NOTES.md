# CareerX Assistant v2 — implementation notes

## Rev 4.1 gateway/privacy implementation (2026-10-15)

Sections 4 and 13 implementation and measured evidence are recorded in
[the gateway/privacy report](Assistant_v2/PRIVACY_GATEWAY_REPORT.md).
It covers reused components, all migrated assistant model calls, mask-only
semantics, 724 synthetic message fixtures, provider contracts and limitations.
This addendum does not alter the pre-existing review notes below.

Validation: 724 synthetic messages meet all numeric gates (100% strict recall
for the required categories; 0% skills/employer/school preservation false
positives). Full offline suite: 685 passed, 17 failed, 7 skipped at `bd0fca7`;
all 17 failures reproduced at pre-task `c385b50`. Final native-E5 correction:
33 focused tests passed. Changed-file Ruff passes; three unrelated baseline
Ruff errors remain. The report records buffering, result-fact/DPA release
decisions, accounting interpretation, single-worker scope and two corrective
commits beyond the approved sequence. Existing notes/user edits remain unstaged.

## T1.3a — pulled OCR / speech review (2026-10-14)

Read-only implementation review at HEAD `5ff8794`; only this section and the
[matrix addendum](Assistant_v2/TOOL_MATRIX.md#8-t13a-ocr--speech-outbound-review-2026-10-14)
were prepared. No source, tests, teammate files or evaluation artifacts changed.
Originating OCR/voice commit is `562a5f3`, integrated through `0a941ec`,
`da6e320`, PR #14 (`dfc1cd1`) and `c1e8062`. The user confirmed `dced45c` as the
comparison baseline; its diff to HEAD and originating commits were inspected
without assigning unrelated changes to OCR/voice. Full inventory and F01-F16
findings are in the addendum; its citations refer to this reviewed tree.

| Finding | Severity | File:line | Later task / owner |
|---|---|---|---|
| App import fails on duplicate session table; Soniox and cookie/demo settings are MISSING. | blocks release | `src/db/models.py:79,131`; `src/config.py:14-210`; `src/services/interview.py:558` | Teammate merge repair; T1.2 revalidation |
| RapidOCR offline provisioning proof is MISSING; automatic Tesseract/default-language fallback and incomplete-page acceptance conflict with the required extraction path. | blocks release (verification); should fix (fallback/completeness) | `src/services/ocr.py:24-36,211-254,267-315`; `src/services/privacy/extract.py:32-71` | Teammate; T1.3b adapter |
| Soniox sends raw voice plus unmasked JD title/skills outside the model gateway. Server-side key handling avoids frontend key exposure, but does not protect audio/context. | blocks release | `src/services/soniox_stt.py:33-56,89-116` | T1.4 text boundary; teammate; team audio decision |
| WS accepts an optional interview and bypasses disabled/temp-password checks; HTTP Origin middleware does not protect WebSockets. Demo header fallback still exists. | blocks release | `src/api/interviews.py:33-54`; `src/api/deps.py:28-39,48-52`; `src/api/security.py:10-25` | T1.2; teammate WS guards |
| OCR/STT exceptions and vendor error bodies can escape to logs/UI outside gateway sanitization. Ordinary transcript/OCR text logging was not found. | blocks release | `src/services/ocr.py:247,292,313`; `src/services/soniox_stt.py:151,173,187,191`; `src/services/providers/gateway.py:58-75` | T1.4; teammate |
| Interview questions now call the masking gateway, but known user identity/full document priming before truncation are MISSING on that path. STAR scoring uses an authorized provider scope and untraced graph. | blocks release (question-path coverage); note (STAR boundary present) | `src/services/interview.py:237-245,336-342`; `src/agents/interview/question_generator.py:77-98`; `src/agents/interview/graph.py:51` | T1.4 leak regressions / scoped inputs |
| Actual fallback scan experiment: PERSON strict recall 88.89% versus 95.83% reference; DOB coverage 94.44% versus 100%; accentless `Ngay sinh` leaves an unchanged date unmasked. RapidOCR quality remains unmeasured. | blocks release for evaluated path | `src/services/privacy/detectors.py:25-27`; `src/services/ocr.py:211-254`; `eval/pii/run.py:66-160`; `eval/pii/golden.jsonl:6` | T1.3b; teammate RapidOCR verification |
| TTS and Vbee code/vendor/payload/audio-cache/tests are MISSING. No real vendor key found in inspected tracked source/examples; Soniox example is empty. | note | `src/api/interviews.py:19-54`; `frontend/lib/use-soniox-stt.ts:1-263`; `.env.example:13-16,37,42` | Teammate identify branch/files or confirm deferred |
| Relay/offline/partial-page/error-leak tests are MISSING; foreign-session WS test uses an absent ID rather than another student's real row. | should fix | `tests/test_api/test_soniox_ws.py:43-50`; `tests/test_api/test_cv.py:275-319` | T1.3b, T1.4, teammate |

Validation with `PYTHON_DOTENV_DISABLED=1`, isolated process credentials and no
real provider calls: `ruff.exe check --no-cache src tests` exits 1 with six
existing merge errors; full `python -m pytest tests/ -q -p no:cacheprovider`
exits 4 in conftest import on duplicate `auth_sessions`, before tests collect.
No passing full suite is claimed and no commit is made while the architecture's
lint/full-suite gate is blocked. The planned commit is
`docs(assistant): record OCR STT and TTS review findings`, limited to these two docs.

The optional experiment used existing evaluator functions in memory on 36
synthetic scan PDFs, with no filenames/auxiliary samples and no known identities.
RapidOCR, pypdfium2 and pdfplumber are absent from the venv; no dependencies were
installed. The teammate's pypdf/pytesseract `vie+eng` fallback was run with the
already provisioned portable Tesseract. Machine outputs were not saved or
committed. Scans have no text layer; annotated source transcription is the
comparison reference. Details and examples are in the matrix addendum.

Privacy shipping gate: **pending-team**, requiring human-reviewed annotations
and 10+ held-out real-format CVs in `eval/pii/real/`. This blocks release to real
users, not M2-M4 development. No DPA review, Vbee integration or OCR benchmark
commit was undertaken. T1.3b remains pending approval of these findings. Team
decisions still needed: TTS code location/deferred status,
raw-voice product/privacy decision, and ownership of merge/relay repairs.

## T1.3 revalidation — 2026-10-14

The requested privacy module, golden corpus and standalone migration already
exist in HEAD (the original T1.3 commits are listed below). This follow-up retains
them and adds the bounded fuzzy known-identity pass required by architecture
section 4.4. Diacritic-insensitive authenticated names of at least two words and
eight characters may differ by one insertion, deletion or substitution across
the whole name. Matching preserves original character offsets, checks reversed
name variants and cannot cross a newline or field punctuation. Short names,
emails and phones do not use fuzzy matching. This conservative pass also applies
to message/text input because the existing extraction API returns text without
an OCR provenance flag. As with exact identity matches, a near-identical unrelated
name may be masked; matching remains bounded to supplied authorized identities.

Regression tests cover all three edit operations, reversed order, multiple-edit
refusal, short-name refusal, field boundaries, exact-only email/phone identity
matching and a masking/unmasking round trip preserving the OCR misspelling and a
literal placeholder. The independent privacy tests pass **56 tests**, with the
application lifespan test deselected because it imports the broken application
model graph. Command: `python -m pytest --noconftest
tests/test_privacy_detectors.py tests/test_privacy_masker.py
tests/test_privacy_extract.py tests/test_privacy_eval.py
tests/test_privacy_ner.py -q -k 'not lifespan'`. Privacy/eval Ruff, changed-file
format checks, compilation and `git diff --check` pass.

**Current repository validation is blocked, not passed.** Normal pytest stops
in `tests/conftest.py` while importing `src/db/models.py`: `AuthSession` is declared
twice for the same `auth_sessions` table (lines 79 and 131). Consequently the
Fernet-vault, migration and application-startup tests cannot be revalidated on
this HEAD. Full `ruff check src tests` also fails with six existing merge errors:
the duplicate `AuthSession`, two undefined `get_roadmap_info` references, an unused
`date` import and two undefined `DEMO_ADMIN_ID` references. These auth/roadmap/seed
merge defects are outside this privacy correction and are left unchanged.
No new commit is created while the architecture's full-suite/lint commit gate is
blocked. The historical passing full-suite counts below are historical evidence,
not results for this HEAD. The separate migration commit remains `a9c3309`.

Fresh benchmark: all three NERs measured on CPU, all 72 document extractions
succeeded, and underthesea again won PERSON+ADDRESS micro recall (57.37%, versus
4.81% PhoBERT and 33.97% spaCy). Selected-pipeline draft raw/document numeric
targets pass with unchanged scores from the original benchmark. Full per-entity
and model tables are recorded at the task's explicitly requested path,
[docs/ASSISTANT_V2_NOTES.md](../ASSISTANT_V2_NOTES.md#t13-revalidation-on-current-head-2026-10-14),
with machine evidence in [t1_3_current.json](../../eval/pii/results/t1_3_current.json).
The benchmark exits 1 because review is still `needs_human_review` and held-out
real count is zero. These team actions remain shipping gates, not waived targets.

## T1.1 — tool-to-service matrix (2026-10-13)

- Output-path ambiguity: architecture line 3 names docs/assistant_v2/TOOL_MATRIX.md; the task explicitly requests docs/dev/Assistant_v2/TOOL_MATRIX.md. Use the task path only; no duplicate matrix or architecture edit.
- Notes-path ambiguity: architecture lines 7, 16 and 363 name docs/ASSISTANT_V2_NOTES.md; the standing user rule requires docs/dev/ASSISTANT_V2_NOTES.md. Use the user path only.
- Catalog scope: architecture line 255 includes ask_user (M3), but T1.1 does not name it. Do not add a candidate row or feature. advisor_* is expanded by existing service capabilities, including notes and in-app messaging; labels are inventory descriptors, not new tool registrations. START_ANALYSIS is recorded as a legacy variant to remove from v2 ui_action in favor of analysis_start (architecture line 268).
- Safety choice: explicitly mark MISSING rather than substitute route handlers or lookalikes (restore versus duplicate, JD comparison versus analysis comparison). No tool is declared compliant merely because a backing helper exists; required checks must still be built in later authorized tasks.
- Existing BackgroundTasks behavior records committed analyses and restart failures; it does not provide durable job execution (src/services/gap_analysis.py:75; src/api/analysis.py:192; src/db/seed.py:81–92; architecture line 64). Single-worker pin/startup refusal are MISSING in existing deployment, not accepted exceptions (Dockerfile:34; docker-compose.yml:3–19; src/main.py:20–60).
- Privacy residual risk: architecture keeps employers, schools, job titles, skills, projects and city/country, which can still permit indirect re-identification. The stronger immediate current-code gap is unmasked outbound text plus automatic tracing; T1.1 does not claim or implement privacy protection (architecture lines 108, 113–116; src/services/assistant/agent.py:289–310; src/main.py:24–32).
- Read-like side effects must be visible in later tool design: optimizer.session may create/commit a draft (src/services/cv_optimizer.py:165–175); advisor.shared_cv/interview_report commit viewed timestamps (src/services/advisor.py:536–537, 583–584); interview.build_report can invoke abandoned-session deletion before rejecting incomplete reports (src/services/interview.py:145–164, 375–378).
- Baseline validation: backend compilation passed; full pytest collection passed (433 tests in 55.02s). PYTHON_DOTENV_DISABLED=1 was set only in the test process so src/config.py:10 cannot override test credential/database isolation with local .env values; no secrets or .env file were read or changed. At initial delivery, Ruff check src tests failed on three existing W293 errors in tests/test_jd_recommendation.py:20, :23, :26. No out-of-scope whitespace fixes made. At initial delivery this blocked the commit; no exception was assumed.
- No behavior, API, migration, refactor, provider integration, protected hook/log or test source changed. The user's untracked docs/dev/ASSISTANT_V2_ARCHITECTURE.md is left untouched and excluded from the proposed documentation commit.

### T1.1 validation after the user fixed W293

- Ruff check src tests now passes. Backend compilation passes. Full pytest collection passes: 433 tests in 53.55s before the documentation commit. The same dotenv isolation was used.
- Rechecked 587 source citation ranges with zero invalid paths or out-of-bounds references; catalog coverage and Markdown table checks pass.
- The approved commit contains only TOOL_MATRIX.md and this notes file. User changes to tests/test_jd_recommendation.py, .agents/hooks.json, scripts/_pyrun.cmd and scripts/log_antigravity.py are excluded; the architecture input remains untracked.
- The baseline-Ruff exception request is no longer needed. No task deviation, out-of-scope source change or waived requirement is needed.

## T1.3 — local privacy module (2026-10-13)

Implemented PDF text-layer extraction with page-local Tesseract `vie+eng` fallback,
four ordered detector layers, reversible inbound escaping, document/filename
masking, encrypted vault storage, scoped resolution, TTL and deletion, startup CPU
NER loading, and a synthetic evaluation harness. Provider integration and tracing/
egress policy remain T1.4; streaming unmasking remains T2.4. Existing outbound
services have not been migrated, so this task does not establish a privacy-compliant
shipping path for them.

### Storage, scoping and configuration

- Placeholders use `[[KIND_<nonce>_<n>]]`. `MAX_PLACEHOLDER_LENGTH = 84` is the single
  shared bound. A random 128-bit nonce is persisted on the conversation; the
  decimal suffix is derived from a keyed digest of the exact original. This keeps
  exact originals stable across origins, sessions, concurrent callers and restarts.
- The migration has its own commit. It adds nullable `assistant_conversations.pii_nonce`
  and the six required `pii_vault` columns. The composite key includes origin, so an
  original genuinely present in both a message and a CV retains one placeholder
  with separately scoped origin rows. A SQLite deletion trigger covers the legacy
  engine's disabled foreign-key enforcement. Upgrade/downgrade are tested and
  idempotent; downgrade discards only privacy mappings and nonce metadata.
- Fernet uses `PII_VAULT_KEY` through `get_settings()`. Encrypted payloads bind the
  conversation, placeholder, kind and origin; copying ciphertext between rows
  fails integrity checks. TTL is checked on every resolution, is not extended by
  reads or same-origin deduplication, and has explicit physical cleanup and
  delete-by-conversation APIs. Callers own SQL commit/rollback and session closure.
- One original retains its first canonical kind even if a subsequent detector
  classifies an ambiguous phone/ID differently. This preserves the required token
  invariant and does not authorize resolution into a field accepting another kind.
- `resolve(value, vault, allowed_kinds, allowed_origins)` is mandatory and there is
  no unrestricted original lookup. The caller must authorize the conversation and
  derive resource origins from the call's owned/visible resources and field policy,
  never model-provided scopes. `unmask` also requires explicit scopes.
- Inbound `[[` is escaped before detection; ampersands are escaped to avoid encoding
  collisions. Rehydration decodes once and never re-scans decrypted replacements.
  Mask raw inbound text/documents once; server-owned masked history/replay must
  retain its existing tokens. Literal and copied live-token injection tests cover
  messages and documents, with a real encrypted vault as well as unit fixtures.
- JD recruiter names receive the PERSON pass. Filenames receive normalization for
  detection while retaining their exact original spelling for round trips. PDF
  results contain text and a masked filename, with no source images or metadata.
- Masking/extraction/model/vault failures raise sanitized typed privacy errors.
  The caller must stop before a provider call. Production rejects disabled masking
  and startup rejects an invalid/missing Fernet key before provider-capable startup
  work. The selected CPU model loads once at startup, including concurrent
  initialization; the masker cannot lazily download or substitute another model.
- `.env.example` documents the privacy flags, entity policy, key/TTL, CPU NER and
  local OCR limits. Required mask types cannot be disabled. URLs are conservatively
  masked beyond personal profiles as well. Employers, schools, skills, job titles,
  projects, employment dates and standalone city/country locations are retained;
  those combinations still permit indirect re-identification.

### Benchmark and choice

Actual local CPU inference was measured at `2026-10-13T15:44:43Z`, with **72 draft
CVs** (24 VI, 24 EN, 24 mixed; 36 text PDFs and 36 scans), **18 auxiliary fixtures**,
and **72 separately annotated filenames**. All drafts are `needs_human_review`.
All 72 PDFs extracted successfully using local Tesseract 5.5.3 at 200 DPI where
OCR was needed. Representative PDFs were rendered with Poppler and visually
checked. No CV content was sent to a hosted model or cloud OCR service.

The [machine report](../../eval/pii/results/benchmark.json) records dataset/source
hashes, counts, strict and coverage metrics, language subsets, model versions and
gate failures. The final source hashes were verified against the delivered files.
The golden-file hash is `ae3e083b8ea6ee9fa89254fd3439a69aff1b26da4a3bb3f6ea54a805f4fd16b2`.
See [reproduction and metric definitions](../../eval/pii/README.md).

NER-only results below include both CV/auxiliary text and filenames, without the
regex/header/known-identity layers or preservation filters. These are our measured
draft-set results, not the model authors' published scores. Strict recall requires
the whole annotated span and kind. Selection uses PERSON+ADDRESS micro recall;
precision is only a tie-breaker. Real CVs never enter the selection loop.

| NER candidate | PERSON recall | PERSON precision | ADDRESS recall | ADDRESS precision | PERSON+ADDRESS micro recall |
|---|---:|---:|---:|---:|---:|
| [underthesea](https://github.com/undertheseanlp/underthesea), 9.5.0 packaged CRF `ner_crf_2017_10_12` | 76.50% | 12.73% | 0.00% | 0.00% | **57.37%** |
| [PhoBERT PII NER](https://huggingface.co/Phuc2005/pii-phobert-base-ner), `fc4d654b9906dafb34ea670b9b14c2360e4d3be3`, transformers 5.18.0 | 6.41% | 18.29% | 0.00% | 0.00% | 4.81% |
| [spaCy multilingual](https://spacy.io/models/xx/), spaCy 3.8.16 / `xx_ent_wiki_sm` 3.8.0 | 45.30% | 38.13% | 0.00% | 0.00% | 33.97% |

**Chosen: underthesea**, because it had the highest measured strict recall on the
selection entities. Only its packaged local CRF NLP API is used. Its standalone
precision is poor and it does not recognize complete address spans in this set;
the ordered identity/regex/header layers and preservation/field-label filters are
essential. PhoBERT uses its raw-syllable tokenizer with original character offsets
and overlapping CPU windows; no document tail is truncated. spaCy is an explicit
configured fallback, not an automatic bypass when the selected model fails.

Full-pipeline results for the selected model, including filenames and auxiliary
fixtures, use an empty known-identity dictionary for this benchmark. The DB-supplied
identity/diacritic/reversed-name layer has separate tests.

| Entity (gold count) | Raw-text recall | Raw-text precision | PDF/OCR recall | PDF/OCR precision |
|---|---:|---:|---:|---:|
| EMAIL (162) | 100.00% | 100.00% | 100.00% | 100.00% |
| PHONE (90) | 100.00% | 100.00% | 100.00% | 100.00% |
| ID (96) | 100.00% | 100.00% | 100.00% | 100.00% |
| PERSON (234) | 98.72% | 93.90% | 97.44% | 93.44% |
| ADDRESS (78) | 100.00% | 100.00% | 100.00% | 100.00% |
| DOB (72) | 100.00% | 100.00% | 98.61% | 100.00% |
| URL (90) | 100.00% | 100.00% | 100.00% | 100.00% |
| HANDLE (72) | 100.00% | 100.00% | 100.00% | 100.00% |

Overall strict precision: **98.34% raw**, **98.23% PDF/OCR**. False positives on
skills (432), employers (78), schools (78) and city-level locations (72): **0%** in
both modes. Raw PERSON recall/precision by language: VI 100%/95.12%, EN
96.15%/91.46%, mixed 100%/95.12%. Raw email/phone/ID/address recall and precision
are 100% in each language subset.

The original targets remain unchanged: EMAIL/PHONE/ID recall >= .99,
PERSON/ADDRESS recall >= .92, precision >= .9, and SKILL/EMPLOYER/SCHOOL false
positives strictly < .03. **Both draft raw and document runs meet those numerical
targets.** Coverage is reported separately: raw PERSON coverage is 100%; PDF/OCR
PERSON coverage is 98.72% and DOB coverage is 98.61%. Three PERSON spans and one
DOB span are not fully covered in the document run; this is not a universal or
zero-leak claim. Document metrics evaluate masking of aligned OCR output, not
perfect transcription.

**Shipping gate remains failed.** The synthetic annotations need human review and
`eval/pii/real/` contains no supplied CVs. Its loader warned and skipped as required;
no real CVs were invented. The benchmark exits 1 for these outstanding gates even
when numerical draft targets pass. Real-format CVs/annotations are Git-ignored.
The later provider gateway/egress scan and recording-provider analysis leak tests
are still required by T1.4. No shipped tool is excused from those requirements.

### Validation and commits

Ruff and backend compilation pass; the final full suite passes **559 tests**.
Tests cover round trips (including escaping
collisions), literal/copied-token injection, kind/origin/conversation refusals,
Fernet tampering and ciphertext swaps, exact TTL boundaries and deletion,
concurrent nonce creation, fail-closed errors/startup, long CPU NER windows,
PDF text/scan extraction, photo/metadata stripping, the golden loader and fixed
evaluation thresholds. Full suites were run after the individual commits; initial
identity ordering, production-settings compatibility, NER punctuation and OCR
boundary issues were corrected with regressions rather than waived.

Code/data commits: `30e2ab0` detectors; `ff004ab` masking/extraction; `a9c3309`
standalone migration; `c281e8f` vault/scoping/TTL; `635798a` corpus/harness;
`c514d66` startup NER, measured report and integration regressions. Benchmark
documentation is a separate final commit. A final review regression adds one
corrective commit, `a21e3e4`, for recruiter names following employer prose after a
comma; it refreshes the benchmark source hashes with unchanged scores. This is
the only added commit beyond the six suggested implementation commits plus docs,
and corrects the existing third-party identifier contract rather than adding a
feature. Local protected hooks/logs and the
user-supplied architecture/prompt files were not modified or committed.

## T0 rev 4.1 reuse audit (2026-10-15)

Source snapshot: `a61004e0d21b3a5cdd03fd1963844c53b34e67b2` plus the existing
working tree. See `docs/dev/Assistant_v2/REUSE_MAP.md` for current function-level
evidence. This is a docs-only task; no assistant behavior, source, dependency,
business row or migration is changed. Historical AUTH_NOTES/TOOL_MATRIX claims
are not assumed to describe current code.

- Keep the existing LangGraph inspect/classify/retrieve/generate structure and
  `AssistantAgent.respond` entry point: extending it is the smaller diff. No
  checkpointer, interrupt, thinking replay, operations or write tools are added.
- Retain single-worker deployment as a limitation, without new boot-refusal
  logic. Only the bare open-intent follow-up after exactly one persisted target
  is in scope; turns currently do not store card targets.
- Use the mask-only assistant privacy contract. Existing gateway, detectors,
  E5 adapter, raw LlmClient, highlighter, dispatcher and hybrid RAG should be
  extended rather than duplicated. Vault-backed restoration and thinking
  defaults still need adaptation in later tasks; do not remove them from other
  product paths in T0.
- Safer role interpretation: advisor static pages/how-to only, despite an
  existing assigned-student detail route. Existing assignment/sharing services
  do not authorize new advisor result tools. Admin assistant scope is absent.
- CV newest uses family head/version sequence and uploaded_at; no updated_at
  column exists. Interview started_at is an output alias for created_at, stored
  as naive UTC. Local date windows must convert from Asia/Ho_Chi_Minh to UTC.
- Facts proposal: category earned/possible are stored, category percentages are
  not; partial requirements remain separate from matched. Use at most five
  validated missing skill names. Recorded question count means an owner-scoped
  count of turn rows, distinct from the planned four. Previous interview means
  the previous completed same-jd_id record, not build_report's first session;
  omit comparisons for incomplete current sessions. Exclude body, evidence,
  feedback, answers/transcripts, suggestions and report guidance.
- Current auth regresses the historical no-demo claim: invalid/missing session
  may fall back to X-Demo-Role when demo mode is enabled. get_current_user also
  writes last_seen_at. Both require explicit correction before read-only claims.
  Existing provider_usage writes need an explicit assistant-telemetry accounting
  interpretation under section 2.2; no parallel ledger/table is proposed.
- Historical guide metrics describe 15 fallback cases; JD Recall/NDCG numbers
  belong to a different corpus/task. No new live-provider quality or release
  approval is claimed. OCR/STT are teammate product paths; TTS is missing and
  cut. Existing obsolete artifacts are inventoried only, never deleted.

Validation:

- Read-only document check: 62 explicit file references exist, 102 table rows
  have four columns, all 34 Next.js pages are inventoried. Python AST parsing
  passes for all 156 files in src/tests. Diff whitespace check passes.
- `.venv/Scripts/ruff.exe check --no-cache src tests`: exit 1, three existing
  errors: undefined get_roadmap_info at src/api/analysis.py:41 and :349, unused
  datetime.date at src/db/seed.py:2. No autofix was run.
- Isolated offline `.venv/Scripts/python.exe` invoking
  `pytest.main(['tests/', '-q', '-x', '-p', 'no:cacheprovider'])`: **20 passed,
  1 failed** in 47.36s. Existing failure:
  tests/test_api/test_accounts_api.py::test_register_signs_in_with_normalized_profile
  (:71), /me returned the seeded student rather than the newly registered user.
  Provider keys were explicitly blanked inside Python, dotenv loading disabled,
  paid live probes disabled, HF/transformers offline, temporary test DB enforced
  by conftest. This is not a full-suite pass.
- The initial broad pytest attempt was interrupted after failures to harden
  credential isolation: empty PowerShell environment assignments do not reliably
  override Pydantic dotenv fallback. Only the restarted Python-cleared process
  supplies the final pytest result above. No provider quality evaluation is
  claimed from either run.
- Commit-policy deviation: the requested docs-only commit cannot pass the
  existing Ruff/pytest baseline. T0 does not authorize source repairs. Record
  the failures instead of expanding scope or claiming green checks. No new
  tests are added for this documentation-only task.

Existing user edits in this notes file are preserved separately from the T0
commit. T0 creates REUSE_MAP.md because it was absent and explicitly requested;
it creates no source module and changes no protected hooks/logs.


## Sections 2.1 and 2.4 implementation (2026-10-15)

See [identity and slim runs](Assistant_v2/RUNS_IMPLEMENTATION.md) for reuse,
endpoint contracts, migration/downgrade, and compatibility decisions.
Assistant routes reuse verified auth without demo fallback or activity writes.
Cancellation/cache registries require single-worker deployment; no new boot
refusal, waiting states, operations or checkpointer were added. Structured JSON
upstream generation exposes no partial answer before completion. Legacy callers
without client_request_id keep working with a fresh server ID; updated browser
calls generate and reuse their own IDs. A separate migration correction handles
SQLite downgrade on freshly created databases; regression tests cover both
fresh and legacy-upgraded layouts.

Validation: 12 focused lifecycle/auth/history/migration tests passed; 62 existing
chat/status regressions passed in the earlier run. Four frontend API tests,
frontend typecheck, frontend lint (two existing api.ts warnings), changed-file
Ruff, and diff whitespace checks passed. Full-suite attempt reproduced T0's
existing account-fixture failure (20 passed, 1 failed): registration followed by
/me sends the seeded student's explicit cookie. Repository-wide Ruff retains
three pre-existing errors in src/api/analysis.py and src/db/seed.py. These
baseline failures prevent claiming every commit passes the complete suite.
Expanded offline assistant/cross-user compatibility: 374 passed, 1 failed. All
assistant cases passed; the remaining JD recommendation test returns a private
vector candidate. Details are in the implementation report. Existing user edits
are preserved and excluded from the implementation commits.

## Router evaluation foundation — 2026-10-15

Approved data-first plan: freeze and test the corpus, then add a pluggable
evaluation harness, then document counts/protocol. Commits `e366e21` (data) and
`a66a3d0` (harness) implement the router portion of sections 5.5 and 11. Tests
ship alongside the code they cover. No router/training/classifier, resolver,
provider call, production database/configuration change or dependency install.

The synthetic v1 corpus has 420 rows, 252/84/84 train/dev/heldout. Every
route-language cell is 12/4/4; every route totals 60, every language 140.
All 60 navigate and 60 result rows have raw gold NavSlots. Required subsets:
42 no-diacritic, 63 typo, 36 adversarial, 60 ambiguous, 18 follow-up (heldout
only). Follow-up targets live in an independently pinned context fixture.
Heldout was frozen before harness implementation or candidate tuning:
`d4fa196f50cc51dedaa28cb32acabb42d0bdc84109133e57daf696382a6efaa6`.

Assumptions: evaluation-only `student_home`/`advisor_home` context IDs map to
the real `/student` and `/advisor` pages pending the registry task. Advisor
static/how-to/locate requests are permitted; record/result requests and all
assistant writes are deny/out_of_role. Result metrics use tags, leaving the
section 5.1 slot shape unchanged. Comparison phrases use raw free_ref; dates
remain raw and are not resolved in routing. Contextual follow-ups are included
in overall metrics and separately reported, never tuning/training data.

`eval.run` loads registered names, entry points or module:factory adapters;
no gold annotation enters inference. Decision cache reset precedes every timed
predict; model load/warmup/reset are excluded, stages 0–3 plus slot extraction
belong inside predict. Errors remain in accuracy/recall/slot denominators and
cache hits fail. Default `local` intentionally exits 2 until the separate router
task supplies create_eval_backend. Synthetic/recorded scores are not model
quality; release_ready remains false without 100 real heldout utterances.
`--require-real` enforces that extra collection gate. Other section 11 suites
and `--suite all` remain outside this task, explicitly documented.

The real-utterance PR protocol preserves the synthetic 60/20/20 partitions,
appends 100+ independently reviewed teammate/student-interview examples only
to heldout, updates version/hash pins under review, and forbids training or
tuning on real or follow-up heldout rows. No real collection was manufactured.
See `eval/router/README.md` for all split/route/language/subset counts and the
backend protocol. Small synthetic safety denominator (6 heldout cases) limits
any interpretation of the recall gate.

Validation: 61 focused evaluation tests passed; changed-file Ruff, formatting,
diff whitespace and Git LF attributes passed. Default command's missing-router
exit and a failing recorded backend's metrics/JSON/exit are regression tested;
no production router candidate or live provider was benchmarked. Full backend
suite attempt was interrupted after reporting three failures in unchanged
backend tests; it was not a passing full-suite run. Repository Ruff still finds
the three existing errors in src/api/analysis.py and src/db/seed.py. Existing
user edits are preserved and excluded from these commits.

Additional compatibility run `python -m pytest eval/ -q`: 72 passed, 3 failed.
All 61 router tests passed. The three failures are existing RAG judge tests
(`test_judge_cannot_count_invented_evidence_or_reference_as_actual_answer`,
`test_judge_omission_of_reference_points_is_an_error`,
`test_judge_retries_transient_failure`) raising GatewayError in the current
provider/privacy setup. No RAG or provider code was changed to hide those
failures. Changed-file checks are green; repository-wide checks are not.

## T2.2 — local router stages 0–2 (2026-10-15)

Implemented `src/services/assistant/router/`: typed raw slots/decisions, NFC/folded text,
language detection, wrapped existing guards/greetings/role terms, bounded LRU+TTL,
JSON lexicons, capability precedence, raw qualifier extraction, fast/agent hints,
semantic clarify chips and exactly-one-card bare-open follow-ups. No classifier,
LLM/network/DB call or date interpretation. The old graph/API is not migrated here.

[Implementation assumptions, reuse and measured dev report](../../eval/router/rules_dev_report.md)
record the undefined LocateSlots shape, typed chip/card extensions, raw-date mode
heuristic, default vi language, empty/oversized denial choices and cache spelling
rebinding. Clear lexical conflicts use the requested precedence; uncertain partial
vocabulary clarifies. Prior cards are trusted owner-checked server inputs; contextual
follow-ups bypass caching. Single-worker deployment remains an accepted limitation.

Dev: 42/84 correct (50%), navigate/result slot EM 75% each, unsafe/injection deny
recall 33.33%, all-deny recall 41.67%, cache-miss p50/p95 1.1929/2.1228 ms,
zero backend errors. Synthetic dev evidence only; accuracy/safety/slot gates fail.
Dev has no followup rows; heldout inference was not run or tuned. The separate
classifier task must measure the remaining gap; no acceptance claim is made.

Validation: 453 integrated router/guard/eval tests and 8 legacy classification
tests passed. Changed-scope Ruff and formatting passed. Three pre-existing
repository-wide Ruff findings remain in analysis.py (2) and db/seed.py (1).

## T2.2 follow-up — train-only stage zero and independent validation

- `21a0d73`: extended the existing shared greeting/injection/security data from
  train failures, consolidated router-only unsafe/role patterns into that data,
  and fixed English article removal in greeting normalization. No parallel list.
- All 36 train smalltalk rows now return smalltalk/stage0. Train unsafe 3/12→12/12,
  injection 2/9→9/9 and out_of_role 0/6→6/6; authored benign controls stay allowed.
- `7a8e266`: added aggregate coverage, conditional precision/recall, reason-specific
  deny recall, slot attribution and a report CLI that never opens heldout/context
  files or prints dev row text/IDs, including backend-error paths. No gold edits.
- Dev: accuracy 44/84 (52.38%), deny precision 100%, unsafe recall 3/3, injection
  recall 0/6, out_of_role n/a (support 0), off_topic 2/3. Coverage 41/84 (48.81%),
  conditional precision/recall 36/41 (87.80%); p50/p95 1.1897/1.9475 ms.
  Navigate/result slot EM remains 75% each; their six dev slot-score failures
  are upstream route misses, with no correctly-routed slot-only mismatch.
- [Extended report](../../eval/router/rules_dev_report.md) lists genuine train
  extractor bugs and two unresolved slot-convention review candidates. No definite
  wrong train route label was established; no dev gold-label review was performed.
- Five original commits were the agent's posted, user-approved plan, versus the
  user's four-commit suggestion: shared-helper extraction was its own pure refactor.
- Independent original-SHA targeted pytest runs: 14fa40e 118, be58af9 130, 5461768
  163, ce55ae2 390, 5ae51f4 392 passed. Full-repository pytest was not claimed.
  Repository-wide Ruff at each SHA has exactly F821 get_roadmap_info at
  src/api/analysis.py:41/:349 and F401 unused datetime.date at src/db/seed.py:2.
- Remaining architecture deviation: multi-family lexical conflicts are accepted
  at 0.95 despite section 5.3 requiring stage-3 handoff. The classifier task must
  reconcile this; a classifier alone cannot repair accepted rule errors.
- Final heldout-free selection: 538 passed; task-owned Ruff/format checks pass.
  No classifier, LLM/network/DB/date-parser addition or navigate/howto/locate
  recall tuning. Existing user notes and all gold datasets remain unchanged.

## T2.3b dev-only diagnosis and stop (2026-10-15)

All fixes were derived from train utterances. Five outer stratified folds use seed 20261015; augmentation is generated only from each fitting fold. Original/noisy siblings share a group in the three-fold calibration split. Fixed deterministic rules already derived from train are not re-learned inside folds: this is OOF classifier diagnosis, not an unbiased estimate of end-to-end generalization. No held-out data or context fixture was opened and no held-out evaluation was run.

The baseline dev measurement and final tuning/measurement batch were the only real-dev invocations for their respective groups. Dev output was aggregate-only; no dev text or IDs were printed or used to derive fixes.

### Counts by final decision source

| Population | Source | Correct / support | Accuracy | Typo correct / support | Wrong clarify |
|---|---|---:|---:|---:|---:|
| Train OOF baseline | stage0 | 69/69 | 1.0000 | 6/6 | 0 |
| Train OOF baseline | cache | 0/0 | n/a | 0/0 | 0 |
| Train OOF baseline | rules | 97/105 | 0.9238 | 4/5 | 0 |
| Train OOF baseline | classifier | 25/33 | 0.7576 | 2/4 | 0 |
| Train OOF baseline | fallback | 26/45 | 0.5778 | 2/6 | 15 |
| Dev baseline | stage0 | 7/7 | 1.0000 | 3/3 | 0 |
| Dev baseline | cache | 0/0 | n/a | 0/0 | 0 |
| Dev baseline | rules | 29/32 | 0.9063 | 0/1 | 0 |
| Dev baseline | classifier | 21/23 | 0.9130 | 4/4 | 0 |
| Dev baseline | fallback | 10/22 | 0.4545 | 2/13 | 12 |
| Train OOF final | stage0 | 69/69 | 1.0000 | 6/6 | 0 |
| Train OOF final | cache | 0/0 | n/a | 0/0 | 0 |
| Train OOF final | rules | 108/113 | 0.9558 | 3/3 | 0 |
| Train OOF final | classifier | 28/37 | 0.7568 | 5/8 | 0 |
| Train OOF final | fallback | 25/33 | 0.7576 | 0/4 | 6 |
| Dev final | stage0 | 7/7 | 1.0000 | 3/3 | 0 |
| Dev final | cache | 0/0 | n/a | 0/0 | 0 |
| Dev final | rules | 33/36 | 0.9167 | 4/5 | 0 |
| Dev final | classifier | 25/27 | 0.9259 | 8/8 | 0 |
| Dev final | fallback | 10/14 | 0.7143 | 3/5 | 2 |

Baseline train OOF: 217/252 routes correct; 15 wrong clarifications (13 stage-4 overrides of a classifier prediction, one stage-4 abstention, one context-rule clarification). Seven typo route errors: rules 1, classifier 2, fallback 4. All 12 unsafe, 9 injection and 6 out-of-role train examples already passed stage 0; therefore no shared unsafe/role patterns were expanded from consumed evaluation evidence.

Baseline dev wrong clarify counts were fallback 12: classifier-origin 1, missing-target guard 3, stage-4 abstention 1, classifier overrides 7. Baseline dev typo failures: rules 1 and fallback 11. These aggregate counts were recorded, not used as a source for new wording.

Final train OOF: 230/252 (91.27%), navigate/result slots both 33/36, wrong clarify 6 (stage-4 candidate ambiguity). Typo route accuracy remains 14/21. The unaugmented final-code ablation also has 230/252 and 15/21 typo accuracy: augmentation has no demonstrated overall route gain and loses one typo route relative to that ablation. Retained as the requested seeded training procedure, not presented as an isolated quality improvement.

Final dev: 75/84 (89.29%), unsafe/injection deny recall 9/9, navigate/result slots 10/12 each, typo 18/21, wrong clarify 2 (fallback candidate ambiguity). Remaining nine route errors: rules 3, classifier 2, fallback 4. Both remaining wrong clarifications are gold navigate. Result has two extractor-only misses; navigate has two upstream route misses. Injection reason-exact recall is still 0/6 although all six are routed deny; route recall must not be read as reason classification accuracy.

STOP CONDITION: final dev accuracy is below 0.90. No additional routing rules or extractor changes were made after this measurement. Section 5.5 accuracy (0.93) and navigate slot (0.90) targets remain unmet. The 100+ real-utterance gate remains open.

### Implementation, evidence and limitations

- Candidate counting now represents distinct destinations, collapses CV/JD qualifiers under analysis and interview under report, and distinguishes an ambiguous profile/report destination from two alternative actions on one destination. A single candidate uses the classifier top actionable route; if its top label is clarify, the highest non-clarify label is used. Missing artifacts default to howto for single/no candidates. Broad partial vocabulary can still offer 2–4 distinct destination chips. Explicit record comparisons are not treated as bare deictics.
- Added train-derived locate/how-to phrases and bounded unambiguous one-edit matching for both observed and lexicon tokens of length >=5. Short tokens are excluded; raw spans are preserved. Shared stage-zero data is unchanged.
- Slot fixes cover suffix JD/CV refs, CV refs followed by analysis nouns, terminal question clauses, comparison qualifiers, metric noise and page-role prefixes. The implicit JD convention in “for FPT Java” remains unresolved; no gold annotations changed.
- Artifact v2 retains the train-only SHA-256 25dfa7a47266a9ad2530cea1b272ff28592a649f390ec495e1ea6042e69366b2. Augmentation seed 20261015, two copies per delete/swap/duplicate/fold-then-typo operation, min token length 2, first copy biased to the first token (duplication at its end). Grouped calibration keeps related variants together.
- Dev tuning grid: probability 0.20..0.90 step 0.05; margin 0..0.30 step 0.05; maximize route accuracy then classifier acceptance coverage, deterministic first tie. Selected ROUTER_CLF_THRESHOLD=0.20 and ROUTER_CLF_MARGIN=0.0. Tuning memoizes only probabilities; the final measured pass uses the actual pipeline and evicts decision and query-dependent lexical caches. Cache-miss p50/p95: 2.5949/17.2658 ms, 84 samples.
- Latency regression checks the single saved measurement bound to exact model-file and dev-data hashes plus threshold/margin; tests do not repeatedly evaluate dev. Final targeted router/shared-guard suite: 520 passed. Changed-file Ruff/format checks pass.
- Reused: local router, shared guard functions/data, raw-span extractor, metric and diagnostic arithmetic, installed sklearn/joblib. Created: eval/router/cv_report.py because existing helpers lack fold-local fitting and by-source confusion matrices; augmentation/model-builder helpers live in the existing trainer. No dependency, network, LLM, Jev or kNN addition.

### Source confusion matrices

Rows and columns use: smalltalk, howto, locate, result, navigate, clarify, deny. Cache matrices are zero because every scored request evicts decision caches. Full machine-readable reports: eval/router/t23b_train-cv_baseline.json, eval/router/t23b_dev_baseline.json, eval/router/t23b_train_cv_augmented.json, eval/router/t23b_dev_final.json.

Train OOF baseline

```text
stage0:
  smalltalk  36 0 0 0 0 0 0
  howto      0 0 0 0 0 0 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 0 0 0 0 0
  deny       0 0 0 0 0 0 33
cache:
  zero 7x7 matrix
rules:
  smalltalk  0 0 0 0 0 0 0
  howto      0 20 0 1 0 0 0
  locate     0 0 22 3 0 0 0
  result     0 0 0 24 0 0 0
  navigate   0 0 0 0 31 0 0
  clarify    0 0 0 0 4 0 0
  deny       0 0 0 0 0 0 0
classifier:
  smalltalk  0 0 0 0 0 0 0
  howto      0 11 1 0 0 0 0
  locate     0 0 3 0 0 0 0
  result     0 1 0 9 0 0 0
  navigate   0 0 0 2 0 0 0
  clarify    2 1 0 0 0 0 1
  deny       0 0 0 0 0 0 2
fallback:
  smalltalk  0 0 0 0 0 0 0
  howto      0 1 0 0 0 2 0
  locate     0 0 0 0 0 8 0
  result     0 0 0 0 0 2 0
  navigate   0 0 0 0 0 3 0
  clarify    0 3 0 0 0 25 0
  deny       0 1 0 0 0 0 0
```

Dev baseline

```text
stage0:
  smalltalk  2 0 0 0 0 0 0
  howto      0 0 0 0 0 0 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 0 0 0 0 0
  deny       0 0 0 0 0 0 5
cache:
  zero 7x7 matrix
rules:
  smalltalk  0 0 0 0 0 0 0
  howto      0 3 0 1 0 0 0
  locate     0 0 8 0 0 0 0
  result     0 0 0 9 0 0 0
  navigate   0 0 0 0 9 0 0
  clarify    0 0 0 0 1 0 0
  deny       0 1 0 0 0 0 0
classifier:
  smalltalk  10 0 0 0 0 0 0
  howto      0 5 0 0 0 0 1
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 0 0 0 0 1
  deny       0 0 0 0 0 0 6
fallback:
  smalltalk  0 0 0 0 0 0 0
  howto      0 0 0 0 0 2 0
  locate     0 0 0 0 0 4 0
  result     0 0 0 0 0 3 0
  navigate   0 0 0 0 0 3 0
  clarify    0 0 0 0 0 10 0
  deny       0 0 0 0 0 0 0
```

Train OOF final

```text
stage0:
  smalltalk  36 0 0 0 0 0 0
  howto      0 0 0 0 0 0 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 0 0 0 0 0
  deny       0 0 0 0 0 0 33
cache:
  zero 7x7 matrix
rules:
  smalltalk  0 0 0 0 0 0 0
  howto      0 21 0 1 0 0 0
  locate     0 0 30 2 0 0 0
  result     0 0 0 25 0 0 0
  navigate   0 0 0 0 32 0 0
  clarify    0 0 0 0 2 0 0
  deny       0 0 0 0 0 0 0
classifier:
  smalltalk  0 0 0 0 0 0 0
  howto      0 8 1 1 0 0 0
  locate     0 0 3 1 0 0 0
  result     0 1 0 8 0 0 0
  navigate   0 0 0 2 2 0 0
  clarify    2 0 0 0 0 5 0
  deny       0 1 0 0 0 0 2
fallback:
  smalltalk  0 0 0 0 0 0 0
  howto      0 0 0 0 0 4 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 2 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 1 0 1 25 0
  deny       0 0 0 0 0 0 0
```

Dev final

```text
stage0:
  smalltalk  2 0 0 0 0 0 0
  howto      0 0 0 0 0 0 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 0 0 0 0 0 0
  deny       0 0 0 0 0 0 5
cache:
  zero 7x7 matrix
rules:
  smalltalk  0 0 0 0 0 0 0
  howto      0 3 0 1 0 0 0
  locate     0 0 10 0 0 0 0
  result     0 0 0 10 0 0 0
  navigate   0 0 0 0 10 0 0
  clarify    0 0 0 0 1 0 0
  deny       0 1 0 0 0 0 0
classifier:
  smalltalk  9 0 0 0 0 0 0
  howto      0 6 0 0 0 0 1
  locate     0 0 2 0 0 0 0
  result     0 0 0 2 0 0 0
  navigate   0 0 0 0 0 0 0
  clarify    0 1 0 0 0 0 0
  deny       0 0 0 0 0 0 6
fallback:
  smalltalk  1 0 0 0 0 0 0
  howto      0 1 0 0 0 0 0
  locate     0 0 0 0 0 0 0
  result     0 0 0 0 0 0 0
  navigate   0 0 0 0 0 2 0
  clarify    0 1 0 0 0 8 1
  deny       0 0 0 0 0 0 0
```


T2.3b commit grouping deviation: `6a13a8b` combines the first three approved groups and the previously uncommitted T2.3 baseline needed for a buildable router commit. Documentation is separate; unrelated edits are not included.


## Architecture 6.3 — registry and locate (2026-10-15)

- Implemented the approved registry/locate/frontend/drift scope with 14 static-page guide targets. New `ui_actions` contains only highlight(element_id) and navigate(route_id, params); the legacy action/API contract remains during migration. No new acknowledgement endpoint, overlay, tour feature or UI operation was added.
- Reused the existing route guard, LocalRouter/rules, text folding, graph, API resource guard, dispatcher URL/DOM waits, highlighter, provider cancellation and manual action-card links. A classifier-only locate prediction cannot intercept a legacy imperative without locate evidence. Saved comparison links now enforce owner in SQL; no comparison resolver was added.
- Threshold 0.78 and top-1 margin 0.10 are settings-backed. The authored matcher regression set scores 44/44 (34 target matches, 10 abstentions); this is not held-out or real-user accuracy. Unknown/ambiguous locate goes to guide RAG with actions suppressed. Data-dependent empty/error states may leave a target absent; bounded DOM waits fail locally and manual links remain.
- Invalid role/registry output is rejected by the API and emits no actions. Existing run error sanitization maps this internal rejection to HTTP 503; no new run error protocol was introduced.
- Plan detail: relevant tests shipped with each feature; final regression fixes are in the drift/test commit. Documentation is a separate commit to follow architecture commit discipline. Provider tests use an explicit howto question about Chọn file, since locate now bypasses providers. Turbopack root includes the repository to import the same backend JSON files.
- Validation: all 143 combined backend assistant tests passed (including 21 UI cases). 34 frontend tests, type generation/TypeScript, frontend lint (two existing warnings), and production build passed. The build used real fonts and temporary isolated output because default `.next` refused an unlink; temporary build/tsconfig changes were restored. Ruff passes for changed Python files. Repository-wide Ruff still has three untouched errors in `src/api/analysis.py` and `src/db/seed.py`. Repository pytest fail-fast passes 20 tests then fails the untouched account registration profile test (demo name returned).

See [full registered-element list, matching behavior and checks](Assistant_v2/UI_LOCATE_IMPLEMENTATION.md).


## How-to RAG (architecture 6.1 and 6.2, 2026-10-15)

- Reused ingestion, hybrid ranking, LangGraph, LlmClient, mask-only gateway and T3.1 registries. Added corpus-versioned chunk UI metadata, bilingual pre-generation abstention, guide-only role/language/version cache and server-owned attachments. Shared router TTL/LRU storage was extracted in its own refactor commit.
- E5 requires unboosted top confidence >= 0.85; fallback hashing keeps the existing 0.42 scale. Forty authored negative cases abstain 40/40 with E5 and 39/40 with hashing; precision is 1.000 and 0.975 against 15 positive controls. No model calls occur on abstentions. Both 15-query before/after retrieval snapshots preserve result IDs/order and all measured rank metrics.
- The historical T0 MRR of 0.867 is not reproduced: current E5 is 0.855556 for both original and updated retrievers on the current guide corpus, while context recall is 1.000 versus historical 0.967. This is no implementation regression, not a claim that the old numeric MRR gate was met.
- Single-worker in-process caches remain a deployment limitation. Cache hits still retrieve to observe docs_version; UI actions are rebuilt/role-checked for the current page. Upstream streaming remains privacy-buffered by LlmClient; HTTP JSON/browser streaming is unchanged. No new business-data reads, qa_direct or career/CV/JD-content path.
- Recorded outputs verify masking/grounding contracts, not live model quality or universal semantic enforcement. The authored cases informed confidence calibration and are not independent held-out evidence. No live provider call/model download was used.
- Detailed configuration, baseline provenance, cache measurements, validation limitations and reproduction: [HOWTO_IMPLEMENTATION.md](Assistant_v2/HOWTO_IMPLEMENTATION.md). Unrelated repository lint/account-test failures remain outside this task.


## 2026-10-16 - architecture 3/9/10 streaming integration

- Retained the T0 LangGraph, run registry and T3 how-to/locate implementations.
  All seven local router decisions are wired; navigate/result are capability-menu
  stubs until M4. Template routes use no retrieval or provider calls.
- SSE is selected by Accept; legacy JSON and duplicate-run metadata stay supported.
  Section 9 has nine application event names plus heartbeat (ten total). See
  [implementation and verification](Assistant_v2/STREAMING_IMPLEMENTATION.md).
- Reused the existing PlaceholderFilter with opt-in deferred replacement, and the
  existing LlmClient/gateway with opt-in private text streaming. Incomplete
  sentences are buffered for cross-chunk identifier masking, then released as
  text tokens; this can delay initial visible output to a sentence boundary.
  Guide-policy checks after streaming are advisory notices, not semantic proof.
- Cards/chips/UI metadata use the existing turn context JSON under a server-owned
  assistant_output key. No database migration, replay store or extra orchestrator.
- Deployment remains single worker. Cancel/disconnect preserve guarded partial
  text with interrupted=true; startup sweep is reused. No reconnect replay,
  reasoning-content handling, confirmation UI, write tools or M4 resolver added.
- Frontend uses rAF batching, escaped partial text, Stop, a client request ID for
  each send/retry, JSON fallback, structured chips, role-checked links and saved
  history. Saved actions are displayed but never dispatched on history load.
- Legacy tests that expected analysis writes/navigation resolution were migrated
  to v2 expectations. Action-confirm isolation/idempotency tests seed historical
  actions explicitly, retaining coverage of the public legacy endpoint.
- Repository-wide Ruff still reports the pre-existing missing get_roadmap_info
  references in src/api/analysis.py and unused date import in src/db/seed.py.
  These unrelated source files and pre-existing user edits were left untouched.

- Verification: 845 scoped backend tests passed, 1 skipped; 43 frontend tests
  passed; typecheck and scoped Ruff/format checks passed. Frontend lint has zero
  errors and two existing api.ts navigation warnings. Full-repository pytest
  stops at the unrelated account-registration profile-name test, also reproduced
  in an uncached isolated run. The scoped run caches repeated test-fixture hash
  and verification calculations only; real sessions/ownership remain tested.
- Final guard regressions: 9 passed (15 deselected), covering score comparisons,
  deferred placeholder replacement and 138 possible split positions across seven
  inputs plus character-at-a-time partitions.
