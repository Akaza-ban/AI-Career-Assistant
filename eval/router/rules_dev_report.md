# Rules-only router dev baseline — 2026-10-15

Stages 0–2 plus the no-classifier fallback; rules implementation commit `ce55ae2`.
This is a synthetic development benchmark, not product/model quality or release acceptance.

Command (from the repository root):

```powershell
.venv/Scripts/python.exe -m eval.run --suite router --backend rules --split dev --output eval/router/rules_dev_report.json
```

The original command returned **1**, as expected for failed quality gates. The p95 and backend-error gates passed. These are the historical pre-repair measurements; the [machine-readable report](rules_dev_report.json) now records the follow-up measurement below.

| Metric | Result | Support |
|---|---:|---:|
| Accuracy | 50.00% | 42/84 |
| Navigate slot exact match | 75.00% | 9/12 |
| Result slot exact match | 75.00% | 9/12 |
| Deny recall, unsafe/injection | 33.33% | 3/9 |
| Deny recall, all deny reasons | 41.67% | 5/12 |
| Cache-miss p50 | 1.1929 ms | 84 |
| Cache-miss p95 | 2.1228 ms | 84 |
| Backend errors | 0 | 84 |

| Route | Precision | Recall | Gold support |
|---|---:|---:|---:|
| smalltalk | n/a | 0.00% | 12 |
| howto | 12.00% | 25.00% | 12 |
| locate | 100.00% | 66.67% | 12 |
| result | 75.00% | 75.00% | 12 |
| navigate | 90.00% | 75.00% | 12 |
| clarify | 33.33% | 66.67% | 12 |
| deny | 100.00% | 41.67% | 12 |

All 84 rows are synthetic. Dev contains **zero follow-up rows**, so its follow-up accuracy is n/a; no heldout predictions were run or used to tune these rules. The harness still verifies dataset integrity and loads the existing context sidecar. The exact-one-target follow-up contract is tested separately for zero, one and two targets, changed conversations, other deictic phrases, and adapter forwarding.

The largest gaps are expanded greetings/thanks outside the reused whole-utterance pattern, typos, varied how-to wording, and semantic injection paraphrases. Passing the existing pattern regressions does not establish high deny recall. Stage 3 is deliberately absent; its separate task must measure the remaining gap. There is no guarantee from this run that the classifier will satisfy the release gates.

## Reuse and implementation boundaries

- `agent.normalized` is now the shared `assistant.text.fold_diacritics` (legacy import retained), also used by the existing security inspection normalization. No Unidecode or new dependency.
- `sanitize_and_inspect_prompt`, `is_out_of_scope` and `is_chitchat` are called directly. Existing regex strings were moved unchanged to `assistant/resources/guardrails.json`. Existing student advisor/dashboard/cố-vấn terms and the sharing exception were extracted from `_target_route` into `is_role_forbidden`.
- The old command-versus-how-to clause distinction informs rules so “how do I open…” remains instructional and a later explicit open imperative can navigate. The old graph/HTTP behavior remains intact.
- All new vocabulary, qualifier patterns, candidate labels and clarification wording live in `router/resources/lexicons.json`. Parameterized tests cover every phrase/entity/page/date/metric/language entry; each regex has an explicit test row, and additive guards/templates/candidate defaults are exercised.
- `LocalRouter.decide(text, role=..., page_route_id=..., previous_targets=...)` is synchronous and local. The offline regression blocks DB, network and model/provider imports during actual prediction.
- No classifier, model calls, DB queries, date interpretation, registry, resolver or endpoint migration is implemented. `nav_mode=agent` is a decision only; it never invokes an agent.

## Clarifications recorded for the next tasks

- Section 5.1 names but does not define `LocateSlots`: it contains raw `target_hint` and optional `page_hint`, with no selector/element ID. Decisions add typed semantic `chips` and an optional trusted `card_target` so clarification and bare-open outputs are executable later.
- Prior cards must come from an owner-checked persisted server turn, never a client text payload. Exactly one card is carried unchanged; the later execution boundary still owns registry, role and ownership checks. Context-dependent decisions bypass the text/role/page cache.
- The requested conflict order is applied to clear lexical matches: deny > locate > navigate > result > howto. How-to clauses do not turn their quoted open verb into an imperative. Unrecognized partial navigation/UI vocabulary clarifies with 2–4 semantic chips; otherwise the no-classifier fallback is howto.
- Raw dates remain NFC surface phrases. Fast/agent selection recognizes qualifier syntax only; T4.1 performs date validation and interpretation. Unsupported temporal/free qualifiers, comparisons, multi-metric results and compound targets select agent.
- Cache `get` returns an equal, deep-copied decision. The router changes provenance to `cache` on a hit and rebinds raw spans/language for spelling variants sharing a folded key. It never caches fallback/stage0/low-confidence/context decisions or resolved targets.
- Cache defaults: `ROUTER_CACHE_TTL_S=300`, `ROUTER_CACHE_MAX=1024`, `ROUTER_CACHE_THRESHOLD=0.9`; input bound `ROUTER_MAX_INPUT_CHARS=8000` follows existing chat size. Unknown/neutral language defaults to vi. Deployment remains single-worker with an in-process cache.

