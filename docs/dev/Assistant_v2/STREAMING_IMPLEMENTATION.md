# Router, SSE and chat integration — architecture 3, 9 and 10

Implemented 2026-10-16. Navigate and result remain capability-menu stubs until M4.

## Reuse and contracts

- Retained the existing LangGraph and public `respond()` entry point. The local
  router selects all seven handlers. Smalltalk, deny, clarify, and the M4 stubs
  never retrieve documents or call a provider. Locate and how-to reuse T3's
  matcher, registry, retriever, guide generation, cache, and attachment policy.
- `Accept: text/event-stream` selects POST SSE; omitted/JSON Accept retains the
  JSON API. Duplicate request IDs return existing run metadata as JSON, including
  when the retry requested SSE. They do not replay events or execute UI actions.
- Section 9 enumerates **nine application events plus heartbeat**: `route`,
  `status`, `token`, `citations`, `card`, `ui_action`, `notice`, `final`, `error`,
  and `heartbeat`. IDs increase within each run. Heartbeats are due every 15 s;
  headers are `Cache-Control: no-cache` and `X-Accel-Buffering: no`.
- `card` carries either a link card or server-built clarification chips. Chip
  clicks include the structured chip; the API accepts only a choice from the
  previous stored turn. URLs and UI actions remain registry/ownership checked.
- The existing turn `context_json` now has a server-owned `assistant_output`
  member with cards, chips and UI actions. History returns these alongside the
  existing text, citations, run ID and interruption flag. No schema migration
  or additional history store is needed.

## Guards and cancellation

- New `assistant/streaming.py` contains assistant-specific SSE framing and output
  policy; no existing server SSE encoder was available. It wraps the existing
  `privacy.masker.PlaceholderFilter`, adding deferred replacement at `]]` and
  retaining incomplete HTML/model protocol markers across chunks. It never
  unmasks or resolves placeholders. Completed JSON answers use the same guard.
- `LlmClient.chat_stream(stream_text=True)` is an opt-in extension of the existing
  gateway, restricted to text without tools. It retains incomplete sentences so
  the existing masker and egress scan see cross-chunk identifiers, then releases
  the safe sentence as incremental text tokens. **This privacy buffer can delay
  the first visible token until a sentence boundary**; it does not wait for the
  entire completion. Other provider consumers keep their prior behavior.
- Streamed text is guarded and persisted before each token is queued. Stop and
  disconnect cancel and join the producer/upstream, retain only guarded partial
  text, mark the turn `interrupted=true`, and set the run `cancelled`. This also
  covers cancellation before the producer starts and generator teardown.
- Upstream failures emit a sanitized `error` and preserve available partial text.
  Post-generation guide-policy failures emit an advisory `notice`; already
  streamed text is retained and is not cached as a verified guide answer.
- Existing run uniqueness, the 409 concurrent-run guard, owner checks, and startup
  sweep remain in use. Deployment remains **single worker** because cancellation
  and caches are in process. No replay, checkpointer or boot refusal was added.

## Frontend integration

- Extended the existing fetch helper and widget/provider. SSE parsing handles
  split UTF-8, CRLF, comments, unknown event names and missing terminal events.
  JSON responses and 406/415 fallback retain the original request ID. Broken
  streams never automatically resend the message.
- Token rendering batches once per animation frame. Partial answers render as
  escaped text with inactive links, then use the existing Markdown renderer at
  completion. Stop calls the cancel endpoint and aborts the reader. Failed or
  stopped streams recover available text through history.
- Added registry-checked link cards and structured chips. Saved history loads
  when restoring a conversation and never dispatches saved UI actions. Existing
  navigate/highlight sequencing and the highlighter are reused.
- Removed the confirmation runner/dialog from the assistant widget. The legacy
  action-confirm endpoint, dispatcher and standalone confirmation tests remain.

## Verification

- `tests/test_assistant_stream.py`: actual HTTP/graph route, token, citations,
  card/chips, UI action, notice and final events; heartbeat/error producer paths;
  monotonically increasing IDs and event-name whitelist rejection.
- Guards exercise every two-chunk boundary plus character-at-a-time input for
  closed, adjacent and unfinished placeholders, HTML and model delimiters. A
  separate test checks no replacement is exposed before a placeholder closes.
- Cancellation checks cover pre-token and mid-stream Stop/disconnect, producer
  teardown, disconnect before producer startup, actual ASGI disconnect, partial
  persistence, duplicate running/completed requests and concurrent-run 409.
- Recorded provider tests verify content is available before completion, closing
  the consumer closes the upstream, and character-split email/phone output is
  masked. No live provider calls or production database were used.
- Frontend tests exercise framing, fallback, deduplication, partial Markdown,
  cards/chips, Stop, and 500 tokens batching into one scheduled frame.

Final command results and legacy-test migration findings are recorded in the
delivery report and `docs/dev/ASSISTANT_V2_NOTES.md`.

### Recorded results

- Assistant, router, runs/migrations, gateway, RAG, privacy and LlmClient suite:
  **845 passed, 1 skipped** (846 collected). The process reused calculated fixture
  password hashes and pure password-verification results through `lru_cache`;
  real login sessions and owner-scoped queries remained enabled. Production auth
  code was not changed. The skipped case requires opt-in cached E5 evaluation.
- Frontend: **43 passed**; typecheck passed; lint completed with no errors and
  two existing `window.location.assign` warnings in `frontend/lib/api.ts`.
- Scoped Ruff and formatting checks passed. Repository-wide Ruff reports three
  existing errors: `get_roadmap_info` is undefined twice in `src/api/analysis.py`,
  and `datetime.date` is unused in `src/db/seed.py`.
- The full repository pytest run stopped at
  `tests/test_api/test_accounts_api.py::test_register_signs_in_with_normalized_profile`
  after 20 passes: `/me` returns the existing profile name rather than the newly
  registered name. An uncached isolated rerun reproduces the same failure. No
  complete full-repository pass is claimed.

After the 846-case run, the focused comparison-marker regression passed:
**9 passed, 15 deselected**. `< 70%` remains prose, while incomplete HTML/model
markers remain guarded. The boundary suite covers 138 split positions across
seven strings, plus the same strings character by character. Separate cases
verify deferred placeholder replacement and unchanged score comparisons.

Reproduce the scoped run from PowerShell at the repository root:

```powershell
@'
import glob
from functools import lru_cache
import pytest
import tests.conftest as conftest
from src.services import auth

auth.hash_password = lru_cache(maxsize=64)(auth.hash_password)
auth.verify_password = lru_cache(maxsize=256)(auth.verify_password)
conftest.hash_password = auth.hash_password
raise SystemExit(pytest.main(glob.glob('tests/test_assistant*.py') + [
    'tests/test_llm_client.py', 'tests/test_privacy_masker.py',
    '-q', '--disable-warnings', '--tb=short',
]))
'@ | .venv/Scripts/python.exe -
```

The standard pytest invocation without these process-only fixture caches is also
supported; repeated password hashing makes it substantially slower here.
