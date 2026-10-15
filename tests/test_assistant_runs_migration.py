from sqlalchemy import create_engine, inspect, text

import src.db.models  # noqa: F401
from src.db.database import Base
from src.db.migrations.assistant_runs import downgrade, upgrade


def test_run_migration_roundtrip_preserves_legacy_turns() -> None:
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE users (id VARCHAR(64) PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE assistant_conversations (id VARCHAR(64) PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE assistant_turns (id VARCHAR(64) PRIMARY KEY, assistant_message TEXT)"))
        conn.execute(text("INSERT INTO assistant_turns VALUES ('old', 'preserved')"))
    upgrade(engine)
    upgrade(engine)
    assert inspect(engine).has_table("assistant_runs")
    with engine.connect() as conn:
        assert tuple(conn.execute(text("SELECT * FROM assistant_turns")).one()) == ("old", "preserved", None, 0)
    downgrade(engine)
    downgrade(engine)
    assert not inspect(engine).has_table("assistant_runs")
    with engine.connect() as conn:
        assert tuple(conn.execute(text("SELECT * FROM assistant_turns")).one()) == ("old", "preserved")
    upgrade(engine)
    engine.dispose()


def test_fresh_database_can_downgrade_and_upgrade() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    upgrade(engine)
    downgrade(engine)
    upgrade(engine)
    assert inspect(engine).has_table("assistant_runs")
    engine.dispose()
