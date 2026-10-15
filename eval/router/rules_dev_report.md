# Rules-only router dev baseline — 2026-10-15

Stages 0–2 plus the no-classifier fallback; rules implementation commit `ce55ae2`.
This is a synthetic development benchmark, not product/model quality or release acceptance.

Command (from the repository root):

```powershell
.venv/Scripts/python.exe -m eval.run --suite router --backend rules --split dev --output eval/router/rules_dev_report.json
```

The command returned **1**, as expected for failed quality gates. The p95 and backend-error gates passed. See [full machine-readable report](rules_dev_report.json).

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
