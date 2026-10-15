"""Named evaluator adapters, not router implementations or training code."""

from collections.abc import Callable
from importlib import import_module
from importlib.metadata import entry_points
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator

from eval.router.dataset import CardTarget, DenyReason, NavSlots, Route


class RouterInput(BaseModel):
    """Only the allowed inference inputs. No IDs, labels, slots or subset tags."""

    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)
    text: str
    role: Literal["student", "advisor", "admin"]
    page_route_id: str | None
    previous_targets: tuple[CardTarget, ...] = ()


class RouterPrediction(BaseModel):
    # Retain confidence for selective coverage; language/nav_mode remain outside
    # the evaluation output contract. Gold annotations never enter inference.
    model_config = ConfigDict(extra="ignore", strict=True)
    route: Route
    source: Literal["stage0", "cache", "rules", "classifier", "fallback"]
    deny_reason: DenyReason | None = None
    slots: dict[str, Any] | None = None
    confidence: float | None = Field(default=None, ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_nav_slots(self) -> "RouterPrediction":
        if self.route in {"navigate", "result"} and self.slots is not None:
            # Keep raw phrases; only fill section 5.1 defaults. Do not fold,
            # parse dates or forgive spurious qualifiers in exact match.
            NavSlots.model_validate(self.slots)
        return self


class RouterBackend(Protocol):
    """Factory loads models once; clear_cache must really evict decision caches.

    predict is synchronous and returns RouterPrediction, a RouterDecision
    BaseModel, or a compatible mapping. An async candidate needs a sync adapter.
    Cache clearing/model loading happen outside measured inference time.
    """

    def clear_cache(self) -> None: ...

    def predict(self, request: RouterInput) -> RouterPrediction | BaseModel | dict[str, Any]: ...


BackendFactory = Callable[[], RouterBackend]
BACKENDS: dict[str, str | BackendFactory] = {
    "local": "src.services.assistant.router:create_eval_backend",
    "rules": "src.services.assistant.router:create_eval_backend",
}


def register_backend(name: str, factory: BackendFactory) -> None:
    if not name or ":" in name or name in BACKENDS:
        raise ValueError("Backend name must be nonempty, unique and contain no colon")
    BACKENDS[name] = factory


def load_backend(name: str) -> RouterBackend:
    """Resolve a built-in name, installed entry point, or module:factory.

    Candidates install the careerx.router_eval entry-point group. There is no
    oracle or always-pass default; local is unavailable until the router task
    supplies its adapter.
    """
    target: str | BackendFactory | None = BACKENDS.get(name)
    if target is None and ":" in name:
        target = name
    if target is None:
        matches = list(entry_points(group="careerx.router_eval", name=name))
        if len(matches) != 1:
            raise ValueError("Unknown or duplicate router backend name")
        target = matches[0].load()
    if isinstance(target, str):
        module, attribute = target.split(":", 1)
        target = getattr(import_module(module), attribute)
    backend = target()
    if not callable(getattr(backend, "predict", None)) or not callable(getattr(backend, "clear_cache", None)):
        raise TypeError("Router backend must implement predict(request) and clear_cache()")
    return backend
