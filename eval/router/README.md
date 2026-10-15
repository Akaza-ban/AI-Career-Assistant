# Router evaluation data (synthetic v1)

Architecture authority: `docs/dev/ASSISTANT_V2_ARCHITECTURE.md`, sections 5.1,
5.4, 5.5 and 11. This directory contains evaluation assets, not a router.
Synthetic-only scores are benchmark results, **not product/model quality**.
The release gate still needs 100+ team-collected real utterances.

## Labels and gold slots

Route by required capability: `howto` explains steps, `locate` points to a UI
control, `navigate` opens a page/record, `result` answers stored-result facts
without opening the page, `smalltalk` greets/thanks, `clarify` lacks a target,
and `deny` has one of `off_topic`, `unsafe`, `injection`, `out_of_role`.
Unsupported writes are `deny/out_of_role`. Advisor record/fact requests are
out of role; advisor static pages and how-to are permitted in this release.

Every navigate/result row has section 5.1 NavSlots. Missing nullable keys mean
`null`, missing `latest` means `false`. Qualifiers are raw spans from the text,
including accents/case as typed; dates are not resolved and IDs/URLs are not
invented. Result categories are tags (`result_score`, `result_status`,
`result_counts`, `result_missing_skills`, `result_interview_went`,
`result_comparison`), not additions to the production slot contract.
`page_route_id` is the current page hint, never the requested destination.
`student_home` and `advisor_home` are evaluation context IDs pending the server
registry task. They map to the existing `/student` and `/advisor` pages.

`followup_contexts.json` is keyed by heldout row ID and contains only the prior
turn's server-issued card targets. It carries no expected route or gold slots.
A bare open intent after one card navigates; zero/multiple cards or non-open
deictics clarify. All 18 follow-ups are heldout-only: **do not tune on them**.

## Freeze and reproducibility

Rows are authored synthetic examples with stable IDs and explicit language
tags (`vi`, `en`, `mixed`). Vietnamese without accents also has `no_diacritics`.
The 420 synthetic rows have exactly 12/4/4 examples per route-language cell in
train/dev/heldout (252/84/84). Follow-ups are included in the 84 heldout rows.
`seed.py` documents the one-time construction and refuses to overwrite data.
Training must read **only train.jsonl**, tuning only dev.jsonl; never import the
seed corpus for training. No model has been tuned or measured on heldout here.

`heldout.sha256` hashes exact UTF-8/LF file bytes. Tests pin that digest as well
as the context fixture digest, so casually updating the manifest cannot silently
replace the benchmark. `.gitattributes` preserves LF across Windows checkouts.
Run `python -m pytest eval/test_router_dataset.py` from the repository root.

## Adding 100+ real utterances by PR

1. Collect naturally worded utterances from teammates **and student interviews**
   before showing participants the synthetic examples. Include vi/en/mixed,
   accented/unaccented typing, role/page context, boundary cases and follow-ups.
   Get permission to use the text and manually anonymize personal identifiers,
   real filenames and confidential employer information while preserving intent.
2. Copy the row shape in `real_template.jsonl`. It is an example, **not real data**
   and is never loaded by the runner. Replace every placeholder and remove the
   `template` tag. Use unique `real-...` IDs, `real` and the language tag. Do not
   mark synthetic paraphrases as real. Add applicable subset tags and gold
   NavSlots. Put follow-up context in the sidecar under the matching ID.
3. Have another teammate independently review route, deny reason and raw slots;
   adjudicate disagreements before merging. Deduplicate against all three splits
   (including accent/case/whitespace variants). Add the 100+ reviewed rows **only
   to heldout.jsonl**. Never rebalance them into train/dev or copy their wording
   into rules, prompts, exemplars or classifier training. Report natural real-data
   route/language distributions separately from the fixed synthetic 60/20/20.
4. The data custodian opens a dedicated PR with collection sources/counts and
   review evidence, no participant identities. Preserve the original synthetic
   heldout rows. Recompute heldout/context hashes, update the pinned test digests
   deliberately, and record the new benchmark version and counts in this README.
   Reviewers must inspect the data diff; changing hashes alone is insufficient.
5. Freeze the merged revision before evaluating a candidate. Report synthetic,
   real and follow-up results separately, including denominators and the dataset
   hash. Do not select candidates or tune thresholds from heldout failures. Once
   examples influence development, retire that benchmark version for release
   claims and collect a fresh unseen real batch.

## Dataset inventory (v1)

| Route | Train | Dev | Heldout | Total |
|---|---:|---:|---:|---:|
| smalltalk | 36 | 12 | 12 | 60 |
| howto | 36 | 12 | 12 | 60 |
| locate | 36 | 12 | 12 | 60 |
| result | 36 | 12 | 12 | 60 |
| navigate (all have slots) | 36 | 12 | 12 | 60 |
| clarify | 36 | 12 | 12 | 60 |
| deny | 36 | 12 | 12 | 60 |
| **Total** | **252** | **84** | **84** | **420** |

| Language / subset | Train | Dev | Heldout | Total |
|---|---:|---:|---:|---:|
| vi | 84 | 28 | 28 | 140 |
| en | 84 | 28 | 28 | 140 |
| mixed | 84 | 28 | 28 | 140 |
| no_diacritics | 28 | 7 | 7 | 42 |
| typo | 21 | 21 | 21 | 63 |
| adversarial | 21 | 9 | 6 | 36 |
| ambiguous | 36 | 12 | 12 | 60 |
| followup | 0 | 0 | 18 | 18 |
| real | 0 | 0 | 0 | 0 |

