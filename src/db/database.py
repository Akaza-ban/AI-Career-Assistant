from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from src.config import get_settings


class Base(DeclarativeBase):
    """Lớp cơ sở cho mọi bảng ORM."""


def _create_engine(database_url: str):
    url = make_url(database_url)
    connect_args = {}
    if url.get_backend_name() == "sqlite":
        # FastAPI chạy dependency đồng bộ trong threadpool nên cần cho phép dùng kết nối khác thread.
        connect_args["check_same_thread"] = False
        if url.database and url.database != ":memory:":
            Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(database_url, connect_args=connect_args)


engine = _create_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: mở một session cho mỗi request và đóng khi xong."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _add_missing_columns() -> None:
    """Thêm cột mới vào bảng đã có (create_all chỉ tạo bảng mới). Chỉ dùng cho cột cho phép NULL."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing:
                    column_type = column.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'))


def init_db() -> None:
    """Tạo bảng / cột còn thiếu và nạp dữ liệu demo (idempotent, gọi khi khởi động app).

    Chưa dùng migration: cột mới được thêm tự động; đổi kiểu hoặc xoá cột thì xoá file data/app.db để tạo lại.
    """
    from src.db import models  # noqa: F401  (đăng ký các bảng vào Base.metadata)
    from src.db.demo_cohort import seed_demo_cohort
    from src.db.migrations.auth import upgrade as upgrade_auth
    from src.db.migrations.pii_vault import upgrade as upgrade_pii_vault
    from src.db.seed import fail_interrupted_analyses, seed_demo_users, seed_jd_library
    from src.services.cv_versions import backfill as backfill_cv_versions

    Base.metadata.create_all(bind=engine)
    upgrade_auth(engine)
    upgrade_pii_vault(engine)
    _add_missing_columns()
    with SessionLocal() as db:
        seed_demo_users(db)
        seed_jd_library(db)
        if get_settings().app_env != "production" and get_settings().seed_demo_cohort:
            seed_demo_cohort(db)
        fail_interrupted_analyses(db)
        # Phiên bản CV tạo trước khi có lịch sử phiên bản theo từng CV
        backfill_cv_versions(db)
