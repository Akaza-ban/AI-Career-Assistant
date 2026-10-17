"""T1.2 upgrade. Run from root: python -m src.db.migrations.auth.

Downgrade is deliberately unsupported: removing credentials/sessions would re-enable
the insecure legacy identity flow if paired with old code. Restore a pre-upgrade
database backup only as part of an explicitly authorized full application rollback.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def upgrade(engine: Engine) -> None:
    """Preserve existing users and provision only authentication storage."""
    from src.db.models import AuthSession

    inspector = inspect(engine)
    if inspector.has_table("users"):
        columns = {column["name"] for column in inspector.get_columns("users")}
        if "password_hash" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))
    AuthSession.__table__.create(engine, checkfirst=True)


if __name__ == "__main__":
    from src.db.database import engine

    upgrade(engine)
