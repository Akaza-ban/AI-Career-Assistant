"""Local fuzzy guide-target matching. Ambiguity abstains to how-to retrieval."""

import re
from difflib import SequenceMatcher

from src.config import get_settings
from src.models.assistant import UIAction, UIHighlight, UINavigate
from src.services.assistant.guardrails import validate_ui_actions
from src.services.assistant.text import fold_diacritics
from src.services.assistant.ui_registry import UIEntry, load_ui_registry, resolve_route

_NOISE = frozenset(
    "where is are the a an button please show me find located can you "
    "nut o dau chi cho toi minh ban giup voi nhe nao nam thanh phan".split()
)


def _words(text: str) -> list[str]:
    return [word for word in re.findall(r"\w+", fold_diacritics(text)) if word not in _NOISE]


def _score(query: list[str], label: str) -> float:
    words = _words(label)
    if not words or not query:
        return 0.0
    target = " ".join(words)
    score = SequenceMatcher(None, " ".join(query), target).ratio()
    # Ignore polite surrounding words, while preserving competing targets:
    # an embedded label scores less than an exact whole-query label.
    if len(words) >= 2:
        width = len(words)
        for size in range(max(2, width - 1), width + 2):
            for start in range(len(query) - size + 1):
                score = max(score, 0.96 * SequenceMatcher(None, " ".join(query[start : start + size]), target).ratio())
    return score


def match_element(message: str, role: str) -> UIEntry | None:
    settings = get_settings()
    words = _words(message)
    ranked = sorted(
        (
            (max(_score(words, label) for label in [*entry.labels_vi, *entry.labels_en, *entry.aliases]), entry)
            for entry in load_ui_registry().values()
            if role in entry.roles
        ),
        key=lambda item: (-item[0], item[1].element_id),
    )
    if not ranked:
        return None
    best, element = ranked[0]
    runner_up = ranked[1][0] if len(ranked) > 1 else 0.0
    if best < settings.assistant_locate_threshold or best - runner_up < settings.assistant_locate_margin:
        return None
    return element


def locate_actions(message: str, role: str, current_route: str) -> list[UIAction]:
    element = match_element(message, role)
    if element is None:
        return []
    actions: list[UIAction] = []
    destination = resolve_route(element.route_id, {}, role)
    if current_route != destination:
        actions.append(UINavigate(route_id=element.route_id))
    actions.append(UIHighlight(element_id=element.element_id))
    return validate_ui_actions(actions, role)
