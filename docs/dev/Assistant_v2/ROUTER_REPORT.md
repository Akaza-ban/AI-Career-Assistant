# Router stage 3/4 evaluation

Run date: 2026-10-15. Backend: `local`. Stage 3 is a calibrated `LinearSVC` over folded `char_wb` TF-IDF character n-grams (2–5); stage 4 is the local clarify/how-to fallback. Results are synthetic benchmark measurements, not product quality or real-user evidence.

The model artifact is `eval/router/artifacts/router-v1-25dfa7a47266.joblib`, format version 1. Its recorded SHA-256 is `25dfa7a47266a9ad2530cea1b272ff28592a649f390ec495e1ea6042e69366b2`, computed from the exact bytes of `eval/router/train.jsonl` only. Dev tuning selected `ROUTER_CLF_THRESHOLD=0.35` and `ROUTER_CLF_MARGIN=0.0`; the training script scored the full router pipeline on dev. Scikit-learn 1.9.1 and joblib 1.6.0 were available in the project venv and are declared in `requirements.txt`.

## Acceptance metrics

| Metric | Target | Dev (n=84) | Held-out (n=84) |
|---|---:|---:|---:|
| Overall route accuracy | ≥ 0.93 | 0.7976 (67/84) **FAIL** | 0.7381 (62/84) **FAIL** |
| Unsafe + injection deny recall | ≥ 0.97 | 1.0000 (9/9) PASS | 0.6667 (4/6) **FAIL** |
| Navigate slot exact match | ≥ 0.90 | 0.7500 (9/12) **FAIL** | 0.5000 (6/12) **FAIL** |
| Cache-miss p95 | < 30 ms | 16.1402 ms PASS | 19.7201 ms PASS |
| Backend errors | 0 | 0 PASS | 0 PASS |

The held-out run occurred once, after the implementation and dev tuning were frozen. Its dataset SHA-256 matches the frozen manifest: `d4fa196f50cc51dedaa28cb32acabb42d0bdc84109133e57daf696382a6efaa6`. The dev dataset SHA-256 is `c37a0ac6b9dbd866348b2ba5818fcad2a218e020d80693be563d8cd49220c544`. Each split contains 84 synthetic examples, balanced across seven routes and three languages. There are no real utterances; the release evidence requirement of 100+ real examples remains unmet.

## Per-route precision and recall

| Route | Dev precision | Dev recall | Support | Held-out precision | Held-out recall | Support |
|---|---:|---:|---:|---:|---:|---:|
| smalltalk | 1.0000 | 1.0000 | 12 | 1.0000 | 0.8333 | 12 |
| howto | 0.8889 | 0.6667 | 12 | 0.6364 | 0.5833 | 12 |
| locate | 1.0000 | 0.6667 | 12 | 1.0000 | 0.7500 | 12 |
| result | 0.9000 | 0.7500 | 12 | 0.7857 | 0.9167 | 12 |
| navigate | 0.9000 | 0.7500 | 12 | 0.8000 | 0.6667 | 12 |
| clarify | 0.4545 | 0.8333 | 12 | 0.4762 | 0.8333 | 12 |
| deny | 0.8462 | 0.9167 | 12 | 0.7778 | 0.5833 | 12 |

Result slot exact match was 0.7500 (9/12) on dev and 0.5833 (7/12) on held-out. Held-out slot diagnostics classify six navigate misses as two extractor errors and four upstream route errors; five result misses as four extractor errors and one upstream route error.

## Required confusion pairs

Counts show gold-to-predicted mistakes; pair support is the combined 24 gold rows for each route pair.

| Pair | Dev direction counts | Dev total / support | Held-out direction counts | Held-out total / support |
|---|---|---:|---|---:|
| navigate ↔ howto | navigate→howto 0; howto→navigate 0 | 0/24 | navigate→howto 0; howto→navigate 2 | 2/24 |
| locate ↔ howto | locate→howto 0; howto→locate 0 | 0/24 | locate→howto 0; howto→locate 0 | 0/24 |
| result ↔ navigate | result→navigate 0; navigate→result 0 | 0/24 | result→navigate 0; navigate→result 0 | 0/24 |

Full confusion matrices (gold rows, prediction columns; order: smalltalk, howto, locate, result, navigate, clarify, deny):

| Dev gold | smalltalk | howto | locate | result | navigate | clarify | deny |
|---|---:|---:|---:|---:|---:|---:|---:|
| smalltalk | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| howto | 0 | 8 | 0 | 1 | 0 | 2 | 1 |
| locate | 0 | 0 | 8 | 0 | 0 | 4 | 0 |
| result | 0 | 0 | 0 | 9 | 0 | 3 | 0 |
| navigate | 0 | 0 | 0 | 0 | 9 | 3 | 0 |
| clarify | 0 | 0 | 0 | 0 | 1 | 10 | 1 |
| deny | 0 | 1 | 0 | 0 | 0 | 0 | 11 |

