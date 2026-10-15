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
