# T1.2 authentication implementation plan

Prepared before implementation, 2026-10-13. Estimated engineering effort: **3–5 hours** (credential/session work 60–90 min, schema/seed 30–45 min, frontend 30–45 min, endpoint audit and regression validation 60–120 min). Actual elapsed time and results will be appended after validation; this is an estimate, not a claim of completed work.

## Findings and references

- `docs/dev/ASSISTANT_V2_ARCHITECTURE.md` section 2.1 requires verified identity and owner-scoped resources. Its current section 10 is CV proposal flow, not security; also read the root `ARCHITECTURE.md` Security section. TOOL_MATRIX section 6.4 documents the client-controlled fixed-user header mapping.
- `src/api/deps.py` currently maps a client role directly to a seeded user. User records have no password hashes. Frontend API clients send the role header; tests use it too.
- Existing CV, analysis, interview and advisor service checks will be preserved and audited. Student-owned pasted JDs are private; library JDs remain accessible to authenticated students. Advisor assignment and document-sharing restrictions remain required.

## Chosen session mechanism

Use an **HMAC-SHA256 signed httpOnly cookie**, containing only a cryptographically random opaque token. Store only its SHA256 digest, user ID and absolute expiry in SQLite. Each request verifies the signature and live session, then loads the user and current role from the database. No role/user/tenant from headers, URL location, request context or model output establishes identity. Logout deletes the session and clears the cookie; replay of the old cookie fails. Login rotates any previous session. Expired sessions fail closed.

