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


def test_locate_eval_rows() -> None:
    import json
    from pathlib import Path

    from src.services.assistant.locate import match_element

    rows = json.loads((Path(__file__).resolve().parents[1] / "eval/locate/rows.json").read_text(encoding="utf-8"))
    errors = []
    for row in rows:
        found = match_element(row["message"], row["role"])
        actual = found.element_id if found else None
        if actual != row["element_id"]:
            errors.append((row["message"], row["element_id"], actual))
    assert not errors, errors


def test_locate_navigation_order_and_howto_fallback() -> None:
    from src.services.assistant.locate import locate_actions

    actions = locate_actions("Where is upload CV?", "student", "/student/history")
    assert [action.type for action in actions] == ["navigate", "highlight"]
    assert actions[0].route_id == "cv_list"
    assert actions[1].element_id == "btn-upload-cv"
    assert [action.type for action in locate_actions("Where is upload CV?", "student", "/student/cv")] == ["highlight"]
    assert locate_actions("Where is choose CV?", "student", "/student/cv") == []


@pytest.mark.asyncio
async def test_locate_graph_bypasses_retrieval_and_provider() -> None:
    from unittest.mock import MagicMock

    from src.models.assistant import ClientPageContext
    from src.services.assistant.agent import AssistantAgent

    retriever = MagicMock()
    llm = MagicMock()
    context = ClientPageContext(current_url="/student/history", route="/student/history", user_role="student")
    result = await AssistantAgent(retriever, llm).respond("Nút tải lên CV ở đâu?", context)
    assert [action.type for action in result.ui_actions] == ["navigate", "highlight"]
    assert result.message == "Đây là nút bạn cần tìm."
    assert result.actions == []
    retriever.search.assert_not_called()
    llm.with_structured_output.assert_not_called()


@pytest.mark.asyncio
async def test_unmatched_locate_uses_howto_without_legacy_actions() -> None:
    from unittest.mock import MagicMock

    from src.models.assistant import ClientPageContext
    from src.services.assistant.agent import AssistantAgent

    retriever = MagicMock()
    retriever.search.return_value = []
    context = ClientPageContext(current_url="/student/cv", route="/student/cv", user_role="student")
    result = await AssistantAgent(retriever).respond("Nút đổi màu biểu đồ CV ở đâu?", context)
    retriever.search.assert_called_once()
    assert result.intent == "qa"
    assert result.ui_actions == []
    assert result.actions == []


@pytest.mark.asyncio
@pytest.mark.parametrize("element_id", ["unknown-target", "advisor-student-search"])
async def test_api_rejects_invalid_server_ui_payload(client, element_id: str) -> None:
    from src.main import app
    from src.models.assistant import AssistantResponse, UIHighlight
    from src.services.assistant.agent import get_assistant_agent
    from tests.helpers import STUDENT

    class InvalidAgent:
        async def respond(self, *args, **kwargs) -> AssistantResponse:
            # Simulate a forged internal payload that bypassed Pydantic construction.
            return AssistantResponse(
                message="Target",
                intent="action",
                ui_actions=[UIHighlight.model_construct(type="highlight", element_id=element_id)],
            )

    app.dependency_overrides[get_assistant_agent] = InvalidAgent
    try:
        response = await client.post(
            "/api/v1/assistant/chat",
            headers=STUDENT,
            json={
                "message": "Where is upload CV?",
                "context": {"current_url": "/student/cv", "route": "/student/cv", "user_role": "student"},
            },
        )
        assert response.status_code == 503
        assert response.json()["code"] == "assistant_unavailable"
        assert "ui_actions" not in response.json()
    finally:
        app.dependency_overrides.pop(get_assistant_agent, None)

