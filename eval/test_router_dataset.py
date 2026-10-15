"""Router data contract: no model, provider, app startup or production database."""

import hashlib
import json
from collections import Counter
from pathlib import Path

import pytest
from pydantic import ValidationError

from eval.router.dataset import ROOT, ROUTES, RouterRow, fold, inventory, load_contexts, load_rows, verify_heldout
from eval.router.seed import build_seed, write_seed

# Update only in a reviewed benchmark-version PR; changing the manifest alone
# must not make a modified benchmark pass. Real additions also version this pin.
FROZEN_HELDOUT_SHA256 = "d4fa196f50cc51dedaa28cb32acabb42d0bdc84109133e57daf696382a6efaa6"
FROZEN_CONTEXT_SHA256 = "56310912494fb8fb28b63522485aaf486430f350ebe698384aa581e1f6bbe97d"


def all_splits() -> dict[str, list[RouterRow]]:
    return {split: load_rows(ROOT / f"{split}.jsonl") for split in ("train", "dev", "heldout")}


def test_every_row_and_template_match_strict_schema() -> None:
    splits = all_splits()
    template = load_rows(ROOT / "real_template.jsonl")
    assert all("template" in row.tags for row in template)
    assert not any("template" in row.tags for rows in splits.values() for row in rows)
    for rows in splits.values():
        for row in rows:
            assert ("synthetic" in row.tags) != ("real" in row.tags)
            if row.slots and "followup" not in row.tags:
                # Raw qualifiers are actual text spans, not parsed or hallucinated.
                assert all(
                    value in row.text
                    for key, value in row.slots.model_dump().items()
                    if key != "target" and isinstance(value, str)
                )


def test_sizes_and_joint_route_language_stratification() -> None:
    synthetic_total = 0
    for split, rows in all_splits().items():
        synthetic = [row for row in rows if "synthetic" in row.tags]
        cells = Counter((row.label, row.language) for row in synthetic)
        per_cell = 12 if split == "train" else 4
        assert set(cells) == {(route, lang) for route in ROUTES for lang in ("vi", "en", "mixed")}
        assert set(cells.values()) == {per_cell}
        assert len(synthetic) == per_cell * 21
        synthetic_total += len(synthetic)
        if split != "heldout":
            assert all("real" not in row.tags and "followup" not in row.tags for row in rows)
    assert synthetic_total == 420


def test_ids_and_folded_text_do_not_leak_across_splits() -> None:
    seen_ids: set[str] = set()
    seen_text: dict[str, str] = {}
    for split, rows in all_splits().items():
        for row in rows:
            assert row.id not in seen_ids
            seen_ids.add(row.id)
            key = fold(row.text)
            assert key not in seen_text, f"Duplicate text in {split} and {seen_text.get(key)}: {row.id}"
            seen_text[key] = split


def test_required_coverage_and_role_boundaries() -> None:
    splits = all_splits()
    rows = [row for values in splits.values() for row in values]
    counts = inventory(rows)["subsets"]
    for key, minimum in {
        "result": 60,
        "navigate_with_slots": 60,
        "no_diacritics": 40,
        "adversarial": 30,
        "ambiguous": 30,
        "followup": 18,
    }.items():
        assert counts[key] >= minimum
    assert {row.deny_reason for row in rows if row.label == "deny"} == {
        "off_topic",
        "unsafe",
        "injection",
        "out_of_role",
    }
    for split, values in splits.items():
        assert any("typo" in row.tags for row in values), split
        assert any(row.role == "advisor" for row in values), split
        assert {row.deny_reason for row in values if row.label == "deny"} >= {"unsafe", "injection"}
    assert all(row.role == "student" for row in rows if row.label == "result")
    assert all(row.slots.target == "page" for row in rows if row.label == "navigate" and row.role == "advisor")
    for language in ("vi", "en", "mixed"):
        result_tags = {tag for row in rows if row.label == "result" and row.language == language for tag in row.tags}
        assert result_tags >= {
            "result_" + kind for kind in ("score", "status", "counts", "missing_skills", "interview_went", "comparison")
        }
        navs = [row for row in rows if row.label == "navigate" and row.language == language]
        assert any(row.slots.when_expr for row in navs)
        assert any(row.slots.jd_ref for row in navs)
        assert any(row.slots.cv_ref for row in navs)
        assert any(row.slots.latest for row in navs)
        assert any(row.slots.target == "page" for row in navs)


