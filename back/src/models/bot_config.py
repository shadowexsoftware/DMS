# src/models/bot_config.py
from sqlalchemy import Integer, Text, DateTime, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from . import Base  # та же Base, что и у BotStatus

class BotConfig(Base):
    __tablename__ = "bot_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # всегда = 1
    access_token_key: Mapped[str] = mapped_column(Text, nullable=False)
    id_token_key:     Mapped[str] = mapped_column(Text, nullable=False)

    # Сами «содержимое» токенов (как в localStorage/cookie)
    access_token_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_token_json:     Mapped[str | None] = mapped_column(Text, nullable=True)
    sso_token:         Mapped[str | None] = mapped_column(Text, nullable=True)

    updated_at: Mapped["DateTime"] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint("id = 1", name="bot_config_singleton"),
    )
