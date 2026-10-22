from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class PerbaikanDataLog(Base, TimestampMixin):
    """Riwayat aksi perbaikan data dari halaman Perbaikan Data (dashboard web)."""

    __tablename__ = "perbaikan_data_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jenis: Mapped[str] = mapped_column(String(40), index=True)
    nomor_referensi: Mapped[str] = mapped_column(String(50), index=True)
    ringkasan: Mapped[str] = mapped_column(String(255))
    sebelum: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sesudah: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
