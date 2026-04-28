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

from app.database.base import Base, TimestampMixin
from app.utils.constants import (
    PiutangStatus,
    HutangStatus,
    PaymentMethod,
    KasBankType,
    PiutangSource,
    HutangSource,
    KasBankSource,
    KasBankJenis,
    AssetCategory,
    AssetStatus,
)

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.supplier import Supplier
    from app.models.user import User


class PiutangUsaha(Base, TimestampMixin):
    """Accounts receivable model."""

    __tablename__ = "piutang_usaha"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_piutang: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)

    # Source reference
    sumber: Mapped[PiutangSource] = mapped_column(
        SQLEnum(PiutangSource),
        default=PiutangSource.BENGKEL,
    )
    referensi_id: Mapped[Optional[int]] = mapped_column(nullable=True)  # ID of source transaction
    nomor_referensi: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    unit: Mapped[Optional[KasBankSource]] = mapped_column(SQLEnum(KasBankSource), nullable=True)
    is_internal: Mapped[bool] = mapped_column(default=False)

    # Customer info
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.id"),
        nullable=True,
        index=True,
    )
    nama_debitur: Mapped[str] = mapped_column(String(100))  # Name of debtor
    telepon_debitur: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    alamat_debitur: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Amount
    nominal_piutang: Mapped[Decimal] = mapped_column(Numeric(15, 2))  # Original amount
    total_dibayar: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)  # Amount paid
    sisa_piutang: Mapped[Decimal] = mapped_column(Numeric(15, 2))  # Remaining

    # Dates
    tanggal_jatuh_tempo: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tanggal_lunas: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    status: Mapped[PiutangStatus] = mapped_column(
        SQLEnum(PiutangStatus),
        default=PiutangStatus.BELUM_LUNAS,
    )
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    customer: Mapped[Optional["Customer"]] = relationship(
        back_populates="piutang"
    )
    pembayaran: Mapped[List["PembayaranPiutang"]] = relationship(
        back_populates="piutang",
        cascade="all, delete-orphan",
    )

    @property
    def persentase_terbayar(self) -> float:
        """Calculate payment percentage."""
        if self.nominal_piutang > 0:
            return float(self.total_dibayar / self.nominal_piutang * 100)
        return 0.0

    @property
    def is_overdue(self) -> bool:
        """Check if piutang is overdue."""
        if self.tanggal_jatuh_tempo and self.status != PiutangStatus.LUNAS:
            return date.today() > self.tanggal_jatuh_tempo
        return False

    def process_payment(self, amount: Decimal) -> None:
        """Process a payment and update status."""
        self.total_dibayar += amount
        self.sisa_piutang = self.nominal_piutang - self.total_dibayar

        if self.sisa_piutang <= 0:
            self.sisa_piutang = Decimal("0")
            self.status = PiutangStatus.LUNAS
            self.tanggal_lunas = date.today()
        elif self.total_dibayar > 0:
            self.status = PiutangStatus.SEBAGIAN

    def __repr__(self) -> str:
        return f"<PiutangUsaha(id={self.id}, nomor='{self.nomor_piutang}', sisa={self.sisa_piutang})>"


class PembayaranPiutang(Base, TimestampMixin):
    """Payment of receivable model."""

    __tablename__ = "pembayaran_piutang"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    piutang_id: Mapped[int] = mapped_column(
        ForeignKey("piutang_usaha.id", ondelete="CASCADE"),
        index=True,
    )
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
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
    piutang: Mapped["PiutangUsaha"] = relationship(back_populates="pembayaran")

    def __repr__(self) -> str:
        return f"<PembayaranPiutang(id={self.id}, piutang_id={self.piutang_id}, nominal={self.nominal})>"


class HutangUsaha(Base, TimestampMixin):
    """Accounts payable model."""

    __tablename__ = "hutang_usaha"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_hutang: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)

    # Source reference
    sumber: Mapped[HutangSource] = mapped_column(
        SQLEnum(HutangSource),
        default=HutangSource.PEMBELIAN_PART,
    )
    referensi_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    nomor_referensi: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    unit: Mapped[Optional[KasBankSource]] = mapped_column(SQLEnum(KasBankSource), nullable=True)
    is_internal: Mapped[bool] = mapped_column(default=False)

    # Supplier info
    supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id"),
        nullable=True,
        index=True,
    )
    nama_kreditur: Mapped[str] = mapped_column(String(100))
    telepon_kreditur: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    alamat_kreditur: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Amount
    nominal_hutang: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    total_dibayar: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    sisa_hutang: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Dates
    tanggal_jatuh_tempo: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tanggal_lunas: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    status: Mapped[HutangStatus] = mapped_column(
        SQLEnum(HutangStatus),
        default=HutangStatus.BELUM_LUNAS,
    )
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    supplier: Mapped[Optional["Supplier"]] = relationship(
        back_populates="hutang"
    )
    pembayaran: Mapped[List["PembayaranHutang"]] = relationship(
        back_populates="hutang",
        cascade="all, delete-orphan",
    )

    @property
    def persentase_terbayar(self) -> float:
        if self.nominal_hutang > 0:
            return float(self.total_dibayar / self.nominal_hutang * 100)
        return 0.0

    def process_payment(self, amount: Decimal) -> None:
        self.total_dibayar += amount
        self.sisa_hutang = self.nominal_hutang - self.total_dibayar

        if self.sisa_hutang <= 0:
            self.sisa_hutang = Decimal("0")
            self.status = HutangStatus.LUNAS
            self.tanggal_lunas = date.today()
        elif self.total_dibayar > 0:
            self.status = HutangStatus.SEBAGIAN

    def __repr__(self) -> str:
        return f"<HutangUsaha(id={self.id}, nomor='{self.nomor_hutang}', sisa={self.sisa_hutang})>"


