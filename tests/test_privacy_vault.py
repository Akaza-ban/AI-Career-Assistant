from datetime import datetime, timedelta

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from src.config import Settings
from src.db.migrations.pii_vault import upgrade
from src.db.models import AssistantConversation
from src.services.privacy.detectors import Detector
from src.services.privacy.masker import mask, resolve
from src.services.privacy.storage import VaultRecord
from src.services.privacy.types import KINDS, ResolutionError, VaultError
from src.services.privacy.vault import PiiVault
from tests.test_privacy_detectors import EmptyNer


@pytest.fixture
def vault_setup():
    engine = create_engine("sqlite://")
    upgrade(engine)
    with Session(engine, expire_on_commit=False) as db:
        db.add_all([AssistantConversation(id="first"), AssistantConversation(id="second")])
        db.commit()
        settings = Settings(_env_file=None, pii_vault_key=Fernet.generate_key().decode(), pii_vault_ttl_hours=1)
        now = [datetime(2026, 10, 13, 12)]
        vault = PiiVault(db, "first", settings=settings, clock=lambda: now[0])
        yield db, vault, settings, now


def test_encrypted_round_trip_scope_and_multiple_origins(vault_setup):
    db, vault, settings, now = vault_setup
    original = "a@example.test"
    token = vault.store(original, "EMAIL", "cv:1")
    assert vault.store(original, "EMAIL", "message") == token
    assert len(list(db.scalars(select(VaultRecord)))) == 2
    row = db.scalar(select(VaultRecord))
    assert original not in row.ciphertext
    assert resolve(token, vault, {"EMAIL"}, {"cv:1"}) == original
    assert resolve(token, vault, {"EMAIL"}, {"message"}) == original
    for kinds, origins in [({"PERSON"}, {"cv:1"}), ({"EMAIL"}, {"cv:2"}), ({"EMAIL"}, {"jd:1"}), (KINDS, set())]:
        with pytest.raises(ResolutionError):
            resolve(token, vault, kinds, origins)
    second = PiiVault(db, "second", settings=settings, clock=lambda: now[0])
    with pytest.raises(ResolutionError):
        resolve(token, second, KINDS, {"cv:1"})
    assert second.store(original, "EMAIL", "cv:1") != token
    db.commit()
    restarted = PiiVault(db, "first", settings=settings, clock=lambda: now[0])
    assert restarted.store(original, "EMAIL", "cv:1") == token


def test_ttl_is_enforced_at_boundary_and_does_not_refresh_on_read_or_dedup(vault_setup):
    db, vault, _, now = vault_setup
    token = vault.store("Alice Smith", "PERSON", "message")
    now[0] += timedelta(minutes=59)
    assert vault.store("Alice Smith", "PERSON", "message") == token
    assert resolve(token, vault, KINDS, {"message"}) == "Alice Smith"
    now[0] += timedelta(minutes=1)
    with pytest.raises(ResolutionError):
        resolve(token, vault, KINDS, {"message"})
    assert vault.purge_expired() == 1
    assert db.scalar(select(VaultRecord)) is None


def test_delete_explicit_and_conversation_cascade(vault_setup):
    db, vault, _, _ = vault_setup
    vault.store("Alice Smith", "PERSON", "cv:1")
    assert vault.delete_by_conversation() == 1
    assert vault.delete_by_conversation() == 0
    vault.store("Alice Smith", "PERSON", "cv:1")
    db.execute(text("DELETE FROM assistant_conversations WHERE id='first'"))
    assert db.scalar(select(VaultRecord)) is None
    with pytest.raises(VaultError):
        vault.store("Alice Smith", "PERSON", "cv:1")


def test_tamper_wrong_key_and_cross_origin_ciphertext_swap_fail_closed(vault_setup):
    db, vault, settings, now = vault_setup
    token = vault.store("Alice Smith", "PERSON", "cv:1")
    vault.store("Alice Smith", "PERSON", "jd:1")
    row = db.get(VaultRecord, ("first", token, "cv:1"))
    other = db.get(VaultRecord, ("first", token, "jd:1"))
    row.ciphertext = other.ciphertext
    with pytest.raises(VaultError):
        resolve(token, vault, KINDS, {"cv:1"})
    wrong = settings.model_copy(
        update={"pii_vault_key": Settings(_env_file=None, pii_vault_key=Fernet.generate_key().decode()).pii_vault_key}
    )
    wrong_vault = PiiVault(db, "first", settings=wrong, clock=lambda: now[0])
    with pytest.raises(VaultError):
        resolve(token, wrong_vault, KINDS, {"jd:1"})
    with pytest.raises(VaultError):
        PiiVault(db, "first", settings=Settings(_env_file=None))


def test_real_vault_masking_injection_and_round_trip(vault_setup):
    _, vault, _, _ = vault_setup
    raw = "Name: Alice Smith; a@example.test; [[PERSON_1]] &amp;"
    masked = mask(raw, vault, detector=Detector(EmptyNer()))
    assert resolve(masked, vault, KINDS, {"message"}) == raw
    poison = mask(masked, vault, origin="cv:poison", detector=Detector(EmptyNer()))
    assert resolve(poison, vault, KINDS, {"cv:poison"}) == masked


def test_vault_cannot_commit_unrelated_business_work(vault_setup):
    db, vault, _, _ = vault_setup
    vault.store("Alice Smith", "PERSON", "message")
    db.rollback()
    assert db.scalar(select(VaultRecord)) is None