| Held-out gold | smalltalk | howto | locate | result | navigate | clarify | deny |
|---|---:|---:|---:|---:|---:|---:|---:|
| smalltalk | 10 | 1 | 0 | 0 | 0 | 1 | 0 |
| howto | 0 | 7 | 0 | 0 | 2 | 2 | 1 |
| locate | 0 | 0 | 9 | 0 | 0 | 3 | 0 |
| result | 0 | 0 | 0 | 11 | 0 | 1 | 0 |
| navigate | 0 | 0 | 0 | 0 | 8 | 4 | 0 |
| clarify | 0 | 1 | 0 | 0 | 0 | 10 | 1 |
| deny | 0 | 2 | 0 | 3 | 0 | 0 | 7 |

## Additional split results

All values below are accuracy with support; `n/a` means the split has no examples of that subset.

| Subset | Dev | Held-out |
|---|---:|---:|
| follow-up | n/a (0) | 0.6667 (18) |
| non-follow-up | 0.7976 (84) | 0.7576 (66) |
| synthetic | 0.7976 (84) | 0.7381 (84) |
| real | n/a (0) | n/a (0) |
| no diacritics | 1.0000 (7) | 1.0000 (7) |
| typo | 0.4286 (21) | 0.5714 (21) |
| adversarial | 1.0000 (9) | 0.6667 (6) |
| ambiguous | 0.8333 (12) | 0.8333 (12) |
| Vietnamese | 0.8214 (28) | 0.8214 (28) |
| English | 0.7143 (28) | 0.6786 (28) |
| mixed | 0.8571 (28) | 0.7143 (28) |
| student | 0.7901 (81) | 0.7564 (78) |
| advisor | 1.0000 (3) | 0.5000 (6) |
| admin | n/a (0) | n/a (0) |

Cache-miss p50 was 3.4851 ms on dev and 10.2737 ms on held-out. The held-out latency support is 84; the dev latency support is 84. No router backend errors occurred.

## Multi-family versus single-family dev decisions

Here “precision” is the share of utterances whose final route matched its gold route, grouped by the number of lexical families present in the utterance. Family counting includes the locate-button and result-question patterns.

| Family matches | Correct / support | Decision precision |
|---|---:|---:|
| One family | 40/49 | 0.8163 |
| Two or more families | 2/2 | 1.0000 |
| No family | 25/33 | 0.7576 |

The multi-family sample is only two dev utterances, so its 100% result is not a stable quality estimate.

## Failure analysis and next experiment

Held-out misses all three quality gates: accuracy is 19.19 percentage points below target, unsafe-plus-injection deny recall is 30.33 points below target, and navigate slot exact match is 0.40 below target. Latency and backend reliability pass. The principal observed gaps are weak generalization to typos and boundary wording, frequent clarify predictions for gold locate/navigate/result requests, and missed held-out unsafe cases (unsafe 1/3, injection 3/3). The deny gate combines those six cases; the individual supports are small. Slot diagnostics also show that upstream route selection and the existing raw-slot extractor both contribute.

The next proposed experiment is an **embedding-kNN challenger** using the repository’s existing local embedder and train exemplars, compared on a newly frozen benchmark revision with the same route, slot, safety and latency metrics. It is proposed only; it has not been implemented or evaluated. Do not use this consumed held-out split for tuning. The current 84-example synthetic held-out suite also contains zero real utterances and cannot establish release readiness.

## T2.3b dev-only addendum

2026-10-15. Held-out was not re-run; its consumed utterances and context fixture were not opened. The historical evaluation above is unchanged. The 100+ real-utterance gate remains open. All fixes came from five-fold stratified train diagnosis (seed 20261015); dev was used for aggregate measurement and the explicitly requested threshold/margin tuning only.

The final dev score is **75/84 (89.29%)**, below the task stop threshold of 0.90. Routing changes stopped after this measurement. It improves the prior dev score by eight correct routes, but does not satisfy section 5.5 acceptance.

| Metric | Target | Dev baseline | T2.3b dev | Status |
|---|---:|---:|---:|---|
| Accuracy | >=0.93 | 67/84 (0.7976) | 75/84 (0.8929) | FAIL |
| Unsafe/injection deny recall | >=0.97 | 9/9 | 9/9 (1.0000) | PASS |
| Navigate slot exact match | >=0.90 | 9/12 | 10/12 (0.8333) | FAIL |
| Cache-miss p95 | <30 ms | 13.2683 ms | 17.2658 ms | PASS |
| Backend errors | 0 | 0 | 0 | PASS |

Result slot exact match: 10/12 (0.8333). Cache-miss p50: 2.5949 ms. All 84 measured requests evicted decision and query-dependent lexical caches. The latency regression reuses this exact model/dev-hash-bound record instead of running dev inference again.

### Train diagnosis and supported changes

Train OOF accuracy rose from 217/252 (86.11%) to 230/252 (91.27%); navigate and result slot exact match are both 33/36. Rules are fixed train-derived code, not re-learned inside each fold; the classifier and noisy variants are fitted only on the fitting fold. This is diagnostic evidence rather than an unbiased estimate for the complete router.

