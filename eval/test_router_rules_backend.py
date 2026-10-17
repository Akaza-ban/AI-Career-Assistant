"""Real rules backend integration with T2.1's annotation-independent harness."""

import pytest

from eval.router.backends import RouterInput, RouterPrediction, load_backend
from eval.router.dataset import CardTarget


@pytest.mark.parametrize(
    "text",
    ["Hello CareerX assistant", "Chào trợ lý CareerX nhé", "xin chao, minh moi vao day", "Thanks bạn đã hướng dẫn"],
)
def test_adapter_preserves_stage_zero_smalltalk_provenance(text: str) -> None:
    decision = load_backend("rules").predict(RouterInput(text=text, role="student", page_route_id="student_home"))
    assert (decision.route, decision.source) == ("smalltalk", "stage0")


def test_registered_rules_backend_has_real_sources_and_resettable_cache() -> None:
    backend = load_backend("rules")
    request = RouterInput(text="Open my CV", role="student", page_route_id="student_home")
    first = backend.predict(request)
    assert first.source == "rules"
    assert RouterPrediction.model_validate(first.model_dump()).route == "navigate"
    assert backend.predict(request).source == "cache"
    backend.clear_cache()
    assert backend.predict(request) == first
    assert load_backend("local").predict(request) == first


def test_adapter_forwards_exactly_one_server_card_without_gold_annotations() -> None:
    target = CardTarget(ref="unit-a", route_id="analysis_detail", params={"analysis_id": "a"}, label="Analysis A")
    backend = load_backend("rules")
    request = RouterInput(text="open it", role="student", page_route_id="student_home", previous_targets=(target,))
    decision = backend.predict(request)
    assert decision.card_target.model_dump() == target.model_dump()
    assert decision.route == "navigate"
    assert decision.source == "rules"
    assert backend.predict(request.model_copy(update={"previous_targets": ()})).route == "clarify"
