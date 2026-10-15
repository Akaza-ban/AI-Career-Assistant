# UI registry and locate — architecture 6.3

Implemented 2026-10-15. The v2 response adds `ui_actions`; the existing `actions` contract remains for legacy callers. `ui_actions` is a strict discriminated union: `highlight {element_id}` or `navigate {route_id, params}`. Targets and paths come from the backend JSON registries, which the frontend imports directly. Neither payload accepts a selector or URL.

## Registered guide controls

| element_id | Page | Vietnamese label | Role |
|---|---|---|---|
| `btn-upload-cv` | `/student/cv` | Tải lên CV | student |
| `cv-list` | `/student/cv` | Danh sách CV | student |
| `cv-search-input` | `/student/cv` | Tìm CV | student |
| `analysis-select-cv` | `/student/analysis/new` | Đổi CV phân tích | student |
| `btn-start-analysis` | `/student/analysis/new` | Bắt đầu phân tích | student |
| `interview-select-cv` | `/student/interview/new` | Đổi CV phỏng vấn | student |
| `interview-select-jd` | `/student/interview/new` | Chọn vị trí phỏng vấn | student |
| `btn-start-interview` | `/student/interview/new` | Vào phòng chờ | student |
| `history-type-filter` | `/student/history` | Loại lịch sử | student |
| `history-session-list` | `/student/history` | Danh sách lịch sử | student |
| `btn-add-jd` | `/student/library` | Thêm JD | student |
| `jd-search-input` | `/student/library` | Tìm vị trí | student |
| `advisor-student-search` | `/advisor/students` | Tìm sinh viên | advisor |
| `advisor-students-link` | `/advisor` | Sinh viên phụ trách | advisor |

## Matching and behavior

The matcher reuses `fold_diacritics`, compares folded labels/aliases using SequenceMatcher (whole query and bounded word windows), requires score >= 0.78 and top-1 minus top-2 >= 0.10, and filters candidates by the authenticated role before scoring. Thresholds use `get_settings()`: `assistant_locate_threshold` and `assistant_locate_margin`. Ambiguous/unknown targets continue through the existing guide RAG with action output suppressed. A confident match returns a server template without a provider call. Another-page matches emit navigate then highlight; same-page matches emit only highlight.

`eval/locate/rows.json`: **44/44 correct (100%)**, including **34 target matches and 10 abstentions**. These are authored regression fixtures (Vietnamese, English, accent-free input, typos, competing targets, unsupported controls and role exclusion), not a held-out or real-user quality estimate. Run `python -m pytest tests/test_assistant_ui.py -q` from the repository root.

## Reuse and validation boundaries

- Reused `dispatchAgentAction`, its navigation/visible-element waits and preparation event, and the existing `ElementHighlighter` overlay with scrolling, resize tracking and dismissal. `dispatchUIActions` is a sequential wrapper over that dispatcher; failed navigation stops the sequence.
- The provider prefers v2 actions when supplied and uses its existing abort controller. V2 bypasses legacy confirmation/reporting. Manual links remain in `ActionBadges`, even after automatic navigation. No new tour, overlay or acknowledgement endpoint was added. `InterviewTour` remains its existing specialized onboarding.
- `route_allowed` and frontend compatibility navigation now derive from `resources/routes.json`, retaining implemented guide aliases. Nonexistent advisor reviews/analytics/settings are excluded. Record navigation still passes the existing `_resource_actions` ownership guard; saved comparison URLs now also check owner in SQL after route drift coverage exposed the existing comparison exception. This adds no comparison resolver or result capability.
- `validate_ui_actions` rechecks registry and authenticated role in the API after graph output. Invalid payloads fail the run and emit no actions. The existing run wrapper sanitizes these failures to HTTP 503; it does not expose internal target IDs or validator messages.
- Drift tests compare registry IDs and literal frontend attributes in both directions, reject duplicate source declarations, and compare registered canonical routes to actual student/advisor Next.js pages.
- New registry loader and locate module are necessary because T0 found neither implementation. Existing API identity, run lifecycle and legacy acknowledgement behavior are retained. The compatibility bridge reuses `decide_rules` to prevent a classifier-only locate prediction from intercepting a legacy imperative without locate evidence.

## Limitations

Targets may be absent while data loads or when a page has an empty/error state. The existing bounded visibility wait handles this safely and reports a local toast on timeout; manual navigation links remain usable. Result-page controls requiring an owned record (for example Match Score) are deferred to the record resolver task. The 14 targets here all belong to static destinations.

The frontend build needs the repository as Turbopack root to import the single backend registry. The production build passed with normal network access and a temporary isolated output directory, after the existing default `.next` directory refused an unlink. Temporary build configuration and tsconfig additions were restored.

## Validation

- Combined backend assistant regression suite: **143 passed** (`tests/test_assistant_rag.py`, `tests/test_assistant_runs.py`, `tests/test_assistant_ui.py`), including 21 UI registry/locate/drift/guard cases.
- Matcher fixtures: 44/44 correct.
- Frontend tests: 34 passed, including v2 ordering, role/ID/parameter rejection, cancellation and manual links.
- Next type generation and TypeScript: passed.
- Frontend ESLint: passed with two existing warnings in `lib/api.ts`.
- Production build: passed (isolated generated output, real font fetch; no font mock).
- Ruff on changed Python files: passed. Repository-wide Ruff remains blocked by two undefined `get_roadmap_info` uses in `src/api/analysis.py` and one unused `date` import in `src/db/seed.py`.
- Repository-wide pytest fail-fast: 20 passed, then existing `tests/test_api/test_accounts_api.py::test_register_signs_in_with_normalized_profile` failed because `/me` returned the demo profile name. Authentication implementation and that test are unchanged by this task.

## Commits and plan details

1. `b075051` — registries, reduced v2 union and validation.
2. `1d4769d` — locate matching, graph/API integration and matcher fixtures.
3. `b11f68e` — frontend tags, dispatcher/highlighter integration and frontend tests.
4. `ff5a476` — drift checks and compatibility/ownership regression fixes.

Documentation ships in a separate commit to follow architecture commit discipline. Relevant tests ship with their features; the final test commit also includes the fixes discovered by the combined regression run. The temporary isolated build output was used only for verification. Unrelated working-tree edits are excluded.
