from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.bengkel import PembelianSparePart


class Supplier(Base, TimestampMixin, SoftDeleteMixin):
    """Supplier model for spare parts vendors."""

    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)
    alamat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kota: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    telepon: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    npwp: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bank: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    rekening: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    pembelian: Mapped[List["PembelianSparePart"]] = relationship(
        back_populates="supplier",
        lazy="dynamic",
    )

    def __repr__(self) -> str:
        return f"<Supplier(id={self.id}, kode='{self.kode}', nama='{self.nama}')>"
