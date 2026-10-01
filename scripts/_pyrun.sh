#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries python3 → python → py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

# Use a candidate only if it actually runs: on Windows, `python3` often resolves
# to the Microsoft Store stub in WindowsApps, which exists but fails (exit 49).
works() { $1 -c "import sys" >/dev/null 2>&1; }

PY=""
# Prefer the project venv so dependencies (python-dotenv) are available.
for cand in .venv/Scripts/python.exe .venv/bin/python; do
  if [ -x "$cand" ] && works "$cand"; then PY="$cand"; break; fi
done
for cand in python3 python "py -3"; do
  [ -n "$PY" ] && break
  if command -v ${cand%% *} >/dev/null 2>&1 && works "$cand"; then PY="$cand"; break; fi
done

if [ -z "$PY" ]; then
  # PATH lookup failed — probe standard Windows install locations.
  PY=""
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ]; then PY="$cand"; break; fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"
