import pytest
from pydantic import SecretStr
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from src.config import get_settings
from src.db.database import Base
from src.db.models import AdvisorAssignment, User
from src.db.seed import DEMO_ADVISOR_ID, DEMO_STUDENT_ID, DEV_PASSWORDS, SECOND_STUDENT_ID, seed_demo_users
from src.services.auth import hash_password, verify_password


@pytest.fixture
def seed_db(monkeypatch):
    for name in ("seed_student_a_password", "seed_student_b_password", "seed_advisor_password"):
        monkeypatch.setattr(get_settings(), name, SecretStr(""))
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_seed_creates_individual_credentials_and_assignments(seed_db):
    seed_demo_users(seed_db)
    users = list(seed_db.scalars(select(User)))
    assert len(users) == 3
    assert {user.role for user in users} == {"student", "advisor"}
    for user in users:
        assert verify_password(DEV_PASSWORDS[user.id], user.password_hash)
        assert user.password_hash != DEV_PASSWORDS[user.id]
    assignments = list(seed_db.scalars(select(AdvisorAssignment)))
    assert {assignment.student_id for assignment in assignments} == {DEMO_STUDENT_ID, SECOND_STUDENT_ID}
    assert all(assignment.advisor_id == DEMO_ADVISOR_ID for assignment in assignments)
    hashes = {user.id: user.password_hash for user in users}
    seed_demo_users(seed_db)
    assert {user.id: user.password_hash for user in seed_db.scalars(select(User))} == hashes


def test_seed_uses_config_override_and_preserves_existing_hash(seed_db, monkeypatch):
    monkeypatch.setattr(get_settings(), "seed_student_a_password", SecretStr("Override-dev-only!"))
    seed_demo_users(seed_db)
    user = seed_db.get(User, DEMO_STUDENT_ID)
    assert verify_password("Override-dev-only!", user.password_hash)
    preserved = hash_password("Existing-dev-only!")
    user.password_hash = preserved
    seed_db.commit()
    seed_demo_users(seed_db)
    assert user.password_hash == preserved


def test_production_never_seeds_known_credentials(seed_db, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    seed_demo_users(seed_db)
    assert list(seed_db.scalars(select(User))) == []
