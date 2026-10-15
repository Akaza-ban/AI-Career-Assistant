"""Registry and read-only UI protocol contracts."""

import pytest
from pydantic import ValidationError

from src.models.assistant import ROUTES, route_allowed
from src.services.assistant.guardrails import validate_ui_actions
from src.services.assistant.ui_registry import load_routes, load_ui_registry, resolve_route


def test_registry_roles_and_legacy_whitelist_share_one_source() -> None:
    for element in load_ui_registry().values():
        for role in element.roles:
            assert route_allowed(resolve_route(element.route_id, {}, role), role)
    assert "/student/overview" in ROUTES["student"]
    assert not route_allowed("/advisor/students", "student")
    assert not route_allowed("/advisor/reviews", "advisor")
    assert route_allowed("/student/analysis/compare", "student")
    assert not route_allowed("/student/analysis/compare/compare", "student")


@pytest.mark.parametrize(
    "payload",
    [
        {"type": "highlight", "element_id": "missing"},
        {"type": "highlight", "element_id": "advisor-student-search"},
        {"type": "highlight", "element_id": "btn-upload-cv", "selector": "body"},
        {"type": "navigate", "route_id": "advisor_students", "params": {}},
        {"type": "navigate", "route_id": "https://evil.test", "params": {}},
        {"type": "navigate", "route_id": "cv_list", "params": {"url": "https://evil.test"}},
        {"type": "navigate", "route_id": "cv_detail", "params": {"cv_id": "../other"}},
        {"type": "navigate", "route_id": "analysis_detail", "params": {"analysis_id": "compare"}},
        {"type": "click", "element_id": "btn-upload-cv"},
    ],
)
def test_unknown_or_forbidden_ui_payload_is_rejected(payload: dict[str, object]) -> None:
    with pytest.raises((ValueError, ValidationError)):
        validate_ui_actions([payload], "student")


def test_ui_action_variants_and_role_whitelist() -> None:
    for role in ("student", "advisor"):
        for element in load_ui_registry().values():
            payload = {"type": "highlight", "element_id": element.element_id}
            if role in element.roles:
                assert validate_ui_actions([payload], role)[0].element_id == element.element_id
            else:
                with pytest.raises(ValueError):
                    validate_ui_actions([payload], role)
        for route_id, entry in load_routes().items():
            params = {key: "record-123" for key in entry.params}
            payload = {"type": "navigate", "route_id": route_id, "params": params}
            if role in entry.roles:
                assert validate_ui_actions([payload], role)[0].route_id == route_id
            else:
                with pytest.raises(ValueError):
                    validate_ui_actions([payload], role)

