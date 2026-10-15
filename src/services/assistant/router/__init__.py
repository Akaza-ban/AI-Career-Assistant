"""Offline assistant capability router (stages 0–2)."""

from src.services.assistant.router.engine import LocalRouter
from src.services.assistant.router.evaluation import RulesEvalBackend
from src.services.assistant.router.models import CardTarget, LocateSlots, NavSlots, RouterDecision

__all__ = ["CardTarget", "LocalRouter", "LocateSlots", "NavSlots", "RouterDecision", "create_eval_backend"]


def create_eval_backend() -> RulesEvalBackend:
    """The local backend currently implements rules only; stage 3 is separate."""
    return RulesEvalBackend()
