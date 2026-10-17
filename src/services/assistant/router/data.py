"""Load packaged, reviewed lexicons once. This module performs no inference."""

import json
from pathlib import Path
from typing import Any

LEXICONS: dict[str, Any] = json.loads(
    (Path(__file__).parent / "resources" / "lexicons.json").read_text(encoding="utf-8")
)
