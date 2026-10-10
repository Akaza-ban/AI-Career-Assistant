# Codex AI logging on Windows

Codex reads `.codex/hooks.json` for the trusted repository. The existing
`UserPromptSubmit` hook writes the prompt; `Stop` records the end of the turn.
Antigravity's `.agents/hooks.json` belongs to its own agent and does not replace
Codex hook configuration.

## Windows command

The bare `bash` executable can resolve to Windows Subsystem for Linux. Use a
Windows override for each existing Codex command handler:

```json
"commandWindows": "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"& (Join-Path (git rev-parse --show-toplevel) 'scripts/log_codex_hook.ps1')\""
```

`scripts/log_codex_hook.ps1` locates the logger beside itself, probes available
Python interpreters, and forwards hook stdin unchanged. It works when Codex is
started from a repository subdirectory. `scripts/log_hook.py` uses the event's
`cwd` for repository metadata, writes to the git root's `.ai-log/session.jsonl`,
and preserves the full Codex prompt, including Vietnamese text and emoji.

Both existing handlers now include this Windows override and a 30-second
timeout. The repository's AGENTS.md protects `.codex/hooks.json`; these changes
were made with the user's explicit permission to repair automatic logging.

## Enable and review

1. Close and restart the Codex session after changing hook configuration. For
   the IDE extension, reload the IDE window.
2. In a Codex CLI terminal using the same Codex home as the IDE, run
   `codex.cmd -C D:\DATA\IT\AIA\P-131` on this machine and open `/hooks`.
3. Confirm both repository hooks are listed and review/trust their definitions.
   Codex requires another review when a hook definition changes.
4. Send a new prompt in Codex. Check that a new `tool: "codex"`,
   `event: "UserPromptSubmit"` entry appears in `.ai-log/session.jsonl`.

If the hooks are absent, run `python scripts/check_codex_hooks.py` from the repo
root. This starts a temporary Codex app-server and calls its read-only
`hooks/list` and `config/read` endpoints. It does not submit prompts or execute
logging hooks. The output includes parser warnings and each hook's trust status.

Codex 0.160.1 rejects unknown hook fields. The original top-level `version` and
handler `name` fields prevented the configuration from loading; these have been
removed. The repaired configuration was verified through Codex itself: two
enabled project hooks, no parser warnings/errors, and `trustStatus: untrusted`
until the user approves them in `/hooks`.

Also check that the project is trusted and hooks have not been disabled by
configuration or managed policy. Script checks alone do not verify whether the
IDE loaded and trusted the hooks.

Official hook discovery, Windows overrides, and trust documentation:
https://learn.chatgpt.com/docs/hooks
