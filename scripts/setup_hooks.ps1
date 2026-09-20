# Install git pre-push hook for AI log submission (Windows PowerShell).
# Run once after cloning: powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1

$ErrorActionPreference = 'Stop'

$HookFile = '.git/hooks/pre-push'

$HookBody = @'
#!/bin/sh
# Pre-push: sweep recent Antigravity / Gemini prompts, then submit AI logs.
python scripts/log_antigravity.py --auto 2>/dev/null || py -3 scripts/log_antigravity.py --auto 2>/dev/null || python3 scripts/log_antigravity.py --auto 2>/dev/null || true
python scripts/submit_log.py || py -3 scripts/submit_log.py || python3 scripts/submit_log.py || true
exit 0
'@


# Ensure LF line endings and no UTF-8 BOM so Git for Windows can execute the hook
$HookBodyLf = $HookBody.Replace("`r`n", "`n") + "`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $HookFile), $HookBodyLf, [System.Text.UTF8Encoding]::new($false))
Write-Host "[ai-log] Git pre-push hook installed."

if (-not (Test-Path .ai-log)) { New-Item -ItemType Directory -Path .ai-log | Out-Null }
if (-not (Test-Path .ai-log/.gitkeep)) { New-Item -ItemType File -Path .ai-log/.gitkeep | Out-Null }

Write-Host "[ai-log] Setup complete. Configure AI_LOG_SERVER in your .env file."

