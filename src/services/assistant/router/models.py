"""Local routing contracts. Slots are phrases, never resolved business data."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Route = Literal["smalltalk", "howto", "locate", "navigate", "result", "clarify", "deny"]
Language = Literal["vi", "en", "mixed"]
Role = Literal["student", "advisor", "admin"]
Target = Literal["page", "cv", "jd", "analysis", "interview", "report"]


class RouterModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class NavSlots(RouterModel):
    target: Target | None = None
    page_hint: str | None = Field(default=None, min_length=1)
    when_expr: str | None = Field(default=None, min_length=1)
    latest: bool = False
    jd_ref: str | None = Field(default=None, min_length=1)
    cv_ref: str | None = Field(default=None, min_length=1)
    free_ref: str | None = Field(default=None, min_length=1)


class LocateSlots(RouterModel):
    """Raw UI words for the later UI-registry matcher; no CSS selectors."""

    target_hint: str = Field(min_length=1)
    page_hint: str | None = Field(default=None, min_length=1)


class CardTarget(RouterModel):
    """Trusted server-issued previous-turn card, supplied by the orchestrator."""

    ref: str = Field(min_length=1)
    route_id: str = Field(min_length=1)
    params: dict[str, str] = Field(default_factory=dict)
    label: str = Field(min_length=1)


class ClarifyChip(RouterModel):
    """Semantic candidates only; the registry will build links at execution time."""

    label: str = Field(min_length=1)
    route: Literal["navigate", "locate", "howto"]
    slots: NavSlots | LocateSlots


class RouterDecision(RouterModel):
    route: Route
    source: Literal["stage0", "cache", "rules", "classifier", "fallback"]
    confidence: float = Field(ge=0, le=1, allow_inf_nan=False)
    language: Language
    hint: Route | None = None
    deny_reason: Literal["off_topic", "unsafe", "injection", "out_of_role"] | None = None
    slots: NavSlots | LocateSlots | None = None
    nav_mode: Literal["fast", "agent"] | None = None
    clarify_question: str | None = None
    chips: tuple[ClarifyChip, ...] = ()
    card_target: CardTarget | None = None

    @model_validator(mode="after")
    def consistent_capability(self) -> Self:
        if (self.route == "deny") != (self.deny_reason is not None):
            raise ValueError("Only deny decisions require a deny reason")
        if self.route in {"navigate", "result"}:
            if not isinstance(self.slots, NavSlots) or self.nav_mode is None:
                raise ValueError("Navigate/result require NavSlots and nav_mode")
        elif self.nav_mode is not None:
            raise ValueError("nav_mode only applies to navigate/result")
        if self.route == "locate" and not isinstance(self.slots, LocateSlots):
            raise ValueError("Locate requires raw LocateSlots")
        if self.route == "clarify":
            if not self.clarify_question or not 2 <= len(self.chips) <= 4:
                raise ValueError("Clarify requires a question and 2 to 4 chips")
        elif self.chips or self.clarify_question:
            raise ValueError("Clarification fields only apply to clarify")
        if self.card_target is not None and self.route != "navigate":
            raise ValueError("A previous card target only applies to navigate")
        return self
