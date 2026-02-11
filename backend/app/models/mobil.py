from datetime import date
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    Date,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin
from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod

if TYPE_CHECKING:
    from app.models.customer import Customer


class Mobil(Base, TimestampMixin, SoftDeleteMixin):
    """Car inventory model."""

    __tablename__ = "mobil"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    merek: Mapped[str] = mapped_column(String(50), index=True)
    model: Mapped[str] = mapped_column(String(50))
    tahun: Mapped[int] = mapped_column(Integer)
    warna: Mapped[str] = mapped_column(String(30))
    nomor_plat: Mapped[str] = mapped_column(String(15), index=True)
    nomor_rangka: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nomor_mesin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    transmisi: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bahan_bakar: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    kilometer: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Pricing
    harga_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    harga_jual: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)

    # Ownership
    tipe_kepemilikan: Mapped[OwnershipType] = mapped_column(
        SQLEnum(OwnershipType),
        default=OwnershipType.TPM,
    )
    nama_investor: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    persentase_investor: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=0,
    )  # 0-100%
    nominal_investor: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0,
    )

    # Status
    status: Mapped[CarStatus] = mapped_column(
        SQLEnum(CarStatus),
        default=CarStatus.TERSEDIA,
    )
    tanggal_masuk: Mapped[date] = mapped_column(Date)
    tanggal_terjual: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    media: Mapped[List["MobilMedia"]] = relationship(
        back_populates="mobil",
        cascade="all, delete-orphan",
    )
    biaya_lainnya: Mapped[List["MobilBiayaLainnya"]] = relationship(
        back_populates="mobil",
        cascade="all, delete-orphan",
    )
    part_services: Mapped[List["MobilPartService"]] = relationship(
        back_populates="mobil",
        cascade="all, delete-orphan",
    )
    transaksi_penjualan: Mapped[Optional["TransaksiPenjualanMobil"]] = relationship(
        back_populates="mobil",
        uselist=False,
    )

    @property
    def total_biaya(self) -> Decimal:
        """Calculate total additional costs."""
        return sum(b.jumlah for b in self.biaya_lainnya) if self.biaya_lainnya else Decimal(0)

    @property
    def total_part_service(self) -> Decimal:
        """Calculate total part/service costs."""
        return sum(p.total for p in self.part_services) if self.part_services else Decimal(0)

    @property
    def total_modal(self) -> Decimal:
        """Calculate total capital (purchase + costs + part/services)."""
        return self.harga_beli + self.total_biaya + self.total_part_service

    def __repr__(self) -> str:
        return f"<Mobil(id={self.id}, kode='{self.kode}', plat='{self.nomor_plat}', status='{self.status}')>"


class MobilMedia(Base, TimestampMixin):
    """Car media model (photos/videos)."""

    __tablename__ = "mobil_media"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mobil_id: Mapped[int] = mapped_column(
        ForeignKey("mobil.id", ondelete="CASCADE")
    )
    file_path: Mapped[str] = mapped_column(String(255))
    file_name: Mapped[str] = mapped_column(String(100))
    file_type: Mapped[str] = mapped_column(String(20), default="image") # image, video
    is_primary: Mapped[bool] = mapped_column(default=False)
    urutan: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    mobil: Mapped["Mobil"] = relationship(back_populates="media")


class MobilBiayaLainnya(Base, TimestampMixin):
    """Additional car costs model (registration, insurance, etc.)."""

    __tablename__ = "mobil_biaya_lainnya"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mobil_id: Mapped[int] = mapped_column(
        ForeignKey("mobil.id", ondelete="CASCADE")
    )
    tanggal: Mapped[date] = mapped_column(Date)
    kategori: Mapped[str] = mapped_column(String(50))  # BBN, pajak, asuransi, dll
    deskripsi: Mapped[str] = mapped_column(String(255))
    jumlah: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    mobil: Mapped["Mobil"] = relationship(back_populates="biaya_lainnya")


class MobilPartService(Base, TimestampMixin):
    """Car part/service costs model (repair, maintenance linked to car)."""

    __tablename__ = "mobil_part_service"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mobil_id: Mapped[int] = mapped_column(
        ForeignKey("mobil.id", ondelete="CASCADE")
    )
    tanggal: Mapped[date] = mapped_column(Date)
    tipe: Mapped[str] = mapped_column(String(20))  # 'part' or 'service'
    deskripsi: Mapped[str] = mapped_column(String(255))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    harga_satuan: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    mobil: Mapped["Mobil"] = relationship(back_populates="part_services")


class TransaksiPenjualanMobil(Base, TimestampMixin):
    """Car sales transaction model."""

    __tablename__ = "transaksi_penjualan_mobil"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    mobil_id: Mapped[int] = mapped_column(ForeignKey("mobil.id"), unique=True)
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.id"),
        nullable=True,
    )
    nama_pembeli: Mapped[str] = mapped_column(String(100))
    telepon_pembeli: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    alamat_pembeli: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Pricing
    harga_jual: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    total_modal: Mapped[Decimal] = mapped_column(Numeric(15, 2))  # Calculated from mobil
    laba_kotor: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Profit split (for investor cars)
    tipe_kepemilikan: Mapped[OwnershipType] = mapped_column(SQLEnum(OwnershipType))
    persentase_investor: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    laba_investor: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    laba_tpm: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Payment
    status_bayar: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.LUNAS,
    )
    metode_bayar: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod),
        default=PaymentMethod.TUNAI,
    )
    dp: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sisa_bayar: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    mobil: Mapped["Mobil"] = relationship(back_populates="transaksi_penjualan")
    customer: Mapped[Optional["Customer"]] = relationship(
        back_populates="transaksi_mobil"
    )

    def __repr__(self) -> str:
        return f"<TransaksiMobil(id={self.id}, nomor='{self.nomor_transaksi}', harga={self.harga_jual})>"
