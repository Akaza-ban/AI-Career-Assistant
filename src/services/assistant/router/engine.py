"""Public local router: guards → decision cache → rules → safe fallback."""

from collections.abc import Sequence

from src.config import get_settings
from src.services.assistant.router.cache import DecisionCache, cache_key
from src.services.assistant.router.classifier import load_classifier, predict_probabilities
from src.services.assistant.router.guards import stage0
from src.services.assistant.router.models import CardTarget, Language, Role, RouterDecision
from src.services.assistant.router.rules import clarify, decide_rules, is_contextual, plausible_targets
from src.services.assistant.router.slots import extract_locate_slots, extract_slots, navigation_mode
from src.services.assistant.router.text import detect_language, normalize


class LocalRouter:
    def __init__(self, *, cache: DecisionCache | None = None) -> None:
        settings = get_settings()
        self.max_chars = settings.router_max_input_chars
        self.rules_threshold = settings.router_cache_threshold
        self.classifier_threshold = settings.router_clf_threshold
        self.classifier_margin = settings.router_clf_margin
        self.classifier = load_classifier(settings.router_classifier_artifact)
        self.cache = (
            cache
            if cache is not None
            else DecisionCache(
                maxsize=settings.router_cache_max,
                ttl_s=settings.router_cache_ttl_s,
                threshold=min(settings.router_cache_threshold, settings.router_clf_threshold),
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
        if decision.confidence < self.rules_threshold and not contextual:
            decision = self._stage3_or_fallback(decision, message, role, language)
        if not contextual:
            self.cache.put(key, decision)
        return decision

    def _stage3_or_fallback(self, hint: RouterDecision, message: str, role: Role, language: Language) -> RouterDecision:
        ranked = (
            predict_probabilities(self.classifier, normalize(message).folded) if self.classifier is not None else []
        )
        candidates = plausible_targets(message, role)
        if hint.route == "clarify" and len(candidates) >= 2:
            return clarify(message, role, language, hint=hint.hint)
        if ranked:
            route, confidence = ranked[0]
            margin = confidence - (ranked[1][1] if len(ranked) > 1 else 0.0)
            accepted = confidence >= self.classifier_threshold and margin >= self.classifier_margin
            if accepted and route != "clarify":
                return self._capability(route, confidence, "classifier", message, language)
            if accepted and route == "clarify" and len(candidates) >= 2:
                return clarify(message, role, language, hint=hint.hint).model_copy(
                    update={"source": "classifier", "confidence": float(confidence)}
                )
        if len(candidates) >= 2:
            return clarify(message, role, language, hint=hint.hint)
        # A single destination is not ambiguity. Use the best actionable label
        # even on abstention; with no artifact, guide RAG is the safe default.
        route, confidence = next(((r, p) for r, p in ranked if r != "clarify"), ("howto", 0.0))
        return self._capability(route, confidence, "fallback", message, language)

    @staticmethod
    def _capability(route: str, confidence: float, source: str, message: str, language: Language) -> RouterDecision:
        slots = None
        nav_mode = None
        if route == "locate":
            slots = extract_locate_slots(message)
        elif route in {"navigate", "result"}:
            slots = extract_slots(message)
            nav_mode = navigation_mode(message, slots, result=route == "result")
        return RouterDecision(
            route=route,
            source=source,
            confidence=float(confidence),
            language=language,
            slots=slots,
            nav_mode=nav_mode,
            deny_reason="off_topic" if route == "deny" else None,
        )