## Validation

- Final router/model/cache/lexicon/follow-up/offline-boundary, legacy guard/helper, and dataset/harness tests: 453 passed.
- Legacy intent-classification regression selection: 8 passed. Baseline before implementation: 280 assistant RAG/guard and router harness/data tests passed.
- Changed-scope Ruff check passed; formatting check passed. Repository-wide Ruff retains the three baseline errors: two undefined `get_roadmap_info` uses in `src/api/analysis.py`, and unused `datetime.date` in `src/db/seed.py`.
- The quality evaluation is a measured failure of its numeric gates, separate from passing implementation/harness tests.

## Follow-up: train-only stage zero and aggregate diagnostics

Runtime changes: `21a0d73` (shared stage-zero repair), `7a8e266` (diagnostics).
The preceding baseline is historical; [the machine-readable report](rules_dev_report.json) now contains this follow-up run.

### Data boundary and reproduction

All pattern changes came from train failures and authored positive/benign counterparts.
No dev misses were read or printed for tuning. Only aggregate dev diagnostics were exposed.
Neither heldout, its hash nor its context sidecar was opened in this follow-up; no gold file was edited.
The original runner's `load_suite` reads heldout even for dev, so this task uses the new entry point instead:

```powershell
.venv/Scripts/python.exe -m eval.router.rules_report --split train --print-smalltalk
.venv/Scripts/python.exe -m eval.router.rules_report --split dev --output eval/router/rules_dev_report.json
```

The first command prints all 36 full decisions; [saved train decisions](train_stage0_decisions.jsonl) retain their text and actual provenance. All 36 return `route=smalltalk, source=stage0`.
The second prints aggregate metrics only and returns 1 because quality gates remain unmet.
An authored test rejects access to any heldout/context file and verifies that dev IDs/text are not printed.

### What was repaired

This was not a harness label-mapping bug. The shared `is_chitchat` regex only accepted short whole utterances, so names, vocatives, introductions and gratitude tails failed. Its preprocessor also removed every standalone `a`, including English articles. The existing pattern data was extended from train; English articles now survive, and full-utterance matching still rejects greeting prefixes followed by real requests.

Unsafe and role patterns formerly located in router lexicons were moved into the existing shared `assistant/resources/guardrails.json`, then extended. Injection checks extend its existing `attacks` list. One `inspect_prompt_reason` scanner now serves both the legacy sanitizer and router stage zero; there is no parallel production list. Explicit harm requests remain denied while protection/detection, shared-CV guidance and greeting-plus-request controls stay allowed.

Train-only evidence ([summary](stage0_train_summary.json)):

| Train subset | Before stage-zero correct | After stage-zero correct |
|---|---:|---:|
| Smalltalk | 0/36 | 36/36 |
| Unsafe | 3/12 | 12/12 |
| Injection | 2/9 | 9/9 |
| Out of role | 0/6 | 6/6 |
| Off topic (not tuned) | 6/9 | 6/9 |

### Current dev metrics

| Metric | Value | Support |
|---|---:|---:|
| Overall accuracy | 52.38% | 44/84 |
| Deny precision | 100.00% | 5 predicted deny |
| Deny recall, all reasons | 41.67% | 5/12 |
| Unsafe/injection deny recall | 33.33% | 3/9 |
| Navigate slot exact match | 75.00% | 9/12 |
| Result slot exact match | 75.00% | 9/12 |
| Cache-miss p50 / p95 | 1.1897 / 1.9475 ms | 84 |
| Backend errors | 0 | 84 |

Deny precision remains **100%**. Train recall gains do not establish generalization: dev injection recall is still zero. The heldout and real-utterance gaps remain unmeasured.

| Route | Precision, all rows | Recall, all rows | Gold support |
|---|---:|---:|---:|
| smalltalk | 100.00% | 16.67% | 12 |
| howto | 13.04% | 25.00% | 12 |
| locate | 100.00% | 66.67% | 12 |
| result | 75.00% | 75.00% | 12 |
| navigate | 90.00% | 75.00% | 12 |
| clarify | 33.33% | 66.67% | 12 |
| deny | 100.00% | 41.67% | 12 |

