import unicodedata

import pytest
from pydantic import ValidationError

from src.services.assistant.router import LocateSlots, NavSlots, RouterDecision
from src.services.assistant.router.text import detect_language, normalize


def test_folding_handles_nfc_whitespace_and_vietnamese_d() -> None:
    text = normalize(unicodedata.normalize("NFD", "  MỞ\n  ĐIỂM CV "))
    assert text.normalized == "mở điểm cv"
    assert text.folded == "mo diem cv"
    assert unicodedata.is_normalized("NFC", text.raw)


@pytest.mark.parametrize(
    "text,language",
    [
        ("Mở trang CV", "vi"),
        ("mo trang phong van", "vi"),
        ("Open my CV", "en"),
        ("Open trang CV", "mixed"),
        ("你好", "vi"),
    ],
)
def test_language_detector(text: str, language: str) -> None:
    assert detect_language(text) == language


def test_slots_preserve_raw_phrases_and_dates() -> None:
    slots = NavSlots(target="analysis", when_expr="hôm qua", jd_ref="Shopee Backend", cv_ref="Backend_v3")
    decision = RouterDecision(
        route="navigate", source="rules", confidence=0.95, language="vi", slots=slots, nav_mode="fast"
    )
    assert RouterDecision.model_validate_json(decision.model_dump_json()) == decision
    assert decision.slots.when_expr == "hôm qua"
    assert LocateSlots(target_hint="Nút tải CV").target_hint == "Nút tải CV"


@pytest.mark.parametrize("confidence", [-0.1, 1.1, float("nan"), float("inf")])
def test_confidence_is_bounded(confidence: float) -> None:
    with pytest.raises(ValidationError):
        RouterDecision(route="howto", source="rules", language="en", confidence=confidence)


def test_models_reject_resolved_data_and_inconsistent_decisions() -> None:
    with pytest.raises(ValidationError):
        NavSlots(target="cv", user_id="untrusted")
    with pytest.raises(ValidationError):
        RouterDecision(route="navigate", source="rules", confidence=0.95, language="en")
    with pytest.raises(ValidationError):
        RouterDecision(route="deny", source="stage0", confidence=1.0, language="en")
    with pytest.raises(ValidationError):
        RouterDecision(route="clarify", source="fallback", confidence=0.0, language="en")
