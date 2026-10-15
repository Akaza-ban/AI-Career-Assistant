"""Public local router: guards → decision cache → rules → safe fallback."""

from collections.abc import Sequence

from src.config import get_settings
from src.services.assistant.router.cache import DecisionCache, cache_key
from src.services.assistant.router.guards import stage0
from src.services.assistant.router.models import CardTarget, Role, RouterDecision
from src.services.assistant.router.rules import decide_rules, is_contextual
from src.services.assistant.router.slots import extract_locate_slots, extract_slots
from src.services.assistant.router.text import detect_language, normalize


class LocalRouter:
    def __init__(self, *, cache: DecisionCache | None = None) -> None:
        settings = get_settings()
        self.max_chars = settings.router_max_input_chars
        self.cache = (
            cache
            if cache is not None
            else DecisionCache(
                maxsize=settings.router_cache_max,
                ttl_s=settings.router_cache_ttl_s,
                threshold=settings.router_cache_threshold,
            )
        )

    def clear_cache(self) -> None:
        self.cache.clear()

    def decide(
        self,
        message: str,
        *,
        role: Role,
        page_route_id: str | None = None,
        previous_targets: Sequence[CardTarget] = (),
    ) -> RouterDecision:
        early = stage0(message, role, max_chars=self.max_chars)
        if early:
            return early
        language = detect_language(message)
        contextual = is_contextual(message)
        key = cache_key(normalize(message).folded, role, page_route_id)
        if not contextual:
            cached = self.cache.get(key)
            if cached is not None:
                # A folded key deliberately merges accented/cased surface forms.
                # Rebind raw spans so another spelling never leaks into slots.
                slots = cached.slots
                if cached.route in {"navigate", "result"}:
                    slots = extract_slots(message)
                elif cached.route == "locate":
                    slots = extract_locate_slots(message)
                return cached.model_copy(update={"source": "cache", "language": language, "slots": slots})
        decision = decide_rules(message, role=role, language=language, previous_targets=previous_targets)
        if not contextual:
            self.cache.put(key, decision)
        return decision
