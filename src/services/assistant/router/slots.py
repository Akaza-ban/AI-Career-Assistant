"""Pure lexical slot extraction. Date interpretation belongs to the resolver."""

import re

from src.services.assistant.router.data import LEXICONS
from src.services.assistant.router.matching import PATTERNS, SurfaceText, matches
from src.services.assistant.router.models import LocateSlots, NavSlots


def _date_matches(surface: SurfaceText) -> list[re.Match[str]]:
    # Longer natural dates must win over their contained numeric fragments.
    found = matches(surface.folded, LEXICONS["relative_dates"])
    for name in ("date_vi", "date_en", "date_numeric"):
        found.extend(PATTERNS[name].finditer(surface.folded))
    return sorted(found, key=lambda item: (item.start(), -len(item.group())))


def extract_slots(message: str) -> NavSlots:
    surface = SurfaceText(message)
    text = surface.folded
    entities = {
        target: sorted(matches(text, phrases), key=lambda item: item.start())
        for target, phrases in LEXICONS["entities"].items()
    }
    target = next((target for target, found in entities.items() if found), None)
    dates = _date_matches(surface)
    latest = matches(text, LEXICONS["latest"])
    generic_pages = list(PATTERNS["generic_page"].finditer(text))
    page_words = matches(text, LEXICONS["pages"])
    page_hint = None
    refs: dict[str, str | None] = {"cv_ref": None, "jd_ref": None}
    free = PATTERNS["free_qualifier"].search(text)
    if free is None and not dates:
        free = PATTERNS["unparsed_qualifier"].search(text)
    free_ref = surface.group(free) if free else None

    if (generic_pages or page_words) and not dates and not latest and free is None:
        target = "page"
        content = sorted(
            [match for found in entities.values() for match in found] + page_words, key=lambda m: m.start()
        )
        start = content[0].start() if content else (generic_pages[0].end() if generic_pages else 0)
        if generic_pages and generic_pages[0].start() <= start:
            start = generic_pages[0].end()
        end = len(text)
        if generic_pages and generic_pages[-1].start() > start:
            end = generic_pages[-1].start()
        tail = PATTERNS["terminal_qualifier"].search(text, start)
        if tail:
            end = min(end, tail.start())
        page_hint = surface.span(start, end).strip(" .!?;,:") or None
        if page_hint:
            while start < end and text[start].isspace():
                start += 1
            article = PATTERNS["strip_articles"].match(text[start:end])
            if article:
                page_hint = surface.span(start + article.end(), end).strip(" .!?;,:") or None
        if page_hint is None:
            target = None
    else:
        markers = list(PATTERNS["ref_marker"].finditer(text))
        for index, marker in enumerate(markers):
            start = marker.end()
            end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
            stop = PATTERNS["ref_stop"].search(text, start, end)
            if stop:
                end = stop.start()
            for qualifier in [*dates, *latest, *([free] if free else [])]:
                if start <= qualifier.start() < end:
                    end = qualifier.start()
            value = surface.span(start, end).strip(" .!?;,:")
            if value:
                refs[marker["kind"] + "_ref"] = value
        # Preserve a record/position qualifier the later resolver might need.
        if target in {"analysis", "interview", "report"} and not markers and free_ref is None:
            start = entities[target][0].end()
            end = min([len(text), *(item.start() for item in [*dates, *latest] if item.start() >= start)])
            candidate = surface.span(start, end).strip(" .!?;,:")
            if candidate and not PATTERNS["qualifier_noise"].fullmatch(text[start:end].strip()):
                free_ref = candidate

    return NavSlots(
        target=target,
        page_hint=page_hint,
        when_expr=surface.group(dates[0]) if dates else None,
        latest=bool(latest),
        free_ref=free_ref,
        **refs,
    )


def extract_locate_slots(message: str) -> LocateSlots:
    surface = SurfaceText(message)
    nav = extract_slots(message)
    # The UI registry is the authority for element IDs; pass only the raw hint.
    return LocateSlots(target_hint=surface.raw.strip(), page_hint=nav.page_hint)


def navigation_mode(message: str, slots: NavSlots, *, result: bool, compound: bool = False) -> str:
    surface = SurfaceText(message)
    if slots.target is None or slots.free_ref or compound or len(_date_matches(surface)) > 1:
        return "agent"
    if PATTERNS["compound_join"].search(surface.folded):
        entities = {target for target, phrases in LEXICONS["entities"].items() if matches(surface.folded, phrases)}
        # Analysis may have both CV/JD qualifiers; a report may describe an
        # interview. Other combinations need the later read-only agent path.
        allowed = {slots.target}
        if slots.target == "analysis":
            allowed.update({"cv", "jd"})
        elif slots.target == "report":
            allowed.add("interview")
        if entities - allowed:
            return "agent"
    if result:
        text = surface.folded
        metric_groups = sum(bool(matches(text, phrases)) for phrases in LEXICONS["metrics"].values())
        if metric_groups != 1:
            return "agent"
    return "fast"