### Confusion matrix

Rows are gold; columns are predictions.

| Gold / prediction | smalltalk | howto | locate | result | navigate | clarify | deny | error |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| smalltalk | 2 | 10 | 0 | 0 | 0 | 0 | 0 | 0 |
| howto | 0 | 3 | 0 | 3 | 0 | 6 | 0 | 0 |
| locate | 0 | 0 | 8 | 0 | 0 | 4 | 0 | 0 |
| result | 0 | 3 | 0 | 9 | 0 | 0 | 0 | 0 |
| navigate | 0 | 0 | 0 | 0 | 9 | 3 | 0 | 0 |
| clarify | 0 | 3 | 0 | 0 | 1 | 8 | 0 | 0 |
| deny | 0 | 4 | 0 | 0 | 0 | 3 | 5 | 0 |

### Decided coverage and selective precision/recall

“Decided” means a valid `source=stage0` or `source=rules` prediction with confidence >= 0.9. Fallback decisions (including predicted clarify) and low-confidence predictions are excluded from this subset, not from overall accuracy. No classifier is present.

| Source | Rows | Share of all 84 |
|---|---:|---:|
| Stage 0 | 7 | 8.33% |
| Stage 2 rules | 34 | 40.48% |
| Total decided | 41 | 48.81% |
| Not decided by stage 0/2 | 43 | 51.19% |

Among decided rows, 36/41 are correct: micro precision and micro recall are both **87.80%** on that selected population. Correct confident decisions cover 42.86% of all rows. Conditional recall below uses only gold rows inside the decided subset; it must not be confused with full-dev recall.

| Route | Precision among decided | Recall among decided | Gold support among decided |
|---|---:|---:|---:|
| smalltalk | 100.00% | 100.00% | 2 |
| howto | 75.00% | 50.00% | 6 |
| locate | 100.00% | 100.00% | 8 |
| result | 75.00% | 100.00% | 9 |
| navigate | 90.00% | 100.00% | 9 |
| clarify | n/a | 0.00% | 1 |
| deny | 100.00% | 83.33% | 6 |

### Deny recall by gold reason

Route recall counts any correct deny route; reason-exact recall additionally requires the correct `deny_reason`.

| Gold reason | Correct deny route / support | Route recall | Reason-exact recall |
|---|---:|---:|---:|
| unsafe | 3/3 | 100.00% | 100.00% |
| injection | 0/6 | 0.00% | 0.00% |
| out_of_role | 0/0 | n/a | n/a |
| off_topic | 2/3 | 66.67% | 66.67% |

### Slot misses: conventions, extraction, and upstream routing

Exact-match scores and gold annotations are unchanged. The diagnostic categories are mutually exclusive. A convention candidate means only NFC/whitespace or generic page-word differences; it is a review flag, not proof the gold is wrong. Diacritic folding, implicit JD inference and date interpretation never forgive a mismatch. A wrong route is kept separate because the required extractor was not selected.

| Dev gold route | Total misses | Gold-convention candidates | Extractor bugs on correct route | Upstream route misses |
|---|---:|---:|---:|---:|
| navigate | 3 | 0 | 0 | 3 |
| result | 3 | 0 | 0 | 3 |

Thus dev has zero slot-only mismatches on correctly routed navigate/result rows; its six slot-score failures are upstream route failures. No individual dev misses were inspected to reach this aggregate conclusion. This does not imply the extractor has no bugs: train has 4 navigate and 9 result extractor bugs, plus 5 and 12 upstream route misses respectively.

Train examples of genuine uncorrected extractor bugs are `syn-navigate-en-06` (suffix JD reference dropped), `syn-result-en-03` (CV reference swallows “analysis”), `syn-result-en-11` (JD reference swallows terminal “go”), and `syn-result-en-01` (“match score” becomes a free reference). They are documented, not tuned in this stage-zero task.

### Suspect gold labels / annotation review queue

No definite wrong train route label was established. No dev gold-label review was performed. Two train **slot-convention** ambiguities need adjudication, without silently changing either gold or scores:

- `syn-navigate-en-09`: “Go to my latest analysis for FPT Java” annotates `jd_ref=FPT Java` despite omitting the JD noun. The current extractor retains `free_ref=for FPT Java`. Clarify whether implicit JD inference is the required annotation convention.
- `syn-navigate-en-04`: “Take me to the advisor dashboard” annotates `page_hint=advisor dashboard`, while the raw registry-oriented hint is `dashboard`. Section 5.1 does not specify how much role wording belongs in page_hint. This remains an exact-match miss pending review.

