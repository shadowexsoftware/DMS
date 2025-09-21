# config.py
from __future__ import annotations
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

# --- опционально: читать .env без лишних зависимостей ---
def load_dotenv_if_present(filename: str = ".env") -> None:
    p = Path(filename)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        # поддержка кавычек
        if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            v = v[1:-1]
        os.environ.setdefault(k, v)

load_dotenv_if_present()  # можно убрать, если .env загружается иначе

def load_env() -> None:
    """Совместимость со старым импортом в app.py."""
    load_dotenv_if_present()

# --- helpers ---
def env_str(key: str, default: str = "") -> str:
    return os.environ.get(key, default)

def env_bool(key: str, default: bool = False) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}

def env_int(key: str, default: int = 0) -> int:
    try:
        return int(os.environ.get(key, str(default)))
    except ValueError:
        return default

def env_list(key: str, default: Optional[List[str]] = None, sep: str = ",") -> List[str]:
    raw = os.environ.get(key)
    if not raw:
        return default or []
    return [x.strip() for x in raw.split(sep) if x.strip()]


# --- базовая конфигурация ---
@dataclass
class BaseConfig:
    # App
    APP_NAME: str = env_str("APP_NAME", "DMS Backend")
    APP_ENV: str = env_str("APP_ENV", "development")  # development|production|test
    DEBUG: bool = env_bool("DEBUG", True)
    LOG_LEVEL: str = env_str("LOG_LEVEL", "INFO")
    HOST: str = env_str("HOST", "127.0.0.1")
    PORT: int = env_int("PORT", 5015)
    REGISTRATION_OPEN: bool = env_bool("REGISTRATION_OPEN", True)
    # Paths
    OUT_DIR: str = env_str("OUT_DIR", "out")
    SNAPSHOT_DIR: str = env_str("SNAPSHOT_DIR", "out/snapshots")

    # DB (SQLAlchemy URL)
    DATABASE_URL: str = env_str("DATABASE_URL", "postgresql+psycopg://dms:dms@localhost:5432/dms_db")
    # Параметры движка (по желанию)
    SQLALCHEMY_ECHO: bool = env_bool("SQLALCHEMY_ECHO", False)
    SQLALCHEMY_POOL_SIZE: int = env_int("SQLALCHEMY_POOL_SIZE", 10)
    SQLALCHEMY_MAX_OVERFLOW: int = env_int("SQLALCHEMY_MAX_OVERFLOW", 20)

    # Auth / JWT
    JWT_SECRET: str = env_str("JWT_SECRET", "change_me_in_prod")
    JWT_ALG: str = env_str("JWT_ALG", "HS256")
    JWT_ACCESS_EXPIRES_MIN: int = env_int("JWT_ACCESS_EXPIRES_MIN", 60)     # 60 минут
    JWT_REFRESH_EXPIRES_DAYS: int = env_int("JWT_REFRESH_EXPIRES_DAYS", 30) # 30 дней

    # CORS
    CORS_ALLOW_ORIGINS: List[str] = field(default_factory=lambda: env_list("CORS_ALLOW_ORIGINS", ["http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000"]))
    CORS_ALLOW_CREDENTIALS: bool = env_bool("CORS_ALLOW_CREDENTIALS", True)

    # Бот (Playwright) — если нужен
    BOT_HEADLESS: bool = env_bool("BOT_HEADLESS", False)
    BOT_PROFILE_DIR: str = env_str("BOT_PROFILE_DIR", ".pw_profile")
    BOT_START_URL: str = env_str("BOT_START_URL")
    BOT_REPAIR_LIST_URL: str = env_str("BOT_REPAIR_LIST_URL")
    BOT_SSO_TOKEN: str = env_str("BOT_SSO_TOKEN", "")  # если есть

    # DMS API
    DMS_API_BASE: str = env_str("DMS_API_BASE")

@dataclass
class DevConfig(BaseConfig):
    DEBUG: bool = True
    LOG_LEVEL: str = "DEBUG"

@dataclass
class ProdConfig(BaseConfig):
    DEBUG: bool = False
    LOG_LEVEL: str = env_str("LOG_LEVEL", "INFO")

@dataclass
class TestConfig(BaseConfig):
    DEBUG: bool = True
    DATABASE_URL: str = env_str("TEST_DATABASE_URL", "postgresql+psycopg://dms_test:dms_test@localhost:5432/dms_test")
    LOG_LEVEL: str = "WARNING"


# --- выбор профиля ---
def load_config() -> BaseConfig:
    env = os.environ.get("APP_ENV", "development").lower()
    if env.startswith("prod"):
        return ProdConfig()
    if env.startswith("test"):
        return TestConfig()
    return DevConfig()

settings: BaseConfig = load_config()


# --- помощник для Flask ---
def apply_flask_config(app, cfg: BaseConfig = settings) -> None:
    """
    Применяет настройки к Flask-приложению и создаёт необходимые директории.
    """
    app.config["REGISTRATION_OPEN"] = cfg.REGISTRATION_OPEN
    app.config["APP_NAME"] = cfg.APP_NAME
    app.config["ENV"] = cfg.APP_ENV
    app.config["DEBUG"] = cfg.DEBUG

    # каталоги
    app.config["OUT_DIR"] = cfg.OUT_DIR
    app.config["SNAPSHOT_DIR"] = cfg.SNAPSHOT_DIR
    Path(cfg.OUT_DIR).mkdir(parents=True, exist_ok=True)
    Path(cfg.SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)

    # DB (если используешь flask_sqlalchemy)
    app.config["SQLALCHEMY_DATABASE_URI"] = cfg.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SQLALCHEMY_ECHO"] = cfg.SQLALCHEMY_ECHO
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_size": cfg.SQLALCHEMY_POOL_SIZE,
        "max_overflow": cfg.SQLALCHEMY_MAX_OVERFLOW,
    }

    # JWT
    app.config["JWT_SECRET"] = cfg.JWT_SECRET
    app.config["JWT_ALG"] = cfg.JWT_ALG
    app.config["JWT_ACCESS_EXPIRES_MIN"] = cfg.JWT_ACCESS_EXPIRES_MIN
    app.config["JWT_REFRESH_EXPIRES_DAYS"] = cfg.JWT_REFRESH_EXPIRES_DAYS

    # CORS
    app.config["CORS_ALLOW_ORIGINS"] = cfg.CORS_ALLOW_ORIGINS
    app.config["CORS_ALLOW_CREDENTIALS"] = cfg.CORS_ALLOW_CREDENTIALS

    # BOT
    app.config["BOT_HEADLESS"] = cfg.BOT_HEADLESS
    app.config["BOT_PROFILE_DIR"] = cfg.BOT_PROFILE_DIR
    app.config["BOT_START_URL"] = cfg.BOT_START_URL
    app.config["BOT_REPAIR_LIST_URL"] = cfg.BOT_REPAIR_LIST_URL
    app.config["BOT_SSO_TOKEN"] = cfg.BOT_SSO_TOKEN

    # DMS API
    app.config["DMS_API_BASE"] = cfg.DMS_API_BASE
