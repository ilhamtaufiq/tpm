from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING
import enum

from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin
from app.utils.constants import PaymentStatus, PaymentMethod, ExpenseCategory, WorkshopStatus

if TYPE_CHECKING:
    from app.models.supplier import Supplier
    from app.models.customer import Customer
    from app.models.jasa_angkut import MuatanJasaAngkut
    from app.models.mobil import Mobil


class SparePart(Base, TimestampMixin, SoftDeleteMixin):
    """Spare part inventory model."""

    __tablename__ = "spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(150), index=True)
    kode_part: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    kategori: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    merek: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    satuan: Mapped[str] = mapped_column(String(20), default="pcs")
    stok: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    stok_minimum: Mapped[int] = mapped_column(Integer, default=5)
    harga_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    harga_jual: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    lokasi_rak: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gambar: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    detail_pembelian: Mapped[List["DetailPembelianSparePart"]] = relationship(
        back_populates="spare_part",
        lazy="dynamic",
    )
    detail_transaksi: Mapped[List["DetailTransaksiSpareParts"]] = relationship(
        back_populates="spare_part",
        lazy="dynamic",
    )

    @property
    def is_low_stock(self) -> bool:
        """Check if stock is below minimum."""
        return self.stok <= self.stok_minimum

    def __repr__(self) -> str:
        return f"<SparePart(id={self.id}, kode='{self.kode}', nama='{self.nama}', stok={self.stok})>"


class JasaServis(Base, TimestampMixin, SoftDeleteMixin):
    """Workshop service master data model."""

    __tablename__ = "jasa_servis"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nama: Mapped[str] = mapped_column(String(150), index=True)
    kategori: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    harga: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    deskripsi: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<JasaServis(id={self.id}, nama='{self.nama}', harga={self.harga})>"


class PembelianSparePart(Base, TimestampMixin):
    """Spare part purchase transaction model."""

    __tablename__ = "pembelian_spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    public_receipt_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    nomor_faktur: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    diskon: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    status_bayar: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.BELUM_LUNAS,
    )
    metode_bayar: Mapped[Optional[PaymentMethod]] = mapped_column(
        SQLEnum(PaymentMethod),
        nullable=True,
    )
    tanggal_bayar: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    supplier: Mapped["Supplier"] = relationship(back_populates="pembelian")
    detail: Mapped[List["DetailPembelianSparePart"]] = relationship(
        back_populates="pembelian",
        cascade="all, delete-orphan",
    )

    @property
    def supplier_nama(self) -> Optional[str]:
        """Get supplier name for frontend compatibility."""
        return self.supplier.nama if self.supplier else None

    def __repr__(self) -> str:
        return f"<PembelianSparePart(id={self.id}, nomor='{self.nomor_transaksi}', total={self.grand_total})>"


class DetailPembelianSparePart(Base):
    """Detail of spare part purchase."""

    __tablename__ = "detail_pembelian_spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pembelian_id: Mapped[int] = mapped_column(
        ForeignKey("pembelian_spare_parts.id", ondelete="CASCADE")
    )
    spare_part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    harga_satuan: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Relationships
    pembelian: Mapped["PembelianSparePart"] = relationship(back_populates="detail")
    spare_part: Mapped["SparePart"] = relationship(back_populates="detail_pembelian")