These are suspected annotation ambiguities, not declarations that gold is incorrect. Other observed train slot errors above are extractor bugs.

### Deviations, missing work, and notes

- **Five commits versus the suggested four:** the user suggested four; the agent posted a five-commit plan before coding and the user approved it. The additional first commit was the pure shared-helper/pattern extraction, separated from feature changes per architecture commit discipline. Tests shipped with each feature rather than waiting for a final test-only commit. The implemented original sequence matched the approved plan.
- **Initial gaps:** train social coverage was not tested; the initial dev report showed 0% smalltalk recall but the missing shared pattern coverage was left for a classifier. This was insufficient. Initial unsafe/role checks also lived in a second router data location, and the report lacked the requested diagnostics. Those gaps are addressed here.
- **Validation wording:** the original final response reported targeted tests, not a full-repository pytest run at each commit. The independent audit below makes that scope explicit. It is not evidence that every unrelated repository test passes.
- **Remaining architecture deviation:** the rule engine accepts clear multi-family lexical conflicts with confidence 0.95 according to precedence. Section 5.3 instead says multiple-family matches pass to stage 3. The classifier/handoff is outside this follow-up; high-confidence rule errors will not automatically be corrected merely by adding a classifier. This must be reconciled in that task. No recall lexicons were tuned here.
- **Contract extensions / assumptions:** LocateSlots was undefined in 5.1, so it contains raw target_hint/page_hint; decisions add semantic chips and a trusted prior card_target. Context-dependent deictics bypass the mandated text/role/page cache; hits change source to cache and rebind raw spelling/language. Empty input uses off_topic, oversized input unsafe; unknown language defaults to vi. Fast/agent mode is a syntactic hint; date interpretation remains T4.1. Single-worker in-process caching remains a limitation.
- **Scope held:** no classifier, model call, network, DB query, date parsing, heldout access, navigation/howto/locate recall tuning or gold edits. Router matching/rules/extractor files and non-stage-zero rule lexicon sections are unchanged. The original LangGraph/API is not migrated by this package task.
- **ASSISTANT_V2_NOTES.md:** the original “T2.2 — local router stages 0–2” entry records contracts/cache/raw-date/role assumptions and baseline metrics. A new “T2.2 follow-up — train-only stage zero and independent validation” entry records this repair, aggregate results, data boundary, unresolved handoff and audit scope. Existing user notes are preserved.

### Reused versus created

Reused/extracted: legacy `agent.normalized` folding, sanitizer/security normalization, whole-utterance greeting handling, scope regexes, role terms/sharing exception, imperative-vs-howto distinction, `get_settings()`, and the T2.1 dataset/input contract, metric arithmetic and evaluator. Existing patterns were moved/extended, not replaced with a parallel security engine.

Created because no equivalent existed: the seven-route typed models, raw slot mapping/extractor, rule engine, bounded TTL decision cache, semantic chip/card contracts and eval adapter. This follow-up creates aggregate diagnostic helpers, the heldout-free report CLI, train regressions, decision evidence and historical commit audit artifacts. No new dependency was installed.

### Independent audit of the original five commits

Each immutable SHA was tested in a separate source snapshot using the same installed venv. Snapshots contained no heldout or context data. Commands and full outputs are in [the audit artifact](router_commit_audit.json). Targeted pytest scopes grow with the features present at each SHA; they are not whole-repository pytest runs.

| Original commit | Targeted pytest | Repository-wide Ruff |
|---|---:|---|
| `14fa40e` | 118 passed | exactly the same 3 baseline findings |
| `be58af9` | 130 passed | exactly the same 3 baseline findings |
| `5461768` | 163 passed | exactly the same 3 baseline findings |
| `ce55ae2` | 390 passed | exactly the same 3 baseline findings |
| `5ae51f4` | 392 passed | exactly the same 3 baseline findings |

The Ruff findings at every original commit, and again at current HEAD, are:

1. `F821`, `src/api/analysis.py:41`: undefined `get_roadmap_info`.
2. `F821`, `src/api/analysis.py:349`: undefined `get_roadmap_info`.
3. `F401`, `src/db/seed.py:2`: unused `datetime.date`.

Final follow-up validation: **538 passed** in the heldout-free integrated selection. Task-owned Ruff and formatting checks pass. Unrelated pre-existing user edits are excluded from scoped formatting and remain untouched. No claim is made that full-repository pytest or repository-wide Ruff is green.
