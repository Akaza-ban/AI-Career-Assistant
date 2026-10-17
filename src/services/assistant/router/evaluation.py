"""Thin harness adapter. No annotations or evaluation datasets enter routing."""

from typing import TYPE_CHECKING

from src.services.assistant.router.engine import LocalRouter
from src.services.assistant.router.models import CardTarget, RouterDecision

if TYPE_CHECKING:
    from eval.router.backends import RouterInput


class RulesEvalBackend:
    def __init__(self) -> None:
        self.router = LocalRouter()

    def clear_cache(self) -> None:
        self.router.clear_cache()

    def predict(self, request: "RouterInput") -> RouterDecision:
        return self.router.decide(
            request.text,
            role=request.role,
            page_route_id=request.page_route_id,
            previous_targets=tuple(
                CardTarget.model_validate(target.model_dump()) for target in request.previous_targets
            ),
        )
