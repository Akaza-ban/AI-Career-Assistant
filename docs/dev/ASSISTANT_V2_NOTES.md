# CareerX Assistant v2 — implementation notes

## T1.1 — tool-to-service matrix (2026-10-13)

- Output-path ambiguity: architecture line 3 names docs/assistant_v2/TOOL_MATRIX.md; the task explicitly requests docs/dev/Assistant_v2/TOOL_MATRIX.md. Use the task path only; no duplicate matrix or architecture edit.
- Notes-path ambiguity: architecture lines 7, 16 and 363 name docs/ASSISTANT_V2_NOTES.md; the standing user rule requires docs/dev/ASSISTANT_V2_NOTES.md. Use the user path only.
- Catalog scope: architecture line 255 includes ask_user (M3), but T1.1 does not name it. Do not add a candidate row or feature. advisor_* is expanded by existing service capabilities, including notes and in-app messaging; labels are inventory descriptors, not new tool registrations. START_ANALYSIS is recorded as a legacy variant to remove from v2 ui_action in favor of analysis_start (architecture line 268).
- Safety choice: explicitly mark MISSING rather than substitute route handlers or lookalikes (restore versus duplicate, JD comparison versus analysis comparison). No tool is declared compliant merely because a backing helper exists; required checks must still be built in later authorized tasks.
- Existing BackgroundTasks behavior records committed analyses and restart failures; it does not provide durable job execution (src/services/gap_analysis.py:75; src/api/analysis.py:192; src/db/seed.py:81–92; architecture line 64). Single-worker pin/startup refusal are MISSING in existing deployment, not accepted exceptions (Dockerfile:34; docker-compose.yml:3–19; src/main.py:20–60).
- Privacy residual risk: architecture keeps employers, schools, job titles, skills, projects and city/country, which can still permit indirect re-identification. The stronger immediate current-code gap is unmasked outbound text plus automatic tracing; T1.1 does not claim or implement privacy protection (architecture lines 108, 113–116; src/services/assistant/agent.py:289–310; src/main.py:24–32).
- Read-like side effects must be visible in later tool design: optimizer.session may create/commit a draft (src/services/cv_optimizer.py:165–175); advisor.shared_cv/interview_report commit viewed timestamps (src/services/advisor.py:536–537, 583–584); interview.build_report can invoke abandoned-session deletion before rejecting incomplete reports (src/services/interview.py:145–164, 375–378).
- Baseline validation: backend compilation passed; full pytest collection passed (433 tests in 55.02s). PYTHON_DOTENV_DISABLED=1 was set only in the test process so src/config.py:10 cannot override test credential/database isolation with local .env values; no secrets or .env file were read or changed. At initial delivery, Ruff check src tests failed on three existing W293 errors in tests/test_jd_recommendation.py:20, :23, :26. No out-of-scope whitespace fixes made. At initial delivery this blocked the commit; no exception was assumed.
- No behavior, API, migration, refactor, provider integration, protected hook/log or test source changed. The user's untracked docs/dev/ASSISTANT_V2_ARCHITECTURE.md is left untouched and excluded from the proposed documentation commit.

### T1.1 validation after the user fixed W293

- Ruff check src tests now passes. Backend compilation passes. Full pytest collection passes: 433 tests in 53.55s before the documentation commit. The same dotenv isolation was used.
- Rechecked 587 source citation ranges with zero invalid paths or out-of-bounds references; catalog coverage and Markdown table checks pass.
- The approved commit contains only TOOL_MATRIX.md and this notes file. User changes to tests/test_jd_recommendation.py, .agents/hooks.json, scripts/_pyrun.cmd and scripts/log_antigravity.py are excluded; the architecture input remains untracked.
- The baseline-Ruff exception request is no longer needed. No task deviation, out-of-scope source change or waived requirement is needed.
