from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class ShortLink(Base):
    """Kode pendek untuk halaman struk publik. Menyimpan tipe struk dan target (token atau id)."""

    __tablename__ = "short_links"
    __table_args__ = (UniqueConstraint("tipe", "target", name="uq_short_links_tipe_target"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    tipe: Mapped[str] = mapped_column(String(20))
    target: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
