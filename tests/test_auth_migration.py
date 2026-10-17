from sqlalchemy import create_engine, inspect, text

from src.db.migrations.auth import upgrade


def test_auth_upgrade_preserves_legacy_users_and_is_idempotent():
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id VARCHAR(64) PRIMARY KEY, email VARCHAR(255))"))
        connection.execute(text("INSERT INTO users VALUES ('legacy', 'legacy@example.test')"))
    upgrade(engine)
    upgrade(engine)
    assert inspect(engine).has_table("auth_sessions")
    with engine.connect() as connection:
        row = connection.execute(text("SELECT id, email, password_hash FROM users")).one()
        assert tuple(row) == ("legacy", "legacy@example.test", None)
    engine.dispose()
