# src/models/__init__.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

from .user import User
from .snapshot import Snapshot
from .bot_status import BotStatus
from .bot_config import BotConfig