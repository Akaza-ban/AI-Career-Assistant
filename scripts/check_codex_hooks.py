"""Inspect Codex hook discovery without sending prompts or running hooks."""

import json
import queue
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any


def main() -> None:
    executable = shutil.which("codex.cmd") or shutil.which("codex")
    if not executable:
        raise SystemExit("Codex is missing from PATH.")
    process = subprocess.Popen(
        [executable, "app-server", "--stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
    )
    responses: queue.Queue[dict[str, Any]] = queue.Queue()

    def read_responses() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            try:
                responses.put(json.loads(line))
            except json.JSONDecodeError:
                continue

    threading.Thread(target=read_responses, daemon=True).start()

    def request(request_id: int, method: str, params: dict[str, Any]) -> dict[str, Any]:
        assert process.stdin is not None
        process.stdin.write(json.dumps({"id": request_id, "method": method, "params": params}) + "\n")
        process.stdin.flush()
        while True:
            try:
                response = responses.get(timeout=30)
            except queue.Empty:
                raise SystemExit(f"Codex did not respond to {method}; check sandbox or startup errors.") from None
            if response.get("id") == request_id:
                if "error" in response:
                    raise SystemExit(f"{method}: {response['error']}")
                return response["result"]

    try:
        request(
            1,
            "initialize",
            {"clientInfo": {"name": "hook-diagnostic", "version": "1.0"}, "capabilities": {"experimentalApi": True}},
        )
        assert process.stdin is not None
        process.stdin.write('{"method":"initialized"}\n')
        process.stdin.flush()
        cwd = str(Path.cwd())
        hooks = request(2, "hooks/list", {"cwds": [cwd]})
        print("HOOK DISCOVERY", json.dumps(hooks, ensure_ascii=True), flush=True)
        config = request(3, "config/read", {"cwd": cwd, "includeLayers": True})
        print("CONFIG LAYERS", flush=True)
        for layer in config.get("layers") or []:
            print(json.dumps({k: layer.get(k) for k in ("name", "source", "disabledReason")}), flush=True)
        print("HOOK FEATURE", config.get("config", {}).get("features", {}).get("hooks", "default"), flush=True)
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == "__main__":
    main()
