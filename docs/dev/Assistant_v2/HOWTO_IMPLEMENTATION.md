# How-to RAG: architecture 6.1 and 6.2

Implemented on 2026-10-15 using the existing guide chunker/indexer, Chroma + BM25 retriever, LangGraph, privacy gateway, LlmClient and T3.1 registries. No new retrieval engine, provider gateway, business-data reader or frontend action protocol was introduced.

## Behavior

- Ingestion derives static route_id from the route registry, including legacy aliases. Registered data-agent-target selectors become per-chunk ui_targets; optional frontmatter ui_targets are validated against the document role/route. Existing selector/route fields remain readable. A deterministic corpus-wide content/metadata hash stamps docs_version in Chroma and BM25. Rebuild the guide index to acquire these fields in an existing deployment.
- The existing absolute/relative citation gates and RRF ordering remain intact. RAG_ABSTAIN_THRESHOLD defaults to 0.42. E5 additionally requires an unboosted top-result score >= RAG_SEMANTIC_ABSTAIN_THRESHOLD (0.85). Keeping this confidence separate prevents the current-page boost from authorizing an unrelated answer. The hashing fallback retains its existing scale. Abstention returns the role-specific vi/en capability menu before any generation call.
- How-to generation uses the configured LLM_MODEL_AGENT (default deepseek-flash), thinking=False, chat_stream, no tools, one generation request. Masked question and last four history messages are quoted data; full retrieved guide chunk text is escaped inside individual <untrusted_document> tags. Page state, selected IDs and permitted student IDs are excluded. The prompt limits the answer to six steps, the supplied evidence and the user's language, and forbids personal-data claims and career/CV/JD-content advice. Mixed language uses the existing Vietnamese default.
- Citations are constructed from role/route-filtered retrieval, never model prose. A conservative output guard rejects personal possessives/assertions, forged Markdown links and numeric citation markers before emission/caching. These checks and recorded outputs are contract evidence, not proof that every possible model sentence is semantically grounded.
- Successful sanitized guide answers use the existing bounded TTL/LRU storage extracted from the router cache. The key is sha256(folded masked query | role | language | docs_version); TTL defaults to 300 seconds, capacity to 256. Entries contain guide text, retrieval citations and top-chunk attachment metadata. Abstentions, provider failures, refusals and offline excerpts are not cached. Retrieval still runs on hits to observe the indexed corpus version.
- A generated/cached answer can attach a static navigate/highlight from the top chunk when score >= RAG_UI_THRESHOLD (0.65). The first ui_target is used, with navigation first if needed. Targets, route consistency and role are checked on every hit; dynamic routes requiring record IDs are rejected. Model text cannot select actions. Legacy endpoints and non-how-to migration paths remain available.
- Streaming is upstream through LlmClient. The shared mask-only gateway buffers a complete response before yielding sanitized content, preserving protection against identifiers split across chunks. The current HTTP response remains JSON; this change does not add browser token streaming or a new SSE protocol.
- Caches remain per-process and deployment remains single worker. No checkpointer, write tool, qa_direct, CV/JD loader or career-advice path was added.

## Evaluation

All calls were local embeddings or provider-shaped recordings. No live generation/judge call or model download was used. Normal tests use the existing deterministic hashing/NER fixtures; the optional E5 run uses cached multilingual-e5-small weights with network access disabled. The real local NER recorded-provider leak test also passes.

Forty new authored negatives (20 vi, 20 en, both roles; general topics and unsupported product features) are evaluated through retrieval, bypassing the router's off-topic shortcuts. The existing 15 guide questions supply positive controls. Precision is correctly defined as true out-of-corpus abstentions / all abstentions, including false abstentions on controls. Recall is reported separately. These fixtures also informed threshold calibration; they are not an independent held-out or real-user quality estimate.

| Backend | Out-of-corpus abstentions | False abstentions on 15 controls | Abstention precision | Abstention recall | Generation calls on abstentions |
|---|---:|---:|---:|---:|---:|
| Cached E5 | 40/40 | 0 | 1.000 | 1.000 | 0 |
| Hashing fallback | 39/40 | 1 | 0.975 | 0.975 | 0 |

