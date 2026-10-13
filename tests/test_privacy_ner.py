from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError

from src.config import Settings
from src.services.privacy import ner
from src.services.privacy.masker import mask
from src.services.privacy.types import MaskingError, NerUnavailableError, VaultError
from tests.test_privacy_detectors import EmptyNer
from tests.test_privacy_masker import TestVault


@pytest.fixture
def startup_model(monkeypatch):
    monkeypatch.setattr(ner, "_detector", None)
    calls = []

    def load(backend, **kwargs):
        calls.append(backend)
        return EmptyNer()

    monkeypatch.setattr(ner, "load_ner", load)
    return calls


def test_single_startup_load_even_with_concurrent_initialization(startup_model):
    settings = Settings(_env_file=None)
    with ThreadPoolExecutor(max_workers=4) as executor:
        models = list(executor.map(lambda _: ner.initialize_privacy(settings), range(8)))
    assert len(startup_model) == 1
    assert all(model is models[0] for model in models)
    assert ner.get_detector() is models[0]


def test_default_masker_cannot_lazy_download_or_use_an_uninitialized_model(startup_model):
    with pytest.raises(NerUnavailableError):
        mask("a@example.test", TestVault())
    assert startup_model == []
    ner.initialize_privacy(Settings(_env_file=None))
    assert "a@example.test" not in mask("a@example.test", TestVault())


def test_startup_failure_propagates_and_does_not_enable_provider_calls(startup_model, monkeypatch):
    def broken(*args, **kwargs):
        raise NerUnavailableError("Unavailable")

    monkeypatch.setattr(ner, "load_ner", broken)
    with pytest.raises(NerUnavailableError):
        ner.initialize_privacy(Settings(_env_file=None))
    with pytest.raises(NerUnavailableError):
        ner.get_detector()


def test_production_privacy_refusals_keep_existing_auth_settings_contract(startup_model):
    with pytest.raises(ValidationError, match="PII_MASKING_ENABLED"):
        Settings(_env_file=None, app_env="production", auth_secret_key="x" * 32, pii_masking_enabled=False)
    missing = Settings(_env_file=None, app_env="production", auth_secret_key="x" * 32)
    with pytest.raises(VaultError, match="PII_VAULT_KEY"):
        ner.initialize_privacy(missing)
    assert startup_model == []
    good = Settings(
        _env_file=None, app_env="production", auth_secret_key="x" * 32, pii_vault_key=Fernet.generate_key().decode()
    )
    ner.initialize_privacy(good)
    assert len(startup_model) == 1
    with pytest.raises(MaskingError):
        ner.initialize_privacy(Settings(_env_file=None, pii_masking_enabled=False))


def test_config_cannot_weaken_mandatory_masked_types():
    with pytest.raises(ValidationError, match="direct identifiers"):
        Settings(_env_file=None, pii_mask_entity_types=("EMAIL",))
    with pytest.raises(ValidationError, match="direct identifiers"):
        Settings(_env_file=None, pii_keep_entity_types=("PERSON",))


def test_unknown_backend_is_typed_and_sanitized():
    with pytest.raises(NerUnavailableError):
        ner.load_ner("unknown", settings=Settings(_env_file=None))


def test_underthesea_grouped_punctuation_offsets_and_line_boundaries():
    model = object.__new__(ner.UndertheseaNer)
    model._ner = lambda text: [
        (word, "N", "B-NP", label)
        for word, label in [("[ [", "O"), ("PERSON_1 ]", "O"), ("]", "O"), ("Alice Smith", "B-PER")]
    ]
    result = model.detect("[[PERSON_1]] Alice Smith")
    assert [(s.start, s.end, s.kind) for s in result] == [(13, 24, "PERSON")]
    entities = ner._entities("Alice\nSmith", [(0, 5, "B-FIRSTNAME"), (6, 11, "B-LASTNAME")])
    assert len(entities) == 2


@pytest.mark.asyncio
async def test_lifespan_ner_failure_prevents_database_and_provider_startup(monkeypatch):
    from src import main

    database = Mock()
    monkeypatch.setattr(main, "init_db", database)
    monkeypatch.setattr(main, "get_settings", lambda: Settings(_env_file=None))
    monkeypatch.setattr(ner, "initialize_privacy", Mock(side_effect=NerUnavailableError("Unavailable")))
    with pytest.raises(NerUnavailableError):
        async with main.lifespan(main.app):
            pytest.fail("Startup should not yield after NER failure")
    database.assert_not_called()


def test_phobert_processes_document_tail_in_overlapping_cpu_windows():
    import torch

    class Tokenizer:
        bos_token_id, eos_token_id, unk_token = 0, 0, "<unk>"

        def tokenize(self, word):
            return [word]

        def convert_tokens_to_ids(self, words):
            return [{"Alice": 2, "Smith": 3}.get(word, 1) for word in words]

    calls = []

    class Model:
        config = SimpleNamespace(id2label={0: "O", 1: "B-PER", 2: "I-PER"})

        def __call__(self, input_ids, attention_mask):
            assert input_ids.device.type == "cpu"
            calls.append(input_ids.shape[1])
            labels = torch.where(input_ids == 2, 1, torch.where(input_ids == 3, 2, 0))
            logits = torch.full((*input_ids.shape, 3), -10.0)
            logits.scatter_(2, labels.unsqueeze(-1), 10.0)
            return SimpleNamespace(logits=logits)

    model = object.__new__(ner.PhoBertNer)
    model._torch, model._tokenizer, model._model, model._limit = torch, Tokenizer(), Model(), 254
    text = " ".join([f"word{index}" for index in range(600)] + ["Alice", "Smith"])
    spans = model.detect(text)
    assert [text[s.start : s.end] for s in spans] == ["Alice Smith"]
    assert len(calls) >= 3 and max(calls) <= 256
