import pytest

from src.services.privacy.detectors import Detector, header_spans, identity_spans, merge_spans, regex_spans
from src.services.privacy.types import Identity, MaskingError, NerUnavailableError, Span


class EmptyNer:
    def detect(self, text: str) -> list[Span]:
        return []


def test_four_layers_merge_without_losing_identifiers():
    text = "Nguyễn Văn An\nEmail: an@example.test\nPhone: +84 912 345 678\nCCCD: 012345678901\nDOB: 01/02/2000\nAddress: 12 Oak Street\nRecruiter: Alice Smith"
    detector = Detector(EmptyNer())
    found = detector.detect(text, document_type="cv")
    assert {s.kind for s in found} >= {"PERSON", "EMAIL", "PHONE", "ID", "DOB", "ADDRESS"}
    assert "Alice Smith" in [text[s.start : s.end] for s in found]
    assert all(a.end <= b.start for a, b in zip(found, found[1:]))


def test_known_identity_variants_and_boundaries():
    text = "Nguyen Van An, An Van Nguyen, Văn An Nguyễn; xNguyen Van Any"
    spans = identity_spans(text, [Identity(name="Nguyễn Văn An")])
    assert [text[s.start : s.end] for s in spans] == ["Nguyen Van An", "An Van Nguyen", "Văn An Nguyễn"]


def test_employment_dates_city_skills_employers_and_schools_are_kept():
    text = "Software Engineer\nComputer Science\nPython Java\nEmployer: Acme Labs\nSchool: Stanford University\nLocation: Hà Nội\nEmployment: 2020-2024"
    assert header_spans(text) == []
    assert regex_spans(text) == []


def test_jd_runs_person_ner_but_not_candidate_header():
    text = "Hiring Engineer\nContact Morgan Wells"

    class NameNer:
        def detect(self, text: str) -> list[Span]:
            return [Span(text.index("Morgan"), len(text), "PERSON")]

    found = Detector(NameNer()).detect(text, document_type="jd")
    assert [text[s.start : s.end] for s in found] == ["Morgan Wells"]


def test_location_ner_keeps_cities_masks_streets():
    class LocationNer:
        def detect(self, text: str) -> list[Span]:
            return [Span(0, 6, "ADDRESS"), Span(8, len(text), "ADDRESS")]

    text = "Hà Nội; 14 phố Hoa"
    assert [text[s.start : s.end] for s in Detector(LocationNer()).detect(text)] == ["14 phố Hoa"]


@pytest.mark.parametrize("span", [Span(-1, 2, "PERSON"), Span(0, 100, "PERSON"), Span(1, 1, "PERSON")])
def test_invalid_span_fails_closed(span):
    with pytest.raises(MaskingError):
        merge_spans([span], 4)


def test_ner_failure_is_typed_and_does_not_echo_text():
    class BrokenNer:
        def detect(self, text: str) -> list[Span]:
            raise ValueError(text)

    with pytest.raises(NerUnavailableError) as error:
        Detector(BrokenNer()).detect("secret@example.test")
    assert "secret" not in str(error.value)
    with pytest.raises(NerUnavailableError):
        Detector().detect("anything")
