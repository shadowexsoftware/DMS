# src/models/bot_status.py
from sqlalchemy import Integer, Text, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from . import Base   # <-- было ..db, заменили на . (одна Base!)

class BotStatus(Base):
    __tablename__ = "bot_status"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    have_bearer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_note: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
