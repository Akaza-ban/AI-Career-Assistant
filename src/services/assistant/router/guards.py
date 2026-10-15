"""Stage zero wraps the current assistant's deterministic guard functions."""

import re

from src.services.assistant.guardrails import (
    is_chitchat,
    is_out_of_scope,
    is_role_forbidden,
    sanitize_and_inspect_prompt,
)
from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.models import Role, RouterDecision
from src.services.assistant.router.text import detect_language, normalize


def stage0(message: str, role: Role, *, max_chars: int) -> RouterDecision | None:
    language = detect_language(message[:max_chars])

    def deny(reason: str) -> RouterDecision:
        return RouterDecision(route="deny", source="stage0", confidence=1.0, language=language, deny_reason=reason)

    if len(message) > max_chars:
        return deny("unsafe")
    if not message.strip():
        return deny("off_topic")
    allowed, _ = sanitize_and_inspect_prompt(message)
    if not allowed:
        return deny("injection")
    text = normalize(message).folded
    if any(re.search(pattern, text) for pattern in LEXICONS["guards"]["unsafe"]):
        return deny("unsafe")
    if is_role_forbidden(text, role):
        return deny("out_of_role")
    if any(re.search(pattern, text) for pattern in LEXICONS["guards"]["role_forbidden"].get(role, [])):
        return deny("out_of_role")
    out_of_scope, _ = is_out_of_scope(message)
    if out_of_scope:
        return deny("off_topic")
    social, _ = is_chitchat(message)
    if social:
        return RouterDecision(route="smalltalk", source="stage0", confidence=1.0, language=language)
    return None
