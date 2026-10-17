import json
from dataclasses import replace

import pymupdf
import pytest

from eval.pii.dataset import load_real, load_synthetic, parse_sample
from eval.pii.run import (
    MAX_KEEP_FALSE_POSITIVE_RATE,
    TARGET_PRECISION,
    TARGET_RECALL,
    _boundaries,
    _mapped,
    gate_failures,
    measure,
    select_backend,
)
from src.services.privacy.detectors import Detector
from src.services.privacy.types import Span
from tests.test_privacy_detectors import EmptyNer


def test_synthetic_dataset_counts_annotations_languages_and_actual_scan_formats():
    samples = load_synthetic()
    cvs = [sample for sample in samples if sample.category == "cv"]
    assert len(cvs) >= 60
    assert {sample.language for sample in cvs} == {"vi", "en", "mixed"}
    assert {sample.format for sample in cvs} == {"text_pdf", "scan_pdf"}
    assert all(sample.review_status == "needs_human_review" for sample in samples)
    assert {sample.category for sample in samples} >= {"cv", "jd", "tool_error", "advisor"}
    assert all(sample.filename_entities for sample in cvs)
    assert all(sum(entity.kind == "PERSON" for entity in sample.entities) >= 2 for sample in cvs)
    for sample in cvs:
        with pymupdf.open(sample.document) as pdf:
            assert len(pdf) == 1
            if sample.format == "scan_pdf":
                assert pdf[0].get_text().strip() == "" and pdf[0].get_images()
            else:
                assert "example.test" in pdf[0].get_text()


def test_real_loader_empty_warning_and_review_requirement(tmp_path):
    with pytest.warns(UserWarning, match="empty"):
        assert load_real(tmp_path) == []
    value = {
        "id": "heldout1",
        "language": "vi",
        "category": "cv",
        "format": "text",
        "review_status": "needs_human_review",
        "text": "",
        "entities": [],
    }
    (tmp_path / "one.json").write_text(json.dumps(value), encoding="utf-8")
    with pytest.raises(ValueError, match="human_reviewed"):
        load_real(tmp_path)
    value["review_status"] = "human_reviewed"
    (tmp_path / "one.json").write_text(json.dumps(value), encoding="utf-8")
    assert len(load_real(tmp_path)) == 1


def test_annotation_offsets_and_paths_are_validated(tmp_path):
    value = {
        "id": "draft",
        "language": "en",
        "category": "cv",
        "format": "text",
        "review_status": "needs_human_review",
        "text": "Alice",
        "entities": [{"start": 0, "end": 5, "kind": "PERSON", "text": "Bob"}],
    }
    with pytest.raises(ValueError, match="mismatch"):
        parse_sample(value, tmp_path)
    value["entities"] = []
    value["document"] = "../escape.pdf"
    with pytest.raises(ValueError, match="outside"):
        parse_sample(value, tmp_path)


def test_strict_metrics_do_not_count_partial_name_as_full_recall():
    sample = replace(load_synthetic()[0], text="Alice Smith", entities=(Span(0, 11, "PERSON"),), filename="", keep=())

    class PartialNer:
        def detect(self, text):
            return [Span(0, 5, "PERSON")]

    result = measure([sample], Detector(PartialNer()), ner_only=True)
    assert result["entities"]["PERSON"]["recall"] == 0
    assert result["entities"]["PERSON"]["coverage_recall"] == 0
    assert result["entities"]["PERSON"]["precision"] == 0


def test_failed_document_is_counted_as_false_negatives_not_skipped():
    sample = load_synthetic()[0]
    result = measure([sample], Detector(EmptyNer()), documents={sample.id: None}, filenames=False)
    assert result["failed_inputs"] == [sample.id + ":text"]
    assert result["entities"]["EMAIL"]["gold"] == 2
    assert result["entities"]["EMAIL"]["fn"] == 2


def test_targets_are_fixed_and_failures_are_reported():
    assert TARGET_RECALL == {"EMAIL": 0.99, "PHONE": 0.99, "ID": 0.99, "PERSON": 0.92, "ADDRESS": 0.92}
    assert TARGET_PRECISION == 0.9 and MAX_KEEP_FALSE_POSITIVE_RATE == 0.03
    result = measure([load_synthetic()[0]], Detector(EmptyNer()))
    result["entities"]["EMAIL"]["recall"] = 0.98
    failures = gate_failures(result)
    assert "EMAIL recall below 0.99" in failures

    def candidate(recall):
        metrics = json.loads(json.dumps(result))
        for kind in ("PERSON", "ADDRESS"):
            metrics["entities"][kind]["tp"] = recall * metrics["entities"][kind]["gold"]
        return {"status": "measured", "ner_only": metrics, "pipeline_raw": result}

    assert (
        select_backend({"first": candidate(0.5), "second": candidate(0.8), "failed": {"status": "failed"}}) == "second"
    )


def test_ocr_inserted_linebreaks_do_not_inflate_gold_entity_spans():
    original = "Email: a@example.test\nPhone: 0905550123\n"
    observed = "Email: a@example.test\r\n\r\nPhone: 0905550123\r\n"
    mapping = _boundaries(original, observed)
    email = Span(original.index("a@"), original.index("\n"), "EMAIL")
    mapped = _mapped(email, mapping)
    assert observed[mapped.start : mapped.end] == "a@example.test"
