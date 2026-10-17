# Identity and slim runs — sections 2.1 and 2.4

Implemented on 2026-10-15. Scope excludes waiting states, operations,
checkpointers, a new router, and a new streaming protocol.

## Identity and reuse

The existing `get_current_user` dependency still performs session verification,
disabled-account checks and temporary-password restrictions. For assistant paths
it cannot use the demo-header fallback, even when demo login is enabled, and does
not update the business user's activity timestamp. Other product demo behavior
is unchanged. Current opaque-token session verification is reused; historical
signed-cookie claims in `AUTH_NOTES.md` are not a description of current code.

Conversation, turn, action, feedback and resource lookups use owner predicates in
SQL. An unavailable selected-CV hint is cleared before reaching the agent. Run
lookup and cancellation return exactly the same HTTP 404 `NOT_FOUND` JSON for a
foreign ID and a missing ID. Two distinct students authenticate through actual
login sessions in the regression tests; only the upstream agent is stubbed.

`AssistantConversation`, `AssistantTurn`, `AgentActionLog`, and the existing
LangGraph `respond()` pipeline are reused. Turns gain `run_id` and `interrupted`;
they store the pending request before upstream IO and the answer on completion.
The new run service is necessary because no reservation/cancellation registry
existed. It does not replace the graph or create another history store.

## Persistence and lifecycle

`assistant_runs` contains the eight fields in section 2.4. The database enforces
unique `(user_id, conversation_id, client_request_id)`, the five allowed statuses,
and a partial unique index allowing one running run per conversation. A retry is
checked before the concurrent-run guard; it returns the existing run metadata
without generating or storing another answer. Retrying the first message without
a conversation ID also finds its existing run by authenticated user/request ID.
For requests naming a conversation, deduplication remains conversation scoped.

The browser generates a request ID and reuses it for Retry. For compatibility
with existing JSON callers and tests, omitted IDs receive a fresh server UUID;
those legacy callers cannot deduplicate retries until they supply IDs. A new
chat response retains its existing fields and adds `run_id`; duplicate requests
return run metadata. The client recovers a completed duplicate through history
and does not replay its UI actions. A running duplicate is reported explicitly.
`route` currently stores the validated page route; the v2 router is outside this
task.

Stop and disconnect cancel the task awaiting the upstream agent, mark the run
cancelled and preserve the turn's available text with `interrupted=true`.
Terminal cancellation is idempotent, and a new message can run after cancellation.
The existing structured JSON generation yields no partial text before the full
response, so cancellation before an answer preserves an empty assistant message.
No raw provider JSON or unguarded token stream is persisted as partial text.
Failures are recorded and exposed through a server-owned sanitized message.

Startup `init_db()` changes running runs to interrupted and marks their turns,
preserving existing text and terminal runs. Deployment must remain **single
worker** because cancellation and cache state live in process. No new worker
boot-refusal logic was added.

## Endpoints and downgrade

- `GET /api/v1/assistant/runs/{id}` returns owner-scoped run metadata.
- `POST /api/v1/assistant/runs/{id}/cancel` cancels an active run and returns its
  current metadata.
- `GET /api/v1/assistant/conversations/{id}/history` returns chronological user
  and assistant messages from existing turns, including run IDs, citations and
  interruption flags. Historical actions are not automatically replayed.
- `getConversationHistory` calls `/history` with credentials and no cache.

From the repository root, migration CLI commands are
`python -m src.db.migrations.assistant_runs` and
`python -m src.db.migrations.assistant_runs --downgrade`.
Downgrade drops only run metadata and the two added turn columns; it preserves
conversations, turn text, action logs and feedback. The turn/run link is a unique
indexed correlation ID rather than a SQLite table-level foreign key, allowing
DROP COLUMN on both fresh and upgraded databases. Stop the application and use
the matching old application version for a downgrade; current startup applies
the upgrade again.

## Validation

- Expanded offline assistant and real-session cross-user suite: **374 passed,
  1 failed** in 2446.69 seconds. All assistant cases passed. The failure is
  `test_recommendations_cannot_leak_private_vector_candidates`:
  `POST /api/v1/jd/recommend` returns another student's private JD from mocked
  vector metadata. This endpoint/service is outside the assistant routes and
  was not changed by this task. An isolated rerun with `get_current_user` loaded
  from `59bc105^:src/api/deps.py` via a test-only dependency override reproduced
  the same failure (**1 failed** in 46.26 seconds). No source was replaced and
  no authentication override is used in the new assistant acceptance tests.
- Focused auth/lifecycle/history and migration tests: **12 passed**. This includes
  duplicate IDs for first and follow-up messages, concurrent 409, two-student
  foreign/missing run equivalence, idempotent cancel, preservation of available
  partial text, a new message after cancel, disconnect, failure sanitization,
  selected-record hints, startup sweep and fresh/legacy migration round trips.
- Legacy selected-CV/JD behavior and selected-hint regression: **6 passed**.
- Initial combined auth/chat/status run: **65 passed** (62 existing chat/status
  cases and 3 new identity cases).
- Frontend API tests: **4 passed**. `npm run typecheck` passed. `npm run lint`
  passed with two existing `window.location.assign` warnings in `lib/api.ts`.
- Ruff on all changed Python files and diff whitespace checks passed.
- Full-suite attempt with dotenv disabled, keys cleared inside Python and model
  downloads offline: **20 passed, 1 failed**, stopping at T0's documented
  `test_register_signs_in_with_normalized_profile` failure. Its `/me` request
  sends the seeded student's explicit fixture cookie after registration.
- Repository-wide Ruff retains three baseline errors: undefined
  `get_roadmap_info` at `src/api/analysis.py:41,349` and unused `datetime.date`
  in `src/db/seed.py:2`. These are outside this task.

All implementation validation uses temporary test databases; no development
database migration or reindex is run. Existing baseline failures prevent
claiming a green full suite for every commit.

## Commits and deviations

| Commit | Scope |
|---|---|
| `59bc105` | Verified assistant identity and initial SQL ownership guards |
| `a1c1b8b` | Standalone run/turn migration with downgrade |
| `44cb78a` | Lifecycle, deduplication, concurrent guard and startup sweep |
| `672e969` | Run controls and history endpoints |
| `189da43` | Migration-only correction for fresh SQLite downgrades |
| `c57a9ed` | Frontend history, stable request IDs and duplicate recovery |
| `075159e` | Secondary owner queries and selected-record hints |
| `84dbb56` | Preserve legacy unavailable-selection wording |

The original migration needed a separate correction after a fresh-database
regression exposed SQLite's table-level foreign-key DROP COLUMN restriction.
Final ownership review and legacy wording compatibility received focused
follow-up commits. Documentation is committed separately. Pre-existing user
changes and protected hooks/logs are excluded from these commits.
