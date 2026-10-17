from sqlalchemy import create_engine, inspect, text

from src.db.migrations.pii_vault import downgrade, upgrade


def test_upgrade_idempotent_preserves_legacy_conversation_and_downgrade():
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE assistant_conversations (id VARCHAR(64) PRIMARY KEY, title TEXT)"))
        conn.execute(text("INSERT INTO assistant_conversations VALUES ('conversation', 'existing')"))
    upgrade(engine)
    upgrade(engine)
    assert {c["name"] for c in inspect(engine).get_columns("pii_vault")} == {
        "conversation_id",
        "placeholder",
        "kind",
        "origin",
        "ciphertext",
        "created_at",
    }
    with engine.begin() as conn:
        assert conn.execute(text("SELECT title, pii_nonce FROM assistant_conversations")).one() == ("existing", None)
        for origin in ("cv:1", "message"):
            conn.execute(
                text(
                    "INSERT INTO pii_vault VALUES ('conversation', 'placeholder', 'PERSON', :origin, 'encrypted', CURRENT_TIMESTAMP)"
                ),
                {"origin": origin},
            )
        conn.execute(text("DELETE FROM assistant_conversations WHERE id='conversation'"))
        assert conn.execute(text("SELECT COUNT(*) FROM pii_vault")).scalar() == 0
    downgrade(engine)
    downgrade(engine)
    assert not inspect(engine).has_table("pii_vault")
    assert inspect(engine).has_table("assistant_conversations")
    assert "pii_nonce" not in {c["name"] for c in inspect(engine).get_columns("assistant_conversations")}
    upgrade(engine)
    assert inspect(engine).has_table("pii_vault")
