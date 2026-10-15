"""Stage two rules and the no-classifier fallback. No services or I/O calls."""

from collections.abc import Sequence

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.matching import PATTERNS, SurfaceText, matches
from src.services.assistant.router.models import CardTarget, ClarifyChip, Language, NavSlots, Role, RouterDecision
from src.services.assistant.router.slots import extract_locate_slots, extract_slots, navigation_mode


def clarify(message: str, role: Role, language: Language) -> RouterDecision:
    lang = "en" if language == "en" else "vi"
    slots = extract_slots(message)
    templates = LEXICONS["templates"]
    if slots.target:
        name = slots.page_hint or slots.target.upper()
        chips = (
            ClarifyChip(label=f"{templates['open'][lang]} {name}", route="navigate", slots=slots),
            ClarifyChip(label=f"{templates['guide'][lang]} {name}", route="howto", slots=slots),
        )
    else:
        chips = tuple(
            ClarifyChip(
                label=item[lang],
                route="navigate",
                slots=NavSlots(target=item["target"], page_hint=item[lang] if item["target"] == "page" else None),
            )
            for item in LEXICONS["chip_defaults"][role]
        )
    return RouterDecision(
        route="clarify",
        source="fallback",
        confidence=0.0,
        language=language,
        clarify_question=templates["clarify"][lang],
        chips=chips,
    )


def is_contextual(message: str) -> bool:
    text = SurfaceText(message).folded
    return bool(PATTERNS["bare_open"].fullmatch(text) or PATTERNS["deictic"].search(text))


def decide_rules(
    message: str,
    *,
    role: Role,
    language: Language,
    previous_targets: Sequence[CardTarget] = (),
) -> RouterDecision:
    text = SurfaceText(message).folded
    if PATTERNS["bare_open"].fullmatch(text):
        if len(previous_targets) == 1:
            target = previous_targets[0]
            return RouterDecision(
                route="navigate",
                source="rules",
                confidence=0.95,
                language=language,
                slots=NavSlots(target="page", page_hint=target.label),
                nav_mode="fast",
                card_target=target,
            )
        return clarify(message, role, language)
    if PATTERNS["deictic"].search(text):
        return clarify(message, role, language)

    families = {name: matches(text, phrases) for name, phrases in LEXICONS["families"].items()}
    if families["locate"] or PATTERNS["locate_button"].search(text):
        return RouterDecision(
            route="locate",
            source="rules",
            confidence=0.95,
            language=language,
            slots=extract_locate_slots(message),
        )
    slots = extract_slots(message)
    # An open verb inside a how-to clause is instructional. A later imperative
    # remains navigation, matching the legacy classify_intent clause boundary.
    opens = families["navigate"]
    howtos = families["howto"]
    imperative = [
        match
        for match in opens
        if not any(how.start() < match.start() for how in howtos)
        or PATTERNS["imperative_boundary"].search(text[: match.start()])
    ]
    if imperative and slots.target:
        return RouterDecision(
            route="navigate",
            source="rules",
            confidence=0.95,
            language=language,
            slots=slots,
            nav_mode=navigation_mode(message, slots, result=False, compound=bool(howtos)),
        )
    result = bool(families["result"] or PATTERNS["result_went"].search(text))
    if result and slots.target in {"analysis", "interview", "report"}:
        return RouterDecision(
            route="result",
            source="rules",
            confidence=0.95,
            language=language,
            slots=slots,
            nav_mode=navigation_mode(message, slots, result=True),
        )
    if howtos:
        return RouterDecision(route="howto", source="rules", confidence=0.95, language=language)
    if opens or slots.target or PATTERNS["ui_words"].search(text):
        return clarify(message, role, language)
    return RouterDecision(route="howto", source="fallback", confidence=0.0, language=language)
