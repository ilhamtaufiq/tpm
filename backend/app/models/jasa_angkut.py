from datetime import date
from decimal import Decimal
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.bengkel import PengeluaranBengkel


from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    Date,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin
from app.utils.constants import PaymentStatus, PaymentMethod, JASA_ANGKUT_PROFIT_SPLIT, MuatanStatus


class Supir(Base, TimestampMixin, SoftDeleteMixin):
    """Driver model for transportation service."""

    __tablename__ = "supir"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)
    nik: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    alamat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telepon: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    nomor_sim: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    jenis_sim: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # A, B1, B2, etc
    tanggal_bergabung: Mapped[date] = mapped_column(Date)
    nopol_kendaraan: Mapped[Optional[str]] = mapped_column(String(20), nullable=True) # Default vehicle plate
    info_kendaraan: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # e.g. "Colt Diesel Biru"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    muatan: Mapped[List["MuatanJasaAngkut"]] = relationship(
        back_populates="supir",
        lazy="dynamic",
    )
    armada_default_id: Mapped[Optional[int]] = mapped_column(ForeignKey("armada_jasa_angkut.id"), nullable=True)
    armada_default: Mapped[Optional["ArmadaJasaAngkut"]] = relationship()

    def __repr__(self) -> str:
        return f"<Supir(id={self.id}, kode='{self.kode}', nama='{self.nama}')>"


class ArmadaJasaAngkut(Base, TimestampMixin, SoftDeleteMixin):
    """Vehicle/Fleet model for transportation service."""

    __tablename__ = "armada_jasa_angkut"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)  # e.g. "Truk 01", "Fuso Biru"
    nopol: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    jenis: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g. "Dump Truck", "Colt Diesel"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    muatan: Mapped[List["MuatanJasaAngkut"]] = relationship(
        back_populates="armada",
        lazy="dynamic",
    )
    biaya_tambahan: Mapped[List["JasaAngkutBiayaLainnya"]] = relationship(
        back_populates="armada",
        cascade="all, delete-orphan",
    )
    part_services: Mapped[List["JasaAngkutPartService"]] = relationship(
        back_populates="armada",
        cascade="all, delete-orphan",
    )
    pengeluaran_bengkel: Mapped[List["PengeluaranBengkel"]] = relationship(
        back_populates="armada"
    )

    def __repr__(self) -> str:
        return f"<Armada(id={self.id}, nopol='{self.nopol}', nama='{self.nama}')>"


