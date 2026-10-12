# Codex Agent Instructions

> This file is loaded by OpenAI Codex / Codex runners. For the full project guidelines, see the repository root `AGENTS.md`.

## Essential Directives for Codex
1. **Always reference `AGENTS.md`** at the repository root for tech stack standards, environment conventions, and testing commands.
2. **Review Feature Specifications:**
   - Architecture & Action Protocols: `docs/specs/assistant/00_PRD_AND_ACTION_CONTRACT.md`
   - Day 1 Backend Tasks: `docs/specs/assistant/01_DAY1_BACKEND_RAG_SPEC.md`
   - Day 2 Frontend Tasks: `docs/specs/assistant/02_DAY2_FRONTEND_CHAT_SPEC.md`
   - Day 3 UI Agent Tasks: `docs/specs/assistant/03_DAY3_UI_AGENT_ACTIONS_SPEC.md`
   - Execution Prompts: `docs/specs/assistant/CODEX_PROMPTS.md`
3. **Preserve existing hooks and logs:**
   - Do not alter `.codex/hooks.json` or files under `.ai-log/`.
4. **Validation:**
   - After editing Python code, ensure `ruff check <modified_files>` passes.
   - After editing frontend code, ensure `npm run typecheck` passes in `frontend/`.