Cookie: host-only, Path=/, HttpOnly, SameSite=Lax; Secure in production. Config comes through `get_settings()`: signing key and session TTL. Production requires an explicit strong signing key; development can use an ephemeral random key (restart logs everyone out). Browser mutations reject untrusted Origin / cross-site requests, covering multipart upload as well as JSON. Frontend uses existing `credentials: include`, never browser token storage. These cookie choices follow [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Passwords use salted, versioned scrypt hashes via [Python hashlib](https://docs.python.org/3/library/hashlib.html#hashlib.scrypt), with constant-time verification. Missing accounts/hashes and invalid passwords return the same 401. Hashes never appear in profile responses. No signup, OAuth, reset, MFA, or shared-role accounts.

## Implementation and commits

1. `docs(auth): record authentication plan and estimate` — this file only, before code.
2. `migrate(auth): add credential and session storage` — nullable password hash for existing users and a new session table; idempotent SQLite upgrade and documented downgrade. No existing data deletion.
3. `feat(auth): verify credentials and authenticate revocable sessions` — login/logout, verified dependency, origin protection, regression tests in the same commit. Write and run tests against the old implementation first: 401 without session, header spoofing, and cross-user resource denial. Migrate existing test callers to real login-issued cookies, without dependency bypasses.
4. `chore(auth): seed individual student and advisor credentials` — two individual students and one advisor; assignments; development-only password defaults or env overrides. Existing populated hashes are preserved. Production does not receive known development passwords.
5. `feat(frontend): add login and use verified sessions` — minimal credential form, database-role redirect, logout, auth guard, remove all role-header sending. Regression coverage stays with backend changes; add any audit corrections and tests together.

## Validation and endpoint audit

Exercise real HTTP login and real services using isolated SQLite/files. Test unauthenticated and spoofed-header requests, invalid/tampered/expired/revoked sessions, database role reload, and both students' positive access plus negative access across CV text/file/version/export/optimizer, private JD use/listing, analysis reads, interview session/report and mutations. Advisor tests cover assigned and unassigned students, shared documents, and revoked assignments. Inventory all API handlers for unverified client identity. Run Ruff, the full pytest suite, frontend typecheck and lint; record pre-existing failures separately if any.

## Deployment / limitations to verify

Local frontend/backend must use the same hostname (for example localhost on different ports); production must use HTTPS and configured trusted frontend origins. Existing users without hashes cannot log in until provisioned. Nullable hash is a compatibility migration, never permission to bypass authentication. No new privacy/provider/assistant-v2 tool behavior is part of T1.2.

## Implementation results

Implemented the planned signed cookie and SQLite session mechanism. Passwords use scrypt N=32768, r=8, p=3 with independent random salts; session cookies contain a random token and HMAC signature, and SQLite stores only the token digest. Production refuses a missing/short signing key and sets Secure cookies. Origin protection covers JSON and multipart mutations. Session expiry, logout revocation, login rotation, deleted users and database role changes are tested.

Commits: `8fde7a9` plan; `0f3826a` explicit credential/session migration; `52abd39` backend authentication and HTTP regression suite; `67eff02` individual development seeds; `6698873` frontend login/logout and header removal. Tests were committed with the behavior they cover instead of a separate final test-only commit. A final documentation commit records these results. The user's two untracked architecture/prompt documents were preserved and excluded from commits.

### Development accounts

Run from root: `python -m src.db.seed`, or start the backend (startup calls the same seed). Existing hashes and advisor assignments are preserved. Password env overrides only provision missing hashes; they do not reset existing passwords. Production does not seed these accounts or the illustrative cohort.

| Individual | Email | Public development-only password | Role |
|---|---|---|---|
| Nguyen Minh Anh | minhanh.k21@student.university.edu.vn | Student-A-dev-only! | student |
| Le Thu Ha | thuha.k22@student.university.edu.vn | Student-B-dev-only! | student |
| Tran Hoang Nam | nam.th@university.edu.vn | Advisor-dev-only! | advisor |

Both seeded students are assigned to the seeded advisor. Regression fixtures also create an unassigned student and verify the advisor cannot reach that student, including after assignment revocation. Login, logout and `/me` always call the real backend; existing optional frontend resource mock groups remain independently configurable.

### Endpoint audit

**No existing API endpoint remains dependent on client-supplied caller identity.** `get_current_user` has no header/role mapping, flag or fallback. Roles come from the session user's database row. Target student IDs in advisor/conversation paths still require assignment checks; assistant client context is checked against the verified caller and cannot select a different user or role. Public health/status/documentation routes do not establish caller identity. Logout is idempotent, including when no session exists. General `/chat` now also requires authentication; its client conversation ID is a correlation value, not an identity or persisted resource lookup.

The audit corrected two indirect paths: `/jd/recommend` now accepts only database-confirmed library candidates instead of trusting vector metadata; `/interviews/quota` checks JD visibility. Existing public 403/404 authorization responses were preserved.

### Validation and limitations

- Before implementation: the header/login regressions produced **5 failures and 2 passes**; headers selecting student/advisor returned 200 without a session. Cross-user tests failed at real login because the endpoint was absent. Unauthenticated/header tests run without authentication dependency overrides.
- Final backend suite: **500 passed**. The 77 authentication/isolation cases use real login cookies and real business services, cover both student directions, list/detail/file/version/export/optimizer/JD-use/interview routes, advisor assignments/revocation/resource substitution, and assistant context spoofing. Migration and seed tests cover compatibility, idempotence, password preservation and production exclusion.
- `ruff check --no-cache src tests` and diff whitespace checks passed. Frontend `npm run typecheck`, `npm run lint` and `npm run build` passed. Lint has one pre-existing unused-variable warning at `frontend/components/advisor/overview/advisor-overview.tsx:499`.
- An interactive browser check was attempted with the computer-use capability, but its browser inventory was empty. No interactive UI result is claimed. Production build and HTTP authentication behavior were verified.
- Estimate: **3–5 engineering hours**. Observed execution was approximately **90 minutes of agent wall time**, including the initial repository reads, approval waits, the ten-minute baseline and final post-commit validation (first recorded timestamp 11:42:38 UTC on 2026-10-13). This is elapsed execution time, not a human effort measurement.

### Initial baseline isolation incident

The existing `load_dotenv(override=True)` replaced tests' environment overrides with local `.env` settings. The initial baseline ran against **`data/app.db`** and called real LLMs (411 passes, 8 failures), rather than using the intended isolated database/offline providers. Pre-authentication failing-test runs also preceded the configuration correction. Development records may have been modified or removed by those fixtures. No pre-run database backup was found, so the original state could not be reconstructed safely.

The implementation changes dotenv precedence to respect explicit environment settings. Test setup now asserts the database URL and upload directory match its temporary paths **before any fixture writes**, so an equivalent precedence regression stops the suite. All post-correction runs use temporary databases. A consistent SQLite snapshot of the remaining development database is saved locally at `data/backups/app-after-baseline-20261013.db`; it is explicitly a **post-baseline snapshot**, not a recovery of the original data, and is not committed. No further live database provisioning or restoration was attempted.
