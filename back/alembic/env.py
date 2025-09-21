# alembic/env.py
from __future__ import annotations
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy import create_engine  # для online режима

# --- ЛОГИ (из alembic.ini) ---
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- Импорт твоих моделей ---
# благодаря prepend_sys_path = . в alembic.ini, корень проекта уже в sys.path
from src.models import Base  # <- /models/__init__.py должен экспортировать Base и импортировать модели

target_metadata = Base.metadata


def _build_url_from_env() -> str:
    """Пытается взять DATABASE_URL, если нет — собирает из переменных."""
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "dms_db")
    user = os.getenv("DB_USER", "dms")
    pwd  = os.getenv("DB_PASSWORD", "dms")

    # SQLAlchemy 2.x: драйвер psycopg (не psycopg2)
    return f"postgresql+psycopg://{user}:{pwd}@{host}:{port}/{name}"


def run_migrations_offline() -> None:
    """Offline-режим: без реального подключения к БД."""
    url = _build_url_from_env()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Online-режим: реальное подключение к БД."""
    url = _build_url_from_env()
    connectable = create_engine(url, pool_pre_ping=True, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
