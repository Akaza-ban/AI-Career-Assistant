"""Assistant mask-only contract; existing reversible product paths are separate."""

import pytest

from src.services.privacy.detectors import Detector
from src.services.privacy.masker import PlaceholderFilter, mask_only, neutralize_placeholders
from src.services.privacy.types import Identity, MaskingError, Span
from tests.test_privacy_detectors import EmptyNer


def test_mask_only_identity_variants_filenames_literals_and_keep_values() -> None:
    detector = Detector(EmptyNer())
    identity = Identity(name="Nguyễn Minh An", email="an@example.test", phone="0912345678")
    raw = "Nguyen_Minh_An_CV.pdf; An Minh Nguyen; an@example.test; 0912345678; [[EMAIL_1]]; Python FPT Hà Nội"
    wire = mask_only(raw, detector=detector, identities=(identity,))
    assert "Nguyen_Minh_An" not in wire and "An Minh Nguyen" not in wire
    assert "an@example.test" not in wire and "0912345678" not in wire
    assert "&#91;&#91;EMAIL_1]]" in wire
    assert "Python FPT Hà Nội" in wire
    assert "[[PERSON]]" in wire


@pytest.mark.parametrize("text", ["[[anything]]", "[[PERSON_1]]", "[[a\nb]]", "[[", "[[unterminated"])
def test_arbitrary_placeholders_removed_at_every_stream_split(text: str) -> None:
    source = "Hello " + text + ("!" if text.endswith("]]") else "")
    expected = "Hello you" + ("!" if text.endswith("]]") else "")
    assert neutralize_placeholders(source, neutral="you") == expected
    for split in range(len(source) + 1):
        guard = PlaceholderFilter("you")
        assert guard.feed(source[:split]) + guard.feed(source[split:]) + guard.finish() == expected
    guard = PlaceholderFilter("you")
    assert "".join(guard.feed(char) for char in source) + guard.finish() == expected


def test_mask_only_fails_closed_without_leaking_exception() -> None:
    class BrokenDetector(Detector):
        def detect(self, text: str, **kwargs: object) -> list:
            raise RuntimeError("secret@example.test")

    with pytest.raises(MaskingError) as error:
        mask_only("secret@example.test", detector=BrokenDetector())
    assert "secret@example.test" not in str(error.value)
    assert error.value.__context__ is None


def test_filename_normalization_preserves_contact_punctuation() -> None:
    for raw in ("first_last@example.test", "first-last@example.test", "@first_last", "@first-last"):
        wire = mask_only(raw, detector=Detector(EmptyNer()))
        assert raw not in wire
        assert wire in {"[[EMAIL]]", "[[HANDLE]]"}


def test_message_ner_cannot_expand_exact_name_or_id_boundaries() -> None:
    text = "Open CV Alice Morgan; Passport: X1234567; Find"

    class BroadNer:
        def detect(self, value: str) -> list[Span]:
            return [
                Span(value.index("CV"), value.index(";"), "PERSON"),
                Span(value.index(":"), value.rindex(";"), "PERSON"),
                Span(value.index("Find"), len(value), "PERSON"),
            ]

    assert mask_only(text, detector=Detector(BroadNer()), identities=(Identity(name="Alice Morgan"),)) == (
        "Open CV [[PERSON]]; Passport: [[ID]]; Find"
    )