The original retriever from b0cdbc8d52ed2d2d77227c6cc5781ebdd0a8314a was evaluated on the same current 134-chunk/8-document corpus to freeze the reference snapshots. E5 baseline capture reused the current vector index because chunk content/identities and embedding inputs are unchanged by metadata. All 15 queries preserve exactly the original result IDs and ordering after the new pre-generation gate.

| Metric | E5 before | E5 after | Hashing before | Hashing after |
|---|---:|---:|---:|---:|
| Keyword context recall | 1.000000 | 1.000000 | 0.888889 | 0.888889 |
| Historical context_precision (MRR) | 0.855556 | 0.855556 | 0.900000 | 0.900000 |
| Recall@1 | 0.197509 | 0.197509 | 0.247509 | 0.247509 |
| Recall@3 | 0.568083 | 0.568083 | 0.360842 | 0.360842 |
| Precision@1 | 0.933333 | 0.933333 | 0.933333 | 0.933333 |
| Precision@3 | 0.844444 | 0.844444 | 0.488889 | 0.488889 |
| NDCG@1 | 0.933333 | 0.933333 | 0.933333 | 0.933333 |
| NDCG@3 | 0.900000 | 0.900000 | 0.638736 | 0.638736 |

Rank metrics reuse src.services.benchmark utilities. A corpus chunk is relevant when its role and expected route match and its body contains at least one annotated gold keyword. Labels are deterministic regression proxies, not human semantic judgments; Precision@k includes missing slots in its denominator.

**T0 comparison:** the historical 2026-10-07 E5/fallback report recorded keyword context recall 0.967 and context_precision/MRR 0.867. Current E5 recall is higher (1.000), but MRR is 0.855556, approximately 0.011 lower than the historical rounded figure. The original retriever gives exactly the same current figures, so there is no regression caused by this implementation. Reproducing or exceeding the historical MRR on its original corpus/environment has not been established. Historical faithfulness/relevance/completeness were not rerun or relabeled as DeepSeek quality. The separate CV-to-JD benchmark is not a guide-RAG baseline.

Cache recording results: two identical requests across current pages use one provider request; role and docs_version changes produce three distinct entries/requests; expiry at the TTL boundary triggers a second request. Key tests also cover language isolation, Unicode/whitespace folding, copy isolation and expiry. Forbidden advisor targets on student guide metadata produce no attached action. Recorded-provider tests verify masked question/history, XML isolation, no CV/JD/page-state payload, strict retrieval citations and rejection of planted personal claims/links.

## Reproduce

Default offline suite:

~~~powershell
.\.venv\Scripts\python.exe -m pytest tests/test_assistant_howto.py eval/test_run_rag_eval.py -q
~~~

Explicit cached-E5 evaluation (prints HOWTO_EVALUATION JSON; fails if requested weights are unavailable):

~~~powershell
$env:HOWTO_E5_EVAL = "1"
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:OMP_NUM_THREADS = "2"
.\.venv\Scripts\python.exe -m pytest tests/test_assistant_howto.py -q -s
~~~

Snapshots and measured results: eval/howto/{retrieval_baseline,retrieval_e5_baseline,out_of_corpus,results}.json. The normal suite skips the optional E5 profile, avoiding downloads on machines without cached weights.

## Validation limitations

- Focused streaming/privacy/cache/action checks: 153 passed. Explicit E5 + hashing how-to evaluation: 29 passed. Final legacy RAG/evaluation-harness results are recorded below after completion.
- Repository-wide Ruff has existing errors outside this change: undefined get_roadmap_info in src/api/analysis.py (two locations) and unused date in src/db/seed.py. Changed-file lint passes.
- A broad pytest run was stopped after unrelated account/auth failures. The isolated registration test reproduces cookie/demo precedence returning Nguyễn Minh Anh instead of the newly registered Nguyễn Văn A (tests/test_api/test_accounts_api.py:71). No account/auth code was changed here; a green full-repository suite is not claimed.
