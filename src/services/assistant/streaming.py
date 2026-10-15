"""SSE framing and incremental output guards; no provider or orchestration duplication."""

import json
import re
from typing import Any

from src.services.privacy.masker import PlaceholderFilter

EVENTS = frozenset(
    {"route", "status", "token", "citations", "card", "ui_action", "notice", "final", "error", "heartbeat"}
)
HEARTBEAT_SECONDS = 15.0


class OutputGuard:
    """Reuse the privacy filter and retain incomplete protocol markers across chunks."""

    def __init__(self, neutral: str = "bạn") -> None:
        self.placeholders = PlaceholderFilter(neutral, defer_replacement=True)
        self.pending = ""

    def feed(self, text: str) -> str:
        self.pending += self.placeholders.feed(text)
        # HTML and model-control delimiters are never human answer content.
        self.pending = re.sub(r"<[^>]*>|\[/?INST\]", "", self.pending, flags=re.IGNORECASE)
        hold = len(self.pending)
        for opener in ("<", "[INST", "[/INST"):
            for length in range(1, len(opener) + 1):
                if self.pending.lower().endswith(opener[:length].lower()):
                    hold = min(hold, len(self.pending) - length)
        # Retain everything after an unmatched HTML/protocol opener.
        index = self.pending.rfind("<")
        if index >= 0:
            hold = min(hold, index)
        ready, self.pending = self.pending[:hold], self.pending[hold:]
        return ready

    def finish(self) -> str:
        tail = self.feed(self.placeholders.finish())
        # An incomplete marker or placeholder is dropped on completion/cancel.
        self.pending = ""
        return tail


class EventEncoder:
    def __init__(self, run_id: str, conversation_id: str) -> None:
        self.run_id = run_id
        self.conversation_id = conversation_id
        self.sequence = 0

    def encode(self, name: str, data: dict[str, Any]) -> str:
        if name not in EVENTS:
            raise ValueError("Unsupported assistant event")
        self.sequence += 1
        payload = {**data, "run_id": self.run_id, "conversation_id": self.conversation_id}
        return f"id: {self.sequence}\nevent: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
