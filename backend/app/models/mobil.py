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
from app.utils.constants import CarStatus, OwnershipType, PaymentStatus, PaymentMethod, InvestorDisbursementStatus

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.bengkel import TransaksiPenjualanBengkel, PengeluaranBengkel


class Mobil(Base, TimestampMixin, SoftDeleteMixin):
    """Car inventory model."""

    __tablename__ = "mobil"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    public_gallery_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
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

    # Purchase Payment (Tracking debt for car purchase)
    status_bayar_beli: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.LUNAS,
    )
    metode_bayar_beli: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod),
        default=PaymentMethod.TUNAI,
    )
    dp_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

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
    penjualan: Mapped[Optional["TransaksiPenjualanMobil"]] = relationship(
        back_populates="mobil",
        uselist=False,
    )
    bengkel_perbaikan: Mapped[List["TransaksiPenjualanBengkel"]] = relationship(
        back_populates="mobil",
        cascade="all, delete-orphan",
    )
    pengeluaran_bengkel: Mapped[List["PengeluaranBengkel"]] = relationship(
        back_populates="mobil"
    )

    @property
    def _repair_keywords(self) -> list[str]:
        return [
            "perawatan",
            "perbaikan",
            "bengkel",
            "service",
            "servis",
            "sparepart",
            "spare part",
            "part",
            "repair",
        ]

    def _is_repair_cost(self, biaya: "MobilBiayaLainnya") -> bool:
        kategori = (biaya.kategori or "").lower()
        deskripsi = (biaya.deskripsi or "").lower()
        text = f"{kategori} {deskripsi}"

        return kategori == "perawatan bengkel" or any(
            keyword in text for keyword in self._repair_keywords
        )

    @property
    def status_bayar(self) -> Optional[str]:
        """Expose sales payment status for convenience."""
        return self.penjualan.status_bayar.value if self.penjualan and self.penjualan.status_bayar else None

    @property
    def dp(self) -> Decimal:
        """Expose sales DP for convenience."""
        return self.penjualan.dp if self.penjualan else Decimal(0)

    @property
    def total_biaya(self) -> Decimal:
        """Calculate total additional expenses (prep/admin/etc.).
        This contributes to HPP (Harga Pokok Penjualan).
        Excludes repair/workshop costs as those are categorized under part_service.
        """
        biaya_total = sum(
            b.jumlah for b in self.biaya_lainnya
            if not self._is_repair_cost(b)
        ) if self.biaya_lainnya else Decimal(0)
        
        return biaya_total

    @property
    def total_part_service(self) -> Decimal:
        """Calculate total maintenance costs (Repairs, Spareparts, etc.).
        Consolidates from:
        1. TransaksiPenjualanBengkel (Internal workshop bills)
        2. MobilBiayaLainnya with 'Perawatan Bengkel' category or repair keywords
        3. MobilPartService (Historical/Legacy manual entries)
        """
        # 1. Workshop bills (Internal/External reported via workshop module)
        bengkel_total = sum(
            t.grand_total for t in self.bengkel_perbaikan 
            if t.kategori in ['jual_beli_mobil', 'mobil', 'penjualan_mobil']
        ) if self.bengkel_perbaikan else Decimal(0)

        # 2. Repair/Ops costs recorded via Mobil Unit expenses
        biaya_ops_total = sum(
            b.jumlah for b in self.biaya_lainnya
            if self._is_repair_cost(b)
        ) if self.biaya_lainnya else Decimal(0)

        # 3. Manual entries in MobilPartService (Old system)
        # Only include if not already mirrored from other sources
        manual_total = sum(
            p.total for p in self.part_services 
            if not p.catatan or ("Trans Bengkel:" not in p.catatan and "Pengeluaran Bengkel:" not in p.catatan)
        ) if self.part_services else Decimal(0)
        
        return bengkel_total + biaya_ops_total + manual_total

    @property
    def hpp(self) -> Decimal:
        """Calculate HPP (Harga Pokok Penjualan) = Harga Beli + Pengeluaran (Biaya Lainnya).
        This is the nominal that will appear in Capital Change report.
        """
        return self.harga_beli + self.total_biaya

    @property
    def total_modal(self) -> Decimal:
        """Calculate total investment = HPP + total_part_service.
        Used for determining profit split percentage with investors.
        """
        return self.hpp + self.total_part_service

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
    public_receipt_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    mobil_id: Mapped[Optional[int]] = mapped_column(ForeignKey("mobil.id"), unique=True, nullable=True)
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

    # Investor Disbursement (Pencairan Investor)
    status_pencairan: Mapped[Optional[InvestorDisbursementStatus]] = mapped_column(
        SQLEnum(InvestorDisbursementStatus),
        default=InvestorDisbursementStatus.BELUM_DICAIRKAN,
        nullable=True,
    )
    tanggal_pencairan: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    nominal_pencairan: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    metode_pencairan: Mapped[Optional[PaymentMethod]] = mapped_column(
        SQLEnum(PaymentMethod), nullable=True
    )
    catatan_pencairan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    mobil: Mapped["Mobil"] = relationship(back_populates="penjualan")
    customer: Mapped[Optional["Customer"]] = relationship(
        back_populates="transaksi_mobil"
    )
    rincian_pencairan: Mapped[List["InvestorDisbursementDetail"]] = relationship(
        back_populates="transaksi",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TransaksiMobil(id={self.id}, nomor='{self.nomor_transaksi}', harga={self.harga_jual})>"


class InvestorDisbursementDetail(Base, TimestampMixin):
    """Detail of each payment made to an investor."""

    __tablename__ = "investor_disbursement_detail"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaksi_id: Mapped[int] = mapped_column(
        ForeignKey("transaksi_penjualan_mobil.id", ondelete="CASCADE")
    )
    tanggal: Mapped[date] = mapped_column(Date)
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    metode_bayar: Mapped[PaymentMethod] = mapped_column(SQLEnum(PaymentMethod))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationship
    transaksi: Mapped["TransaksiPenjualanMobil"] = relationship(back_populates="rincian_pencairan")
