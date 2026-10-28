from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class PembatalanKeuangan(Base, TimestampMixin):
    """Riwayat pembatalan transaksi keuangan (jurnal dibalik, data asli tetap ada)."""

    __tablename__ = "pembatalan_keuangan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jenis: Mapped[str] = mapped_column(String(40), index=True)
    nomor_dokumen: Mapped[str] = mapped_column(String(50), index=True)
    dokumen_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    ringkasan: Mapped[str] = mapped_column(String(255))
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    alasan: Mapped[str] = mapped_column(Text)
    kas_nomor: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dibatalkan_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    dibatalkan_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