class PembayaranHutang(Base, TimestampMixin):
    """Payment of payable model."""

    __tablename__ = "pembayaran_hutang"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    hutang_id: Mapped[int] = mapped_column(
        ForeignKey("hutang_usaha.id", ondelete="CASCADE"),
        index=True,
    )
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
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
    hutang: Mapped["HutangUsaha"] = relationship(back_populates="pembayaran")

    def __repr__(self) -> str:
        return f"<PembayaranHutang(id={self.id}, hutang_id={self.hutang_id}, nominal={self.nominal})>"


class KasBank(Base, TimestampMixin):
    """Cash and bank transaction model (journal/ledger)."""

    __tablename__ = "kas_bank"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_transaksi: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)

    # Transaction type
    jenis: Mapped[KasBankJenis] = mapped_column(
        SQLEnum(KasBankJenis),
        default=KasBankJenis.CASH,
        index=True,
    )
    metode_bayar: Mapped[PaymentMethod] = mapped_column(
        SQLEnum(PaymentMethod),
        default=PaymentMethod.TUNAI,
        nullable=True,
    )
    tipe: Mapped[KasBankType] = mapped_column(
        SQLEnum(KasBankType),  # masuk/keluar
        index=True,
    )

    # Amount
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))

    # Source reference
    sumber: Mapped[KasBankSource] = mapped_column(
        SQLEnum(KasBankSource),
        default=KasBankSource.LAINNYA,
    )
    referensi_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    nomor_referensi: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Balance tracking
    saldo_sebelum: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    saldo_sesudah: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    keterangan: Mapped[str] = mapped_column(String(255))
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    @classmethod
    def get_current_balance(cls, db_session, jenis: KasBankJenis) -> Decimal:
        """Get current balance for a specific kas/bank type.

        Args:
            db_session: SQLAlchemy session
            jenis: Type of kas/bank (cash, bank_bca, etc.)

        Returns:
            Current balance as Decimal
        """
        last_record = (
            db_session.query(cls)
            .filter(cls.jenis == jenis)
            .order_by(cls.id.desc())
            .first()
        )
        return last_record.saldo_sesudah if last_record else Decimal("0")

    def calculate_saldo(self, saldo_sebelum: Decimal) -> None:
        """Calculate saldo_sesudah based on transaction type."""
        self.saldo_sebelum = saldo_sebelum
        if self.tipe == KasBankType.MASUK:
            self.saldo_sesudah = saldo_sebelum + self.nominal
        else:  # KELUAR
            self.saldo_sesudah = saldo_sebelum - self.nominal

    def __repr__(self) -> str:
        return (
            f"<KasBank(id={self.id}, jenis={self.jenis.value}, "
            f"tipe={self.tipe.value}, nominal={self.nominal})>"
        )


class Aset(Base, TimestampMixin):
    """Fixed assets (Aktiva Tetap) model."""

    __tablename__ = "aset"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)
    kategori: Mapped[AssetCategory] = mapped_column(
        SQLEnum(AssetCategory),
        default=AssetCategory.PERALATAN,
    )
    tanggal_beli: Mapped[date] = mapped_column(Date)
    harga_beli: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    
    # Depresiasi context (simplistic for now)
    nilai_residu: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    umur_ekonomis: Mapped[int] = mapped_column(Integer, default=4)  # in years
    
    status: Mapped[AssetStatus] = mapped_column(
        SQLEnum(AssetStatus),
        default=AssetStatus.AKTIF,
    )
    lokasi: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Aset(id={self.id}, nama='{self.nama}', harga={self.harga_beli})>"


class UserCashAdjustment(Base, TimestampMixin):
    """Log of manual cash balance modifications by admin (Catatan Keuangan Cash)."""

    __tablename__ = "user_cash_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    saldo_sebelum: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    saldo_sesudah: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    keterangan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    admin: Mapped["User"] = relationship("User", foreign_keys=[admin_id])

    @property
    def target_user_name(self) -> str:
        return self.user.full_name if self.user else f"User {self.user_id}"

    @property
    def admin_name(self) -> str:
        return self.admin.full_name if self.admin else f"Admin {self.admin_id}"


    def __repr__(self) -> str:
        return f"<UserCashAdjustment(user_id={self.user_id}, nominal={self.nominal})>"

