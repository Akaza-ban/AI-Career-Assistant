# Native Windows entry point for Codex hooks. Keep hook JSON on stdin intact.
# Run from any working directory inside the repo; no Bash/WSL is required.
$ErrorActionPreference = 'Stop'
$LoggerPath = Join-Path $PSScriptRoot 'log_hook.py'

# Probe interpreters: a Python launcher or an old venv can exist but be broken.
$Candidates = @(
    @{ Command = 'python.exe'; Prefix = @() },
    @{ Command = 'py.exe'; Prefix = @('-3') },
    @{ Command = 'python3.exe'; Prefix = @() }
)
foreach ($Candidate in $Candidates) {
    $PythonCommand = Get-Command $Candidate.Command -ErrorAction SilentlyContinue
    if (-not $PythonCommand) { continue }
    $PythonArgs = $Candidate.Prefix
    $ProbeSucceeded = $false
    try {
        & $PythonCommand.Source @PythonArgs -c 'import sys; sys.exit(0)' 2>$null
        $ProbeSucceeded = $LASTEXITCODE -eq 0
    } catch {
        # Some Python launchers report a native error when Python was moved.
    }
    if (-not $ProbeSucceeded) { continue }
    & $PythonCommand.Source @PythonArgs $LoggerPath '--tool=codex'
    exit $LASTEXITCODE
}
Write-Error 'AI logging requires a working Python interpreter on PATH.'
exit 1
