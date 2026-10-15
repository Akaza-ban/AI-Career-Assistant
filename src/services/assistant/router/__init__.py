"""Offline assistant capability router (stages 0–4)."""

from src.services.assistant.router.engine import LocalRouter
from src.services.assistant.router.evaluation import RulesEvalBackend
from src.services.assistant.router.models import CardTarget, LocateSlots, NavSlots, RouterDecision

__all__ = ["CardTarget", "LocalRouter", "LocateSlots", "NavSlots", "RouterDecision", "create_eval_backend"]


def create_eval_backend() -> RulesEvalBackend:
    """Create a local router and load its optional stage-3 artifact once."""
    return RulesEvalBackend()