def test_followups_are_complete_heldout_only_context_fixtures() -> None:
    splits = all_splits()
    followups = {row.id: row for row in splits["heldout"] if "followup" in row.tags}
    contexts = load_contexts()
    assert set(contexts) == set(followups)
    assert sum("synthetic" in row.tags for row in followups.values()) == 18
    assert {len(value.previous_targets) for value in contexts.values()} >= {0, 1, 2}
    for key, row in followups.items():
        if row.label == "navigate":
            assert len(contexts[key].previous_targets) == 1
        else:
            assert row.label == "clarify"
    assert hashlib.sha256((ROOT / "followup_contexts.json").read_bytes()).hexdigest() == FROZEN_CONTEXT_SHA256


def test_frozen_heldout_hash() -> None:
    assert verify_heldout() == FROZEN_HELDOUT_SHA256


def test_integrity_check_detects_mutation(tmp_path: Path) -> None:
    (tmp_path / "heldout.jsonl").write_bytes((ROOT / "heldout.jsonl").read_bytes() + b"\n")
    (tmp_path / "heldout.sha256").write_bytes((ROOT / "heldout.sha256").read_bytes())
    with pytest.raises(ValueError, match="hash mismatch"):
        verify_heldout(tmp_path)


def test_seed_is_reproducible_and_refuses_overwrite(tmp_path: Path) -> None:
    write_seed(tmp_path)
    for name in ("train.jsonl", "dev.jsonl"):
        assert (tmp_path / name).read_bytes() == (ROOT / name).read_bytes()
    # Real-data PRs append only heldout. The authored synthetic benchmark and
    # its contexts stay unchanged; reviewed real additions need not be seeded.
    heldout = load_rows(ROOT / "heldout.jsonl")
    assert [row for row in heldout if "synthetic" in row.tags] == load_rows(tmp_path / "heldout.jsonl")
    actual_contexts = load_contexts()
    assert {key: actual_contexts[key] for key in load_contexts(tmp_path)} == load_contexts(tmp_path)
    with pytest.raises(FileExistsError, match="overwrite"):
        write_seed(tmp_path)
    assert sum(len(rows) for rows in build_seed()[0].values()) == 420


@pytest.mark.parametrize(
    "change",
    [
        {"role": "root"},
        {"language": "fr"},
        {"label": "qa"},
        {"tags": []},
        {"tags": ["en", "vi"]},
        {"tags": ["vi", "vi"]},
        {"text": " "},
        {"id": "bad id"},
        {"extra": True},
        {"deny_reason": "unsafe"},
        {"slots": {"target": "cv"}},
        {"label": "navigate"},
        {"label": "result"},
        {"label": "deny"},
        {"language": "en", "tags": ["en", "no_diacritics"]},
        {"tags": ["vi", "synthetic", "real"]},
    ],
)
def test_invalid_annotations_rejected(change: dict[str, object]) -> None:
    row = dict(
        id="sample",
        text="Xin chào",
        role="student",
        page_route_id="student_home",
        label="smalltalk",
        language="vi",
        tags=["vi"],
    )
    row.update(change)
    with pytest.raises(ValidationError):
        RouterRow.model_validate(row)


@pytest.mark.parametrize("payload", ["", "{}\n", "not json\n", "\n"])
def test_loader_rejects_empty_or_malformed_files(tmp_path: Path, payload: str) -> None:
    path = tmp_path / "bad.jsonl"
    path.write_text(payload, encoding="utf-8")
    with pytest.raises(ValueError):
        load_rows(path)


def test_loader_rejects_duplicate_ids(tmp_path: Path) -> None:
    row = load_rows(ROOT / "train.jsonl")[0]
    path = tmp_path / "duplicates.jsonl"
    path.write_text((json.dumps(row.model_dump()) + "\n") * 2, encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate IDs"):
        load_rows(path)
