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
