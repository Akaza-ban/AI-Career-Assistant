"""Slim runs. Root CLI: python -m src.db.migrations.assistant_runs [--downgrade].

Downgrade discards run metadata, keeping conversations, turns and their text.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def upgrade(engine: Engine) -> None:
    from src.db.models import AssistantRun

    AssistantRun.__table__.create(engine, checkfirst=True)
    if inspect(engine).has_table("assistant_turns"):
        columns = {column["name"] for column in inspect(engine).get_columns("assistant_turns")}
        with engine.begin() as connection:
            if "run_id" not in columns:
                connection.execute(
                    text("ALTER TABLE assistant_turns ADD COLUMN run_id VARCHAR(64)")
                )
            if "interrupted" not in columns:
                connection.execute(
                    text("ALTER TABLE assistant_turns ADD COLUMN interrupted BOOLEAN NOT NULL DEFAULT 0")
                )
            connection.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS uq_assistant_turn_run ON assistant_turns (run_id)")
            )


def downgrade(engine: Engine) -> None:
    from src.db.models import AssistantRun

    if inspect(engine).has_table("assistant_turns"):
        columns = {column["name"] for column in inspect(engine).get_columns("assistant_turns")}
        with engine.begin() as connection:
            connection.execute(text("DROP INDEX IF EXISTS uq_assistant_turn_run"))
            for name in ("run_id", "interrupted"):
                if name in columns:
                    connection.execute(text(f'ALTER TABLE assistant_turns DROP COLUMN "{name}"'))
    AssistantRun.__table__.drop(engine, checkfirst=True)


if __name__ == "__main__":
    import argparse

    from src.db.database import engine

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--downgrade", action="store_true")
    args = parser.parse_args()
    (downgrade if args.downgrade else upgrade)(engine)
