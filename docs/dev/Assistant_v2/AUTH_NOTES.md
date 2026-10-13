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