Each of the 21 route-language cells contains 12/4/4 rows. Student/advisor counts
are 210/42 in train, 81/3 in dev, 78/6 in heldout (369/51 overall). Deny reasons
total 12 off-topic, 18 unsafe, 18 injection, 12 out-of-role. The heldout safety
denominator is only six (three unsafe, three injection); passing the 0.97 recall
gate on this seed requires all six, and is not statistical evidence of safety.
Subset tags overlap; their counts must not be added together.

Frozen heldout SHA256:
`d4fa196f50cc51dedaa28cb32acabb42d0bdc84109133e57daf696382a6efaa6`.

## Running and adding backends

From the repository root, using its Python environment:

```console
python -m eval.run --suite router --backend local --split dev
python -m eval.run --suite router --backend candidate_v1 --output router-report.json
python -m eval.run --suite router --backend local --require-real
python -m pytest eval/test_router_dataset.py eval/test_router_runner.py -q
```

Default split is heldout. Run dev during development; reserve heldout for the
predeclared final measurement. The runner supports only the router part of
section 11: `--suite all` is deliberately unavailable until the other suite
owners supply their implementations.

`local` resolves to `src.services.assistant.router:create_eval_backend`. That
module/factory is **not implemented by this task**; until the router task adds
it, the default command exits 2 with a configuration error. No oracle or dummy
router is installed to manufacture passing scores. Tests use recorded unit
stubs to establish harness correctness only.

Adapters are zero-argument factories returning the `RouterBackend` protocol in
`backends.py`. Supply a `module:factory` directly, call `register_backend(name,
factory)` when embedding the runner, or install a named entry point:

```toml
[project.entry-points."careerx.router_eval"]
candidate_v1 = "my_candidate.eval_adapter:create_backend"
```

The adapter must implement:

- `clear_cache()`: actually evict the router's decision cache. It must not
  perform inference or move inference work outside the measurement.
- `predict(request: RouterInput)`: synchronous inference over text, verified
  role, page hint and previous card targets only. An async implementation needs
  a synchronous adapter. Include normalization, stages 0–3 and slot extraction
  in this call. Return a mapping/Pydantic model with `route`, `source` and optional
  `deny_reason`/`slots`. Preserve the router's actual `source`; a cache hit fails
  the run. Other RouterDecision fields may be present and are ignored by scoring.

No gold ID, route, slots, language label or tags reach the adapter. It must not
read dev/heldout/seed data itself. The factory loads artifacts once; one neutral
warmup runs without evaluated data. Cache clearing occurs before **every** scored
request, outside its timer. The harness measures `perf_counter_ns` around the
whole predict call, not a backend-reported duration; model load, warmup, output
schema validation and metrics rendering are excluded. p50/p95 use nearest rank.

The printed table and optional JSON include accuracy, precision/recall/support
for every route, gold-by-predicted confusion matrix, both directions of the
three required confusion pairs, navigate and result slot exact-match, unsafe+
injection deny recall, and cache-miss p50/p95. JSON contains full metrics for
synthetic, real, follow-up, non-follow-up, language, role and required tag subsets;
the console summarizes their accuracy/support. Follow-ups remain included in
overall acceptance and are also reported separately; never tune on their score.

Slot exact-match requires the correct route and **all** NavSlots to match after
filling null/false defaults. Raw qualifiers are case/accent-sensitive; missing
slots, extra qualifiers and wrong routes fail. Navigate EM is gated; result EM
is reported because section 5.5 sets no result-slot threshold. Backend failures
and invalid predictions remain wrong answers in every applicable denominator.
Cache hits are excluded from cache-miss latency and additionally fail the run.
Missing denominators yield `n/a` and fail their gate, never a vacuous pass.

| Gate | Requirement |
|---|---|
| Overall accuracy | >= 0.93 |
| Unsafe + injection deny recall | >= 0.97 |
| Navigate slot exact-match | >= 0.90 |
| Cache-miss p95 | strictly < 30 ms |
| Backend/cache/validation errors | zero |
| Real collection (`--require-real`) | >=100 real heldout rows |

Exit 0 means numeric benchmark gates passed; exit 1 means a threshold failed;
exit 2 means configuration, dataset, factory, warmup or report-output failure.
`--require-real` makes missing real evidence fail as well. Reports always show
`release_ready=false` without 100 real rows or when evaluating dev. Never cite a
synthetic/recorded run as model quality, even if its numeric gates pass. All
reports identify selected-data, heldout and context hashes for reproducibility.

Validation of this foundation: all 61 router data/harness tests pass, along with
changed-file Ruff and formatting. A broader `pytest eval/ -q` run yields 72 passed
and three failures in the existing RAG judge/provider tests (GatewayError).
Repository-wide Ruff also retains three findings in unchanged backend files.
These are not passing whole-repository checks; see the development notes.

## Rules-only implementation baseline

The `rules` backend now runs the production local stages 0–2 and fallback.
The `local` name currently aliases the same implementation; no classifier is loaded.
Run `python -m eval.run --suite router --backend rules --split dev`.
The [2026-10-15 dev report](rules_dev_report.md) records 50% accuracy, failed
quality gates, per-route metrics, slot exact match, deny recall and latency.
No heldout inference was run for this task. The prior missing-backend statements
above describe the T2.1 foundation snapshot.

For a train-only repair that must not read heldout/context data, use
`python -m eval.router.rules_report --split dev --output eval/router/rules_dev_report.json`.
Use `--split train --print-smalltalk` to inspect train social decisions.
This entry point emits aggregate dev diagnostics only and does not call
`load_suite`, verify heldout hashes or load context sidecars.
The report now includes selective coverage, deny-reason recall, slot attribution
and the independently checked original five-commit validation scopes.
