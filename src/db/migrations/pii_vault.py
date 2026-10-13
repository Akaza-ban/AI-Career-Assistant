"""T1.3 privacy storage. From root: python -m src.db.migrations.pii_vault.

The nullable conversation nonce persists the random conversation namespace across
workers, restarts and vault TTL cleanup. Downgrade destroys only privacy mappings
and nonce metadata; authorized application rollback must accept that data loss.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def upgrade(engine: Engine) -> None:
    from src.db.models import AssistantConversation
    from src.services.privacy.storage import VaultRecord

    AssistantConversation.__table__.create(engine, checkfirst=True)
    columns = {column["name"] for column in inspect(engine).get_columns("assistant_conversations")}
    with engine.begin() as connection:
        if "pii_nonce" not in columns:
            connection.execute(text("ALTER TABLE assistant_conversations ADD COLUMN pii_nonce VARCHAR(32)"))
    VaultRecord.__table__.create(engine, checkfirst=True)
    if engine.dialect.name == "sqlite":
        # The legacy engine does not enable foreign_keys. A trigger enforces
        # conversation cleanup also for raw/bulk DELETE without changing it.
        with engine.begin() as connection:
            connection.execute(
                text(
                    "CREATE TRIGGER IF NOT EXISTS pii_vault_conversation_delete "
                    "AFTER DELETE ON assistant_conversations BEGIN "
                    "DELETE FROM pii_vault WHERE conversation_id = OLD.id; END"
                )
            )


def downgrade(engine: Engine) -> None:
    from src.services.privacy.storage import VaultRecord

    with engine.begin() as connection:
        if engine.dialect.name == "sqlite":
            connection.execute(text("DROP TRIGGER IF EXISTS pii_vault_conversation_delete"))
    VaultRecord.__table__.drop(engine, checkfirst=True)
    if inspect(engine).has_table("assistant_conversations"):
        columns = {column["name"] for column in inspect(engine).get_columns("assistant_conversations")}
        if "pii_nonce" in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE assistant_conversations DROP COLUMN pii_nonce"))


if __name__ == "__main__":
    from src.db.database import engine

    upgrade(engine)
