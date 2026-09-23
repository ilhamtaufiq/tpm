from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ClientLog(Base):
    """Persistent record of client-reported events (lag, bug, error)."""

    __tablename__ = "client_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[str] = mapped_column(String(20), default="ERROR", index=True)
    title: Mapped[str] = mapped_column(String(255), default="Client Event")
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    platform: Mapped[str] = mapped_column(String(20), default="android", index=True)
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    stack: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
