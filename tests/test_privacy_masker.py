import secrets

import pytest

from src.services.privacy.detectors import Detector
from src.services.privacy.masker import escape_inbound, mask, mask_document, resolve, unmask
from src.services.privacy.types import KINDS, MAX_PLACEHOLDER_LENGTH, Identity, MaskingError, ResolutionError
from tests.test_privacy_detectors import EmptyNer


class TestVault:
    __test__ = False

    def __init__(self):
        self.nonce = secrets.token_hex(16)
        self.entries = {}

    def store(self, original, kind, origin):
        for token, (old, old_kind, origins) in self.entries.items():
            if old == original:
                origins.add(origin)
                return token
        token = f"[[{kind}_{self.nonce}_{len(self.entries) + 1}]]"
        self.entries[token] = (original, kind, {origin})
        return token

    def resolve_placeholder(self, token, allowed_kinds, allowed_origins):
        if token not in self.entries:
            raise ResolutionError("Unknown placeholder")
        value, kind, origins = self.entries[token]
        if kind not in allowed_kinds or not origins.intersection(allowed_origins):
            raise ResolutionError("Scope refused")
        return value


@pytest.fixture
def detector():
    return Detector(EmptyNer())


@pytest.mark.parametrize(
    "text",
    [
        "Alice Smith\nEmail: alice@example.test\nPhone: +1 (202) 555-0142",
        "[[PERSON_1]] &amp; &#91;&#91; <tag> & [[ [[",
        "a&b@example.test; Address: 12 Oak Street",
        "Nguyễn Văn An\nĐịa chỉ: 12 đường Hoa, phường 1\nDOB: 1/2/2000",
        "",
    ],
)
def test_round_trip(text, detector):
    vault = TestVault()
    value = mask(text, vault, detector=detector)
    assert unmask(value, vault, allowed_kinds=KINDS, allowed_origins={"message"}) == text
    assert all(len(token) <= MAX_PLACEHOLDER_LENGTH for token in vault.entries)


def test_ocr_identity_round_trip_preserves_misspelling_and_escaped_literals(detector):
    vault = TestVault()
    text = "Reviewed by Nguycn Van An; [[PERSON_1]]"
    value = mask(text, vault, detector=detector, identities=[Identity(name="Nguyễn Văn An")], origin="cv:ocr")
    assert "Nguycn Van An" not in value
    assert unmask(value, vault, allowed_kinds={"PERSON"}, allowed_origins={"cv:ocr"}) == text


def test_injected_literal_and_copied_live_token_never_resolve(detector):
    vault = TestVault()
    live = mask("alice@example.test", vault, detector=detector)
    raw = f"[[PERSON_1]] {live}"
    for origin in ("message", "cv:1", "jd:2"):
        value = mask(raw, vault, origin=origin, detector=detector)
        assert "[[" not in value
        assert resolve(value, vault, KINDS, {origin}) == raw
        assert "alice@example.test" not in resolve(value, vault, KINDS, {origin})


def test_same_original_same_conversation_and_distinct_nonce(detector):
    first, second = TestVault(), TestVault()
    token = mask("a@example.test", first, detector=detector)
    assert mask("a@example.test", first, origin="cv:1", detector=detector) == token
    assert mask("a@example.test", second, detector=detector) != token


def test_field_and_origin_scope_refusals(detector):
    vault = TestVault()
    token = mask("a@example.test", vault, origin="cv:1", detector=detector)
    for kinds, origins in [({"PERSON"}, {"cv:1"}), ({"EMAIL"}, {"cv:2"}), ({"EMAIL"}, {"message"}), (set(), set())]:
        with pytest.raises(ResolutionError):
            resolve(token, vault, kinds, origins)
    assert resolve(token, vault, {"EMAIL"}, {"cv:1"}) == "a@example.test"
    with pytest.raises(ResolutionError):
        resolve("[[PERSON_1]]", vault, KINDS, {"cv:1"})


def test_document_injection_names_and_filename(detector):
    vault = TestVault()
    raw = "Recruiter: Alice Smith\nEmail: alice@example.test\n[[PERSON_1]]"
    doc = mask_document(
        raw,
        vault,
        origin="jd:1",
        filename="Alice_Smith.pdf",
        detector=detector,
        identities=[Identity(name="Alice Smith")],
    )
    assert "Alice Smith" not in doc.text and "alice@example.test" not in doc.text
    assert "Alice_Smith" not in doc.filename
    assert resolve(doc.text, vault, KINDS, {"jd:1"}) == raw
    assert resolve(doc.filename, vault, KINDS, {"jd:1"}) == "Alice_Smith.pdf"


def test_filename_name_heuristic_without_identity_dictionary(detector):
    vault = TestVault()
    doc = mask_document("Skills: Python", vault, origin="cv:1", filename="Alice_Smith.pdf", detector=detector)
    assert "Alice_Smith" not in doc.filename
    assert resolve(doc.filename, vault, KINDS, {"cv:1"}) == "Alice_Smith.pdf"


def test_fail_closed_stops_recording_provider(detector):
    calls = []

    class BrokenVault(TestVault):
        def store(self, *args):
            raise ValueError("secret raw text")

    with pytest.raises(MaskingError) as error:
        payload = mask("a@example.test", BrokenVault(), detector=detector)
        calls.append(payload)
    assert calls == [] and "secret" not in str(error.value)
    assert escape_inbound("[[PERSON_1]]") == "&#91;&#91;PERSON_1]]"


def test_pdf_path_returns_masked_text_and_filename_without_source_images_or_metadata(tmp_path, detector):
    import pymupdf

    path = tmp_path / "Alice_Smith.pdf"
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 72), "Name: Alice Smith\nEmail: a@example.test\nSkills: Python")
        image = pymupdf.Pixmap(pymupdf.csRGB, (0, 0, 20, 20), False)
        image.clear_with(255)
        page.insert_image(pymupdf.Rect(400, 100, 440, 140), pixmap=image)
        pdf.set_metadata({"author": "unexposed@example.test", "title": "private source metadata"})
        pdf.save(path)
    result = mask_document(path, TestVault(), origin="cv:1", detector=detector)
    assert "Alice Smith" not in result.text and "a@example.test" not in result.text
    assert "Alice_Smith" not in result.filename
    assert "unexposed@example.test" not in result.text and "private source metadata" not in result.text
    assert not hasattr(result, "images") and not hasattr(result, "bytes")