The baseline train diagnosis found 15 wrong clarifications: 13 stage-4 overrides, one abstention and one context rule. The final count is six. Baseline train typo route errors split across rules (1), classifier (2), fallback (4). Seeded augmentation has no demonstrated route-accuracy gain over the final unaugmented ablation (both 230/252); typo accuracy is 14/21 with augmentation versus 15/21 without it. Overall dev typo accuracy improves from 9/21 to 18/21, but that gain is not attributed to augmentation alone.

Implemented distinct-destination candidate counting, removal of unconditional classifier-navigation blocking, explicit-entity comparison handling, train-supported family phrases, one-edit long-token fuzzy lexicon matching, and raw-span slot-boundary corrections. No unsafe/out-of-role patterns were added: all 12 unsafe, 9 injection and 6 out-of-role train examples already pass stage zero. Expanding patterns from consumed held-out failures would violate the task data boundary.

Artifact: `eval/router/artifacts/router-v2-25dfa7a47266.joblib`. The original train-only content SHA-256 is unchanged. Metadata records seed 20261015, delete/swap/duplicate/fold-then-typo, two variants per operation, min token length 2 and prefix bias on the first copy. Original/noisy siblings remain together in three-fold calibration groups. Dev tuning selected **ROUTER_CLF_THRESHOLD=0.20**, **ROUTER_CLF_MARGIN=0.0** over the predeclared grid; config defaults match.

### Final dev error attribution

| Source | Correct / support | Accuracy | Typo correct / support | Wrong clarify |
|---|---:|---:|---:|---:|
| stage0 | 7/7 | 1.0000 | 3/3 | 0 |
| cache | 0/0 | n/a | 0/0 | 0 |
| rules | 33/36 | 0.9167 | 4/5 | 0 |
| classifier | 25/27 | 0.9259 | 8/8 | 0 |
| fallback | 10/14 | 0.7143 | 3/5 | 2 |

The nine remaining route errors are rules 3, classifier 2, fallback 4. Both remaining wrong clarifications are emitted by stage-4 candidate ambiguity on gold navigate requests. The two navigate slot misses are upstream route misses; the two result slot misses are extractor-only. They were not used to add further fixes. Unsafe/injection route recall passes on dev, while injection reason-exact recall is still 0/6; this is not evidence of improved held-out unsafe coverage.

[The T2.3b notes](../ASSISTANT_V2_NOTES.md#t23b-dev-only-diagnosis-and-stop-2026-10-15) record baseline/final train and dev source counts and per-source confusion matrices. The aggregate evidence is in `eval/router/t23b_dev_final.json` and the train CV reports.

### Section 5.5 confusion matrix and route metrics

| Gold / prediction | smalltalk | howto | locate | result | navigate | clarify | deny |
|---|---:|---:|---:|---:|---:|---:|---:|
| smalltalk | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| howto | 0 | 10 | 0 | 1 | 0 | 0 | 1 |
| locate | 0 | 0 | 12 | 0 | 0 | 0 | 0 |
| result | 0 | 0 | 0 | 12 | 0 | 0 | 0 |
| navigate | 0 | 0 | 0 | 0 | 10 | 2 | 0 |
| clarify | 0 | 2 | 0 | 0 | 1 | 8 | 1 |
| deny | 0 | 1 | 0 | 0 | 0 | 0 | 11 |

All three tracked pairs—navigate↔howto, locate↔howto and result↔navigate—have zero errors in both directions, each with support 24.

| Route | Precision | Recall | Support |
|---|---:|---:|---:|
| smalltalk | 1.0000 | 1.0000 | 12 |
| howto | 0.7692 | 0.8333 | 12 |
| locate | 1.0000 | 1.0000 | 12 |
| result | 0.9231 | 1.0000 | 12 |
| navigate | 0.9091 | 0.8333 | 12 |
| clarify | 0.8000 | 0.6667 | 12 |
| deny | 0.8462 | 0.9167 | 12 |

Subset accuracy: typo 18/21; no-diacritics 7/7; ambiguous 8/12; vi 25/28; en 24/28; mixed 26/28. There are no dev follow-ups or real utterances.

### Validation and scope

Targeted router, train-derived regressions and shared-guard tests: **520 passed**. Changed-file Ruff and format checks pass. Regression coverage includes distinct candidates, missing artifacts, deterministic noise/predictions, calibration grouping, long-token fuzzy bounds/raw spans, train slot failures, aggregate-only dev output, and the recorded cache-miss latency budget.

Reused the local router, shared guard helpers, raw-span extractor, existing metrics/diagnostics and installed sklearn/joblib. Created `eval/router/cv_report.py` for fold-local model fitting and source-level diagnosis; augmentation stays in the existing trainer. No new dependency, Jev, kNN, LLM or network operation was added. The lack of a train-supported safety-pattern extension and the reuse of one saved dev latency measurement are deliberate scope decisions. No further rules were added after the below-0.90 stop condition.

Commit grouping deviation: runtime, diagnostic evidence and tests are in `6a13a8b` because the required prior T2.3 baseline was still uncommitted. The approved first three groups were combined into that buildable commit; the report/notes are a separate documentation commit. Unrelated working-tree edits remain excluded.
