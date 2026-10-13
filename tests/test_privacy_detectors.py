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


def test_prose_candidate_referee_names_and_skill_negative_controls():
    detector = Detector(EmptyNer())
    for text, expected in [
        ("I am Alice Morgan, seeking work", "Alice Morgan"),
        ("Ứng viên Nguyễn Minh An - Backend Developer", "Nguyễn Minh An"),
        ("Bùi Thảo Vy hướng dẫn dự án.", "Bùi Thảo Vy"),
        ("Noah Bennett supervised the project.", "Noah Bennett"),
        ("Upload failed for candidate Emma Brooks; contact support", "Emma Brooks"),
    ]:
        found = detector.detect(text)
        assert expected in [text[s.start : s.end] for s in found]
    assert detector.detect("I am a software engineer") == []
    assert detector.detect("Applicant Machine Learning") == []


def test_ner_does_not_mask_field_labels_or_employer_school_context():
    text = "Address: 12 Oak Street\nWorked at Acme Labs; studied at Brown University."

    class NoisyNer:
        def detect(self, text):
            return [Span(0, 21, "ADDRESS"), Span(text.index("Acme"), text.index(";"), "PERSON")]

    spans = Detector(NoisyNer()).detect(text)
    assert [text[s.start : s.end] for s in spans] == ["12 Oak Street"]


def test_ner_job_titles_and_non_pii_field_labels_are_preserved():
    text = "Software Engineer\nEmployment: 2020-2024\nLiteral user text: opaque value"

    class NoisyNer:
        def detect(self, text):
            return [Span(0, 17, "PERSON"), Span(18, 28, "PERSON"), Span(40, 47, "PERSON")]

    assert Detector(NoisyNer()).detect(text) == []


def test_crlf_addresses_have_exact_value_boundaries():
    text = "Address: 12 Oak Street\r\nĐịa chỉ: 11 đường Hoa, phường 4\r\n"
    spans = Detector(EmptyNer()).detect(text)
    assert [text[s.start : s.end] for s in spans] == ["12 Oak Street", "11 đường Hoa, phường 4"]


def test_escaped_opaque_tokens_are_not_person_names_but_embedded_emails_are_masked():
    from src.services.privacy.masker import escape_inbound

    wire = escape_inbound("[[PERSON_1]] [[a@example.test]]")

    class TokenNer:
        def detect(self, text):
            return [Span(0, 20, "PERSON")]

    spans = Detector(TokenNer()).detect(wire)
    assert [s.kind for s in spans] == ["EMAIL"]


def test_identity_kind_takes_precedence_over_ambiguous_regex():
    text = "912345678"
    spans = Detector(EmptyNer()).detect(text, identities=[Identity(phone=text)])
    assert len(spans) == 1 and spans[0].kind == "PHONE"


def test_same_line_employer_does_not_hide_third_party_name():
    text = "Employer: Acme Labs; contact Alice Smith"

    class NameNer:
        def detect(self, text):
            return [Span(text.index("Acme"), text.index(";"), "PERSON"), Span(text.index("Alice"), len(text), "PERSON")]

    spans = Detector(NameNer()).detect(text, document_type="jd")
    assert [text[s.start : s.end] for s in spans] == ["Alice Smith"]


def test_street_ward_district_labels_and_city_only_address_preservation():
    text = "Đường: Hoa Mai\nPhường: An Phú\nDistrict: Central\nStreet:Oak Road\nAddress: Hà Nội\nTP. Hồ Chí Minh"
    spans = Detector(EmptyNer()).detect(text)
    assert [text[s.start : s.end] for s in spans] == ["Hoa Mai", "An Phú", "Central", "Oak Road"]