class MuatanJasaAngkut(Base, TimestampMixin):
    """Transportation load/trip model."""

    __tablename__ = "muatan_jasa_angkut"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    supir_id: Mapped[Optional[int]] = mapped_column(ForeignKey("supir.id"), nullable=True)
    supir_nama_manual: Mapped[Optional[str]] = mapped_column("supir_nama", String(100), nullable=True)
    
    armada_id: Mapped[Optional[int]] = mapped_column(ForeignKey("armada_jasa_angkut.id"), nullable=True)
    nopol: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    info_kendaraan: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    @property
    def supir_nama(self) -> Optional[str]:
        return self.supir_nama_manual or (self.supir.nama if self.supir else None)

    # Route info
    asal: Mapped[str] = mapped_column(String(100))
    tujuan: Mapped[str] = mapped_column(String(100))
    jenis_muatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ritase: Mapped[int] = mapped_column(Integer, default=1)
    berat_muatan: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)  # kg

    # Trading values
    harga_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    harga_jual: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Revenue (Calculated from jual - beli)
    pendapatan_kotor: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Costs
    biaya_bbm: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    biaya_tol: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    biaya_makan: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    biaya_parkir: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    biaya_lainnya: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    total_biaya: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Profit calculation (50% to TPM rule)
    laba_kotor: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    persentase_tpm: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=Decimal(JASA_ANGKUT_PROFIT_SPLIT * 100),  # 50%
    )
    laba_tpm: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    laba_supir: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Status & Payment
    status: Mapped[MuatanStatus] = mapped_column(
        SQLEnum(MuatanStatus),
        default=MuatanStatus.PROSES,
        index=True
    )
    status_bayar: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.BELUM_LUNAS,
    )
    tanggal_bayar: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    supir: Mapped[Optional["Supir"]] = relationship(back_populates="muatan")
    armada: Mapped[Optional["ArmadaJasaAngkut"]] = relationship(back_populates="muatan")
    biaya_tambahan: Mapped[List["JasaAngkutBiayaLainnya"]] = relationship(
        back_populates="muatan",
        cascade="all, delete-orphan",
    )
    part_services: Mapped[List["JasaAngkutPartService"]] = relationship(
        back_populates="muatan",
        cascade="all, delete-orphan",
    )
    pengeluaran_bengkel: Mapped[List["PengeluaranBengkel"]] = relationship(
        back_populates="muatan"
    )

    def calculate_profit(self) -> None:
        """Calculate profit split between TPM and driver.
        
        New Logic: Operational costs are NOT deducted from the trip's laba_tpm.
        Instead, they are recorded as armada-level expenses in reports.
        laba_tpm represents the Gross TPM Share.
        """
        # Calculate revenue from trading
        self.pendapatan_kotor = self.harga_jual - self.harga_beli

        self.total_biaya = (
            self.biaya_bbm +
            self.biaya_tol +
            self.biaya_makan +
            self.biaya_parkir +
            self.biaya_lainnya +
            sum(b.jumlah for b in self.biaya_tambahan) +
            sum(ps.total for ps in self.part_services)
        )
        
        # Trip Laba Kotor is now Gross Margin for report consistency
        self.laba_kotor = self.pendapatan_kotor
        
        # Driver share from GROSS revenue (50%)
        persentase_supir = Decimal("100") - self.persentase_tpm
        self.laba_supir = (self.pendapatan_kotor * persentase_supir / 100).quantize(Decimal("0.01"))
        
        # TPM Share is also GROSS (50%)
        # Operational expenses are reported separately per armada in the Laba Rugi report.
        self.laba_tpm = self.pendapatan_kotor - self.laba_supir


    def __repr__(self) -> str:
        return f"<MuatanJasaAngkut(id={self.id}, nomor='{self.nomor_transaksi}', tujuan='{self.tujuan}')>"


class JasaAngkutBiayaLainnya(Base, TimestampMixin):
    """Additional transportation costs."""

    __tablename__ = "jasa_angkut_biaya_lainnya"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    muatan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("muatan_jasa_angkut.id", ondelete="CASCADE"),
        nullable=True
    )
    armada_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("armada_jasa_angkut.id", ondelete="CASCADE"),
        nullable=True
    )
    tanggal: Mapped[date] = mapped_column(Date, index=True, nullable=True)
    kategori: Mapped[str] = mapped_column(String(50))
    deskripsi: Mapped[str] = mapped_column(String(255))
    jumlah: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    muatan: Mapped[Optional["MuatanJasaAngkut"]] = relationship(back_populates="biaya_tambahan")
    armada: Mapped[Optional["ArmadaJasaAngkut"]] = relationship(back_populates="biaya_tambahan")



class JasaAngkutPartService(Base, TimestampMixin):
    """Transportation vehicle maintenance costs."""

    __tablename__ = "jasa_angkut_part_service"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    muatan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("muatan_jasa_angkut.id", ondelete="CASCADE"),
        nullable=True
    )
    armada_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("armada_jasa_angkut.id", ondelete="CASCADE"),
        nullable=True
    )
    tanggal: Mapped[date] = mapped_column(Date)
    tipe: Mapped[str] = mapped_column(String(20))  # 'part' or 'service'
    deskripsi: Mapped[str] = mapped_column(String(255))
    qty: Mapped[int] = mapped_column(Integer, default=1)
    harga_satuan: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    muatan: Mapped[Optional["MuatanJasaAngkut"]] = relationship(back_populates="part_services")
    armada: Mapped[Optional["ArmadaJasaAngkut"]] = relationship(back_populates="part_services")
