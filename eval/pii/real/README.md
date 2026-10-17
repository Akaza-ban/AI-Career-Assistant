# Held-out, team-supplied CVs

This directory intentionally contains no invented CVs. Supply 10+ hand-anonymized
real-format CVs and human-reviewed annotations. Keep these out of model selection
and tuning. Local CV data and annotations are ignored by Git.

Each `*.json` has the same schema as a row of `../golden.jsonl`, with category
`cv`, `review_status: human_reviewed`, and `document` relative to this directory.
Use a non-identifying sample ID. Annotation offsets and text refer to the original
transcription; `filename_entities` refer to the original filename. Include all
third-party identifiers. The loader warns and skips when no JSON files exist.

The runner reports real results separately. An absent set never passes the
shipping gate; a present set below ten CVs also cannot pass it.