class TransaksiPenjualanBengkel(Base, TimestampMixin):
    """Workshop sales transaction model."""

    __tablename__ = "transaksi_penjualan_bengkel"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    public_receipt_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.id"),
        nullable=True,
    )
    nama_customer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nomor_plat: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    jenis_kendaraan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Category: umum (default), jasa_angkut, jual_beli_mobil
    kategori: Mapped[str] = mapped_column(String(30), default="umum", server_default="umum")
    muatan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("muatan_jasa_angkut.id", ondelete="SET NULL"),
        nullable=True,
    )
    armada_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("armada_jasa_angkut.id", ondelete="SET NULL"),
        nullable=True,
    )
    mobil_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mobil.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Totals
    total_parts: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total_jasa: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    diskon: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    grand_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Status Pengerjaan
    status_pengerjaan: Mapped[WorkshopStatus] = mapped_column(
        SQLEnum(WorkshopStatus),
        default=WorkshopStatus.ANTRE,
        index=True,
    )

    # HPP (Harga Pokok Penjualan)
    hpp_parts: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    laba_kotor: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Payment
    status_bayar: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.LUNAS,
    )
    metode_bayar: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod),
        default=PaymentMethod.TUNAI,
    )
    jumlah_bayar: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    kembalian: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship(
        back_populates="transaksi_bengkel"
    )
    detail_parts: Mapped[List["DetailTransaksiSpareParts"]] = relationship(
        back_populates="transaksi",
        cascade="all, delete-orphan",
    )
    detail_services: Mapped[List["DetailTransaksiServices"]] = relationship(
        back_populates="transaksi",
        cascade="all, delete-orphan",
    )
    muatan: Mapped[Optional["MuatanJasaAngkut"]] = relationship()
    armada: Mapped[Optional["ArmadaJasaAngkut"]] = relationship()
    mobil: Mapped[Optional["Mobil"]] = relationship(back_populates="bengkel_perbaikan")

    @property
    def muatan_nomor(self) -> Optional[str]:
        """Get nomor_transaksi of linked transport service."""
        return self.muatan.nomor_transaksi if self.muatan else None

    @property
    def total_biaya(self) -> Decimal:
        """Alias for grand_total for frontend compatibility."""
        return self.grand_total

    @property
    def total_part(self) -> Decimal:
        """Alias for total_parts for frontend compatibility."""
        return self.total_parts

    @property
    def customer_nama(self) -> Optional[str]:
        """Get customer name, fallback to manual entry."""
        if self.customer:
            return self.customer.nama
        return self.nama_customer

    @property
    def plat_nomor(self) -> Optional[str]:
        """Alias for nomor_plat for frontend compatibility."""
        return self.nomor_plat

    def __repr__(self) -> str:
        return f"<TransaksiBengkel(id={self.id}, nomor='{self.nomor_transaksi}', total={self.grand_total})>"


class DetailTransaksiSpareParts(Base):
    """Detail of spare parts in workshop transaction."""

    __tablename__ = "detail_transaksi_spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaksi_id: Mapped[int] = mapped_column(
        ForeignKey("transaksi_penjualan_bengkel.id", ondelete="CASCADE")
    )
    spare_part_id: Mapped[int] = mapped_column(ForeignKey("spare_parts.id"))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    harga_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2))  # HPP
    harga_jual: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Relationships
    transaksi: Mapped["TransaksiPenjualanBengkel"] = relationship(
        back_populates="detail_parts"
    )
    spare_part: Mapped["SparePart"] = relationship(back_populates="detail_transaksi")

    @property
    def spare_part_nama(self) -> str:
        """Get spare part name."""
        return self.spare_part.nama if self.spare_part else ""


class DetailTransaksiServices(Base):
    """Detail of services in workshop transaction."""

    __tablename__ = "detail_transaksi_services"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaksi_id: Mapped[int] = mapped_column(
        ForeignKey("transaksi_penjualan_bengkel.id", ondelete="CASCADE")
    )
    nama_jasa: Mapped[str] = mapped_column(String(150))
    deskripsi: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    harga: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Relationships
    transaksi: Mapped["TransaksiPenjualanBengkel"] = relationship(
        back_populates="detail_services"
    )


class PengeluaranBengkel(Base, TimestampMixin):
    """Workshop expense tracking model."""

    __tablename__ = "pengeluaran_bengkel"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    
    # Business Category: umum (default), jasa_angkut, jual_beli_mobil
    bisnis_kategori: Mapped[str] = mapped_column(String(30), default="umum", server_default="umum")
    
    # Links to other modules for operational costs tracking
    muatan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("muatan_jasa_angkut.id", ondelete="SET NULL"),
        nullable=True,
    )
    armada_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("armada_jasa_angkut.id", ondelete="SET NULL"),
        nullable=True,
    )
    mobil_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("mobil.id", ondelete="SET NULL"),
        nullable=True,
    )

    kategori: Mapped[str] = mapped_column(
        String(50),
        default=ExpenseCategory.BIAYA_OPERASIONAL.value,
    )
    deskripsi: Mapped[str] = mapped_column(String(255))
    jumlah: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    metode_bayar: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod),
        default=PaymentMethod.TUNAI,
    )
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    muatan: Mapped[Optional["MuatanJasaAngkut"]] = relationship()
    armada: Mapped[Optional["ArmadaJasaAngkut"]] = relationship()
    mobil: Mapped[Optional["Mobil"]] = relationship()

    def __repr__(self) -> str:
        return f"<PengeluaranBengkel(id={self.id}, deskripsi='{self.deskripsi}', jumlah={self.jumlah})>"
