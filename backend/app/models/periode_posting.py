from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin

STATUS_TERBUKA = "TERBUKA"
STATUS_DIPOSTING = "DIPOSTING"


class PeriodePosting(Base, TimestampMixin):
    """Status posting bulanan laporan.

    Bulan tanpa baris dianggap TERBUKA. Bulan DIPOSTING terkunci untuk nota
    bengkel: nota bertanggal di bulan itu tidak boleh diubah/dibatalkan, dan
    penambahan item dialihkan menjadi nota tambahan di bulan terbuka.
    """

    __tablename__ = "periode_posting"
    __table_args__ = (UniqueConstraint("tahun", "bulan", name="uq_periode_posting_tahun_bulan"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tahun: Mapped[int] = mapped_column(Integer, index=True)
    bulan: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default=STATUS_TERBUKA)
    diposting_pada: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    diposting_oleh: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dibuka_pada: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    dibuka_oleh: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    alasan_buka: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
