from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import String, Text, Enum as SQLEnum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin

if TYPE_CHECKING:
    from app.models.bengkel import TransaksiPenjualanBengkel
    from app.models.mobil import TransaksiPenjualanMobil
    from app.models.keuangan import PiutangUsaha


class CustomerType:
    """Customer type constants."""
    PERORANGAN = "perorangan"
    PERUSAHAAN = "perusahaan"


class Customer(Base, TimestampMixin, SoftDeleteMixin):
    """Customer model for all business units."""

    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)
    tipe: Mapped[str] = mapped_column(
        String(20),
        default=CustomerType.PERORANGAN,
    )
    alamat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kota: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    telepon: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    npwp: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    saldo: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0,
        server_default="0",
    )
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    transaksi_bengkel: Mapped[List["TransaksiPenjualanBengkel"]] = relationship(
        back_populates="customer",
        lazy="dynamic",
    )
    transaksi_mobil: Mapped[List["TransaksiPenjualanMobil"]] = relationship(
        back_populates="customer",
        lazy="dynamic",
    )
    piutang: Mapped[List["PiutangUsaha"]] = relationship(
        back_populates="customer",
        lazy="dynamic",
    )
    vehicles: Mapped[List["CustomerVehicle"]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Customer(id={self.id}, kode='{self.kode}', nama='{self.nama}')>"


class CustomerVehicle(Base, TimestampMixin):
    """Vehicle model owned by a customer."""

    __tablename__ = "customer_vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE")
    )
    plat_nomor: Mapped[str] = mapped_column(String(15), index=True)
    jenis_unit: Mapped[str] = mapped_column(String(50))  # e.g., Avanza, Fuso, etc.
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship(back_populates="vehicles")

    def __repr__(self) -> str:
        return f"<CustomerVehicle(id={self.id}, plat='{self.plat_nomor}', jenis='{self.jenis_unit}')>"
