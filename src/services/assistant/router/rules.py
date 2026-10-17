"""Stage two rules and the no-classifier fallback. No services or I/O calls."""

from collections.abc import Sequence

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.matching import PATTERNS, SurfaceText, matches
from src.services.assistant.router.models import CardTarget, ClarifyChip, Language, NavSlots, Role, RouterDecision
from src.services.assistant.router.slots import extract_locate_slots, extract_slots, navigation_mode


def plausible_targets(message: str, role: Role) -> tuple[NavSlots, ...]:
    """Distinct destination candidates, not alternative actions on one target."""
    text = SurfaceText(message).folded
    entities = {target for target, phrases in LEXICONS["entities"].items() if matches(text, phrases)}
    if "analysis" in entities:
        entities -= {"cv", "jd"}
    if "report" in entities and "interview" in entities:
        entities.discard("interview")
    if matches(text, LEXICONS["profile_terms"]):
        return (NavSlots(target="cv"), NavSlots(target="page", page_hint="profile"))
    if entities == {"report"} and not PATTERNS["ui_words"].search(text):
        return (NavSlots(target="analysis"), NavSlots(target="interview"))
    if entities:
        return tuple(NavSlots(target=target) for target in sorted(entities))
    slots = extract_slots(message)
    if slots.target:
        return (slots,)
    partial = (
        any(matches(text, phrases) for name, phrases in LEXICONS["families"].items() if name in {"locate", "navigate"})
        or PATTERNS["ui_words"].search(text)
        or PATTERNS["generic_page"].search(text)
        or PATTERNS["deictic"].search(text)
        or matches(text, LEXICONS.get("partial_terms", []))
    )
    if not partial:
        return ()
    return tuple(
        NavSlots(target=item["target"], page_hint=item["en"] if item["target"] == "page" else None)
        for item in LEXICONS["chip_defaults"][role]
    )


def clarify(message: str, role: Role, language: Language, *, hint: str | None = None) -> RouterDecision:
    lang = "en" if language == "en" else "vi"
    slots = extract_slots(message)
    templates = LEXICONS["templates"]
    candidates = plausible_targets(message, role)
    if len(candidates) >= 2:
        chips = tuple(
            ClarifyChip(
                label=f"{templates['open'][lang]} {candidate.page_hint or candidate.target.upper()}",
                route="navigate",
                slots=candidate,
            )
            for candidate in candidates[:4]
        )
    elif slots.target:
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
        hint=hint,
        clarify_question=templates["clarify"][lang],
        chips=chips,
    )


def is_contextual(message: str) -> bool:
    text = SurfaceText(message).folded
    explicit = any(matches(text, phrases) for phrases in LEXICONS["entities"].values())
    return bool(PATTERNS["bare_open"].fullmatch(text) or (PATTERNS["deictic"].search(text) and not explicit))


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
        return clarify(message, role, language, hint="navigate")
    if PATTERNS["deictic"].search(text) and is_contextual(message):
        contextual_hint = next(
            (
                route
                for route in ("locate", "navigate", "result", "howto")
                if matches(text, LEXICONS["families"].get(route, []))
            ),
            None,
        )
        return clarify(message, role, language, hint=contextual_hint)

    families = {name: matches(text, phrases) for name, phrases in LEXICONS["families"].items()}
    if matches(text, LEXICONS["profile_terms"]) and not families["howto"] and not families["locate"]:
        return clarify(message, role, language, hint="navigate")
    locate_match = bool(families["locate"] or PATTERNS["locate_button"].search(text))
    result_pattern = bool(PATTERNS["result_went"].search(text))
    result = bool(families["result"] or result_pattern)
    family_count = sum(bool(value) for value in families.values())
    family_count += int(locate_match and not families["locate"])
    family_count += int(result_pattern and not families["result"])
    if locate_match:
        return RouterDecision(
            route="locate",
            source="rules",
            confidence=0.95 if family_count == 1 else 0.5,
            language=language,
            hint="locate" if family_count != 1 else None,
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
    # An open verb governed by a how-to clause is instructional, not a second
    # route family for the confidence handoff.
    if howtos and opens and not imperative:
        family_count -= 1
    if imperative and slots.target:
        open_over_result = result and family_count == 2 and bool(families["navigate"]) and not howtos
        return RouterDecision(
            route="navigate",
            source="rules",
            confidence=0.95 if family_count == 1 or open_over_result else 0.5,
            language=language,
            hint="navigate" if family_count > 1 and not open_over_result else None,
            slots=slots,
            nav_mode=navigation_mode(message, slots, result=False, compound=bool(howtos)),
        )
    if result and slots.target in {"analysis", "interview", "report"}:
        return RouterDecision(
            route="result",
            source="rules",
            confidence=0.95 if family_count == 1 else 0.5,
            language=language,
            hint="result" if family_count > 1 else None,
            slots=slots,
            nav_mode=navigation_mode(message, slots, result=True),
        )
    if howtos:
        return RouterDecision(
            route="howto",
            source="rules",
            confidence=0.95 if family_count == 1 else 0.5,
            language=language,
            hint="howto" if family_count > 1 else None,
        )
    if opens or slots.target or PATTERNS["ui_words"].search(text):
        return clarify(message, role, language, hint="navigate" if opens or slots.target else "locate")
    return RouterDecision(route="howto", source="fallback", confidence=0.0, language=language)
