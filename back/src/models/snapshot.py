# src/models/snapshot.py
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from . import Base   # <-- было ..db, заменили на . (одна Base!)

class Snapshot(Base):
    __tablename__ = "snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_rel: Mapped[str] = mapped_column(String(512), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    structure_key: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    created_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now())
