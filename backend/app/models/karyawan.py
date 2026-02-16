from datetime import date, time
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String,
    Text,
    Integer,
    Numeric,
    Date,
    Time,
    ForeignKey,
    Enum as SQLEnum,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, SoftDeleteMixin
from app.utils.constants import (
    AttendanceStatus,
    EmployeeStatus,
    PaymentStatus,
    PaymentMethod,
)


class Karyawan(Base, TimestampMixin, SoftDeleteMixin):
    """Employee model."""

    __tablename__ = "karyawan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    kode: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    nama: Mapped[str] = mapped_column(String(100), index=True)
    nik: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    jabatan: Mapped[str] = mapped_column(String(50))
    alamat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telepon: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tanggal_lahir: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    tanggal_bergabung: Mapped[date] = mapped_column(Date)
    tanggal_keluar: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Salary information
    gaji_pokok: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)
    tunjangan: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    status: Mapped[EmployeeStatus] = mapped_column(
        SQLEnum(EmployeeStatus),
        default=EmployeeStatus.AKTIF,
    )
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    absensi: Mapped[List["Absensi"]] = relationship(
        back_populates="karyawan",
        lazy="dynamic",
    )
    slip_gaji: Mapped[List["SlipGaji"]] = relationship(
        back_populates="karyawan",
        lazy="dynamic",
    )
    kasbon: Mapped[List["KasbonKaryawan"]] = relationship(
        back_populates="karyawan",
        lazy="dynamic",
    )

    @property
    def total_gaji(self) -> Decimal:
        """Calculate total salary (pokok + tunjangan)."""
        return self.gaji_pokok + self.tunjangan

    @property
    def is_active(self) -> bool:
        """Check if employee is active."""
        return self.status == EmployeeStatus.AKTIF

    def __repr__(self) -> str:
        return f"<Karyawan(id={self.id}, kode='{self.kode}', nama='{self.nama}')>"


class Absensi(Base, TimestampMixin):
    """Employee attendance model."""

    __tablename__ = "absensi"
    __table_args__ = (
        UniqueConstraint("karyawan_id", "tanggal", name="uq_absensi_karyawan_tanggal"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    karyawan_id: Mapped[int] = mapped_column(ForeignKey("karyawan.id"), index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        SQLEnum(AttendanceStatus),
        default=AttendanceStatus.HADIR,
    )
    jam_masuk: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    jam_keluar: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    karyawan: Mapped["Karyawan"] = relationship(back_populates="absensi")

    @property
    def jam_kerja(self) -> Optional[float]:
        """Calculate working hours."""
        if self.jam_masuk and self.jam_keluar:
            masuk_minutes = self.jam_masuk.hour * 60 + self.jam_masuk.minute
            keluar_minutes = self.jam_keluar.hour * 60 + self.jam_keluar.minute
            return (keluar_minutes - masuk_minutes) / 60
        return None

    @property
    def is_late(self) -> bool:
        """Check if employee is late (after 08:00)."""
        if self.jam_masuk:
            return self.jam_masuk.hour >= 8 and self.jam_masuk.minute > 0
        return False

    def __repr__(self) -> str:
        return f"<Absensi(karyawan_id={self.karyawan_id}, tanggal={self.tanggal}, status={self.status.value})>"


class SlipGaji(Base, TimestampMixin):
    """Employee weekly payroll/salary slip model."""

    __tablename__ = "slip_gaji"
    __table_args__ = (
        UniqueConstraint(
            "karyawan_id", "periode_minggu", "periode_tahun",
            name="uq_slip_gaji_karyawan_periode"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_slip: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    karyawan_id: Mapped[int] = mapped_column(ForeignKey("karyawan.id"), index=True)
    periode_minggu: Mapped[int] = mapped_column(Integer)  # 1-53 (week number)
    periode_tahun: Mapped[int] = mapped_column(Integer)
    tanggal_mulai: Mapped[date] = mapped_column(Date)  # Start of week
    tanggal_akhir: Mapped[date] = mapped_column(Date)  # End of week

    # Attendance summary
    jumlah_hadir: Mapped[Decimal] = mapped_column(Numeric(5, 1), default=0)

    # Salary components (weekly)
    gaji_pokok: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Deductions
    potongan_kasbon: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Calculated totals
    gaji_bersih: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=0)

    # Payment info
    status: Mapped[PaymentStatus] = mapped_column(
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
    karyawan: Mapped["Karyawan"] = relationship(back_populates="slip_gaji")

    @property
    def karyawan_nama(self) -> Optional[str]:
        """Get employee name."""
        return self.karyawan.nama if self.karyawan else None

    def calculate_totals(self) -> None:
        """Calculate weekly salary."""
        self.gaji_bersih = self.gaji_pokok - self.potongan_kasbon

    def __repr__(self) -> str:
        return f"<SlipGaji(karyawan_id={self.karyawan_id}, minggu={self.periode_minggu}/{self.periode_tahun})>"


class KasbonKaryawan(Base, TimestampMixin):
    """Employee cash advance/loan model."""

    __tablename__ = "kasbon_karyawan"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nomor_kasbon: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    karyawan_id: Mapped[int] = mapped_column(ForeignKey("karyawan.id"), index=True)
    tanggal: Mapped[date] = mapped_column(Date, index=True)
    nominal: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    keterangan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.BELUM_LUNAS,
    )
    tanggal_lunas: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    catatan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    karyawan: Mapped["Karyawan"] = relationship(back_populates="kasbon")

    @property
    def is_paid(self) -> bool:
        """Check if kasbon is paid."""
        return self.status == PaymentStatus.LUNAS

    def mark_as_paid(self, tanggal: date) -> None:
        """Mark kasbon as paid."""
        self.status = PaymentStatus.LUNAS
        self.tanggal_lunas = tanggal

    @property
    def karyawan_nama(self) -> Optional[str]:
        """Get employee name."""
        return self.karyawan.nama if self.karyawan else None

    def __repr__(self) -> str:
        return f"<KasbonKaryawan(id={self.id}, karyawan_id={self.karyawan_id}, nominal={self.nominal})>"
