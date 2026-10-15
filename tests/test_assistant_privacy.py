"""Assistant mask-only contract; existing reversible product paths are separate."""

import pytest

from src.services.privacy.detectors import Detector
from src.services.privacy.masker import PlaceholderFilter, mask_only, neutralize_placeholders
from src.services.privacy.types import Identity, MaskingError
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
