"""Validated Assistant API payloads and the eight UI Action Protocol variants."""

import math
import re
from typing import Annotated, Any, Literal, Self
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, field_validator, model_validator

Role = Literal["student", "advisor"]
Intent = Literal["qa", "action", "hybrid"]
Identifier = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[\w-]+$")]
Selector = Annotated[
    str,
    Field(pattern=r"^(?:\[data-agent-target=(?:\"[\w-]+\"|'[\w-]+')\]|#[A-Za-z][\w-]*)$", max_length=160),
]

ROUTES: dict[str, set[str]] = {
    "student": {
        "/student",
        "/student/overview",
        "/student/cv",
        "/student/analysis",
        "/student/analysis/new",
        "/student/interview",
        "/student/interview/new",
        "/student/interview/start",
        "/student/history",
        "/student/share",
        "/student/settings",
    },
    "advisor": {
        "/advisor",
        "/advisor/dashboard",
        "/advisor/students",
        "/advisor/reviews",
        "/advisor/analytics",
        "/advisor/settings",
    },
}


def route_allowed(route: str, role: str) -> bool:
    if route in ROUTES.get(role, set()):
        return True
    if role == "student":
        return any(
            re.fullmatch(pattern, route)
            for pattern in (
                r"/student/cv/[\w-]{1,64}",
                r"/student/analysis/[\w-]{1,64}(?:/(?:optimize|export))?",
                r"/student/interview/[\w-]{1,64}(?:/report)?",
            )
        )
    return role == "advisor" and bool(re.fullmatch(r"/advisor/students/[\w-]{1,64}", route))


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)


class NavigateParams(StrictModel):
    route: str = Field(min_length=1, max_length=200)
    query: dict[str, str] = Field(default_factory=dict)

    @field_validator("route")
    @classmethod
    def valid_route(cls, value: str) -> str:
        if not any(route_allowed(value, role) for role in ROUTES):
            raise ValueError("Route is not in the Assistant whitelist")
        return value


class HighlightParams(StrictModel):
    selector: Selector
    tooltip: str | None = Field(default=None, max_length=500)
    duration_ms: int = Field(default=5000, ge=100, le=30000)


class FilterParams(StrictModel):
    filter_name: str = Field(min_length=1, max_length=64, pattern=r"^[a-z_]+$")
    value: str | StrictInt | StrictFloat

    @field_validator("value")
    @classmethod
    def bounded_value(cls, value: str | int | float) -> str | int | float:
        if isinstance(value, str) and len(value) > 500:
            raise ValueError("Filter value is too long")
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Filter value must be finite")
        return value


class ModalParams(StrictModel):
    modal_id: Identifier


class AnalysisParams(StrictModel):
    cv_id: Identifier
    jd_id: Identifier


class StudentParams(StrictModel):
    student_id: Identifier


class ScrollParams(StrictModel):
    selector: Selector | None = None
    position: Literal["top", "bottom"] | None = None

    @model_validator(mode="after")
    def one_target(self) -> Self:
        if (self.selector is None) == (self.position is None):
            raise ValueError("Specify exactly one of selector and position")
        return self


class ResetParams(StrictModel):
    clear_filters: bool = True
    close_modals: bool = True


class ActionBase(StrictModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    description_vi: str = Field(min_length=1, max_length=500)
    requires_confirmation: Literal[False] = False
    confirmation_message: str | None = Field(default=None, max_length=1000)

    @field_validator("requires_confirmation", mode="before")
    @classmethod
    def boolean_confirmation(cls, value: Any) -> bool:
        if type(value) is not bool:
            raise ValueError("requires_confirmation must be a boolean")
        return value

    @field_validator("id")
    @classmethod
    def valid_uuid(cls, value: str) -> str:
        return str(UUID(value))


class NavigateAction(ActionBase):
    action_type: Literal["NAVIGATE_PAGE"] = "NAVIGATE_PAGE"
    params: NavigateParams


class HighlightAction(ActionBase):
    action_type: Literal["HIGHLIGHT_ELEMENT"] = "HIGHLIGHT_ELEMENT"
    params: HighlightParams


class FilterAction(ActionBase):
    action_type: Literal["FILL_FILTER"] = "FILL_FILTER"
    params: FilterParams


class ModalAction(ActionBase):
    action_type: Literal["OPEN_MODAL"] = "OPEN_MODAL"
    params: ModalParams


class AnalysisAction(ActionBase):
    action_type: Literal["START_ANALYSIS"] = "START_ANALYSIS"
    params: AnalysisParams
    requires_confirmation: Literal[True] = True
    confirmation_message: str = Field(
        default="Bạn có muốn bắt đầu phân tích CV cho vị trí này?", min_length=1, max_length=1000
    )


class StudentAction(ActionBase):
    action_type: Literal["SELECT_STUDENT"] = "SELECT_STUDENT"
    params: StudentParams


class ScrollAction(ActionBase):
    action_type: Literal["SCROLL_TO"] = "SCROLL_TO"
    params: ScrollParams


class ResetAction(ActionBase):
    action_type: Literal["RESET_VIEW"] = "RESET_VIEW"
    params: ResetParams = Field(default_factory=ResetParams)


AgentAction = Annotated[
    NavigateAction
    | HighlightAction
    | FilterAction
    | ModalAction
    | AnalysisAction
    | StudentAction
    | ScrollAction
    | ResetAction,
    Field(discriminator="action_type"),
]


class ClientPageContext(StrictModel):
    current_url: str = Field(min_length=1, max_length=1000)
    route: str = Field(min_length=1, max_length=200)
    user_role: Role
    user_id: Identifier | None = None
    selected_cv_id: Identifier | None = None
    page_state: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str | None = Field(default=None, max_length=64)
    context: ClientPageContext


class SourceCitation(StrictModel):
    chunk_id: str
    title: str
    route: str
    section: str
    snippet: str
    selector: str | None = None


class AssistantResponse(StrictModel):
    message: str = Field(min_length=1, max_length=16000)
    intent: Intent
    actions: list[AgentAction] = Field(default_factory=list, max_length=8)
    sources: list[SourceCitation] = Field(default_factory=list)


class ChatResponse(AssistantResponse):
    conversation_id: str
    turn_id: str


class ActionConfirmationRequest(StrictModel):
    action_id: str = Field(min_length=1, max_length=64)
    status: Literal["executed", "rejected", "failed"]
    error_message: str | None = Field(default=None, max_length=2000)


class ActionConfirmationResponse(StrictModel):
    action_id: str
    status: Literal["executed", "rejected", "failed"]


class AssistantFeedbackRequest(StrictModel):
    turn_id: str = Field(min_length=1, max_length=64)
    rating: Literal[1, -1]
    comment: str | None = Field(default=None, max_length=2000)

    @field_validator("rating", mode="before")
    @classmethod
    def integer_rating(cls, value: Any) -> int:
        if type(value) is not int or value not in (1, -1):
            raise ValueError("Rating must be the integer 1 or -1")
        return value


class AssistantFeedbackResponse(StrictModel):
    id: str
    turn_id: str
    rating: Literal[1, -1]


class ReindexResponse(StrictModel):
    chunks_indexed: int
